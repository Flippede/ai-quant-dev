from datetime import date

from app.research.contexts import BacktestRequest, BacktestResult, BacktestTradeResult
from app.research.metrics import calculate_metrics
from app.research.sample_data import DailyBarPoint, generate_mock_daily_bars


class BacktestUnsupportedStrategyError(ValueError):
    pass


class BacktestInputError(ValueError):
    pass


class BacktestEngine:
    def run(self, request: BacktestRequest) -> BacktestResult:
        if request.template_key != "etf_momentum_rotation":
            raise BacktestUnsupportedStrategyError(f"Strategy {request.template_key} is not supported for Phase 5 backtesting")
        return self._run_etf_momentum_rotation(request)

    def _run_etf_momentum_rotation(self, request: BacktestRequest) -> BacktestResult:
        if request.start_date >= request.end_date:
            raise BacktestInputError("start_date must be before end_date")
        symbols = [symbol.strip() for symbol in request.symbols if symbol.strip()]
        if not symbols:
            raise BacktestInputError("At least one symbol is required")

        lookback = int(request.params.get("lookback_period", 20))
        secondary = request.params.get("secondary_lookback_period")
        secondary_lookback = int(secondary) if secondary else None
        top_n = max(1, int(request.params.get("top_n", 1)))
        use_cash = bool(request.params.get("use_cash_when_all_negative", True))
        frequency = str(request.params.get("rebalance_frequency", request.assumptions.rebalance_frequency))

        bars_by_symbol = generate_mock_daily_bars(symbols, request.start_date, request.end_date)
        calendar = _calendar_from_bars(bars_by_symbol, request.start_date, request.end_date)
        if len(calendar) < 2:
            raise BacktestInputError("No trading days available in selected date range")

        cash = float(request.assumptions.initial_cash)
        holdings: dict[str, float] = {}
        avg_cost: dict[str, float] = {}
        trades: list[BacktestTradeResult] = []
        equity_curve: list[dict] = []
        last_rebalance_month: tuple[int, int] | None = None
        last_rebalance_week: tuple[int, int] | None = None

        for trade_date in calendar:
            closes = _close_map(bars_by_symbol, trade_date)
            if _is_rebalance_day(trade_date, frequency, last_rebalance_week, last_rebalance_month):
                if frequency == "monthly":
                    last_rebalance_month = (trade_date.year, trade_date.month)
                else:
                    week = trade_date.isocalendar()
                    last_rebalance_week = (week.year, week.week)

                scores = _momentum_scores(bars_by_symbol, trade_date, lookback, secondary_lookback)
                if scores:
                    selected = [symbol for symbol, score in scores[:top_n] if not use_cash or score > 0]
                    portfolio_value = cash + sum(holdings.get(symbol, 0) * closes.get(symbol, 0) for symbol in holdings)
                    cash, holdings, avg_cost, day_trades = _rebalance(
                        selected,
                        holdings,
                        avg_cost,
                        closes,
                        portfolio_value,
                        cash,
                        trade_date,
                        request.assumptions.fee_rate,
                        request.assumptions.slippage_rate,
                    )
                    trades.extend(day_trades)

            equity = cash + sum(quantity * closes.get(symbol, 0) for symbol, quantity in holdings.items())
            equity_curve.append(
                {
                    "date": trade_date.isoformat(),
                    "equity": round(equity, 2),
                    "cash": round(cash, 2),
                    "positions": {symbol: round(quantity, 4) for symbol, quantity in holdings.items() if quantity > 0},
                }
            )

        metrics = calculate_metrics(equity_curve, trades, request.assumptions.initial_cash)
        return BacktestResult(
            metrics=metrics,
            equity_curve=equity_curve,
            trades=trades,
            diagnostics={
                "strategy": "etf_momentum_rotation",
                "symbols": symbols,
                "lookback_period": lookback,
                "secondary_lookback_period": secondary_lookback,
                "top_n": top_n,
                "rebalance_frequency": frequency,
                "trading_days": len(calendar),
            },
            warnings=[
                "Phase 5 uses deterministic mock daily bars.",
                "Suspension, limit up/down constraints and corporate action adjustment are not modeled.",
            ],
        )


def _calendar_from_bars(bars_by_symbol: dict[str, list[DailyBarPoint]], start: date, end: date) -> list[date]:
    days = {bar.trade_date for bars in bars_by_symbol.values() for bar in bars if start <= bar.trade_date <= end}
    return sorted(days)


def _close_map(bars_by_symbol: dict[str, list[DailyBarPoint]], trade_date: date) -> dict[str, float]:
    return {symbol: bar.close for symbol, bars in bars_by_symbol.items() for bar in bars if bar.trade_date == trade_date}


def _is_rebalance_day(
    trade_date: date,
    frequency: str,
    last_week: tuple[int, int] | None,
    last_month: tuple[int, int] | None,
) -> bool:
    if frequency == "monthly":
        return last_month != (trade_date.year, trade_date.month)
    week = trade_date.isocalendar()
    return last_week != (week.year, week.week)


def _momentum_scores(
    bars_by_symbol: dict[str, list[DailyBarPoint]],
    trade_date: date,
    lookback: int,
    secondary_lookback: int | None,
) -> list[tuple[str, float]]:
    scores: list[tuple[str, float]] = []
    for symbol, bars in bars_by_symbol.items():
        history = [bar for bar in bars if bar.trade_date <= trade_date]
        if len(history) <= lookback:
            continue
        current = history[-1].close
        primary = current / history[-lookback - 1].close - 1
        if secondary_lookback and len(history) > secondary_lookback:
            secondary = current / history[-secondary_lookback - 1].close - 1
            score = primary * 0.7 + secondary * 0.3
        else:
            score = primary
        scores.append((symbol, score))
    return sorted(scores, key=lambda item: item[1], reverse=True)


def _rebalance(
    selected: list[str],
    holdings: dict[str, float],
    avg_cost: dict[str, float],
    closes: dict[str, float],
    portfolio_value: float,
    cash: float,
    trade_date: date,
    fee_rate: float,
    slippage_rate: float,
) -> tuple[float, dict[str, float], dict[str, float], list[BacktestTradeResult]]:
    trades: list[BacktestTradeResult] = []
    new_holdings = dict(holdings)
    new_avg_cost = dict(avg_cost)

    for symbol, quantity in list(new_holdings.items()):
        if quantity <= 0 or symbol in selected:
            continue
        raw_price = closes.get(symbol)
        if not raw_price:
            continue
        price = raw_price * (1 - slippage_rate)
        amount = quantity * price
        fee = amount * fee_rate
        pnl = amount - fee - new_avg_cost.get(symbol, 0) * quantity
        cash += amount - fee
        trades.append(BacktestTradeResult(symbol, "sell", trade_date, round(price, 4), round(quantity, 4), round(amount, 2), round(fee, 2), round(pnl, 2), "rebalance_out"))
        new_holdings.pop(symbol, None)
        new_avg_cost.pop(symbol, None)

    if not selected:
        return cash, new_holdings, new_avg_cost, trades

    target_value = portfolio_value / len(selected)
    for symbol in selected:
        raw_price = closes.get(symbol)
        if not raw_price:
            continue
        current_value = new_holdings.get(symbol, 0) * raw_price
        diff = target_value - current_value
        if abs(diff) < portfolio_value * 0.005:
            continue
        if diff > 0:
            price = raw_price * (1 + slippage_rate)
            amount_budget = min(diff, cash)
            fee = amount_budget * fee_rate
            quantity = max(0, (amount_budget - fee) / price)
            if quantity <= 0:
                continue
            amount = quantity * price
            total_cost = amount + fee
            previous_quantity = new_holdings.get(symbol, 0)
            previous_cost = new_avg_cost.get(symbol, 0) * previous_quantity
            new_holdings[symbol] = previous_quantity + quantity
            new_avg_cost[symbol] = (previous_cost + total_cost) / new_holdings[symbol]
            cash -= total_cost
            trades.append(BacktestTradeResult(symbol, "buy", trade_date, round(price, 4), round(quantity, 4), round(amount, 2), round(fee, 2), None, "rebalance_in"))
        else:
            quantity = min(new_holdings.get(symbol, 0), abs(diff) / raw_price)
            if quantity <= 0:
                continue
            price = raw_price * (1 - slippage_rate)
            amount = quantity * price
            fee = amount * fee_rate
            pnl = amount - fee - new_avg_cost.get(symbol, 0) * quantity
            cash += amount - fee
            new_holdings[symbol] = max(0, new_holdings.get(symbol, 0) - quantity)
            trades.append(BacktestTradeResult(symbol, "sell", trade_date, round(price, 4), round(quantity, 4), round(amount, 2), round(fee, 2), round(pnl, 2), "rebalance_reduce"))

    return cash, new_holdings, new_avg_cost, trades
