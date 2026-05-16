from math import sqrt
from statistics import mean, pstdev
from typing import Any

from app.research.contexts import BacktestTradeResult


def calculate_metrics(equity_curve: list[dict[str, Any]], trades: list[BacktestTradeResult], initial_cash: float) -> dict[str, Any]:
    if not equity_curve:
        return {
            "total_return_pct": None,
            "annualized_return_pct": None,
            "max_drawdown_pct": None,
            "volatility_pct": None,
            "sharpe_ratio": None,
            "trade_count": len(trades),
            "win_rate_pct": None,
            "final_equity": initial_cash,
        }

    final_equity = float(equity_curve[-1]["equity"])
    total_return = final_equity / initial_cash - 1 if initial_cash else 0
    daily_returns = []
    previous = float(equity_curve[0]["equity"])
    for point in equity_curve[1:]:
        current = float(point["equity"])
        if previous > 0:
            daily_returns.append(current / previous - 1)
        previous = current

    max_drawdown = _max_drawdown([float(point["equity"]) for point in equity_curve])
    years = max(len(equity_curve) / 252, 1 / 252)
    annualized = (final_equity / initial_cash) ** (1 / years) - 1 if initial_cash > 0 and final_equity > 0 else None
    volatility = pstdev(daily_returns) * sqrt(252) if len(daily_returns) > 1 else None
    sharpe = (mean(daily_returns) / pstdev(daily_returns) * sqrt(252)) if len(daily_returns) > 1 and pstdev(daily_returns) > 0 else None
    sell_trades = [trade for trade in trades if trade.side == "sell" and trade.pnl is not None]
    win_rate = sum(1 for trade in sell_trades if (trade.pnl or 0) > 0) / len(sell_trades) if sell_trades else None

    return {
        "total_return_pct": round(total_return * 100, 4),
        "annualized_return_pct": round(annualized * 100, 4) if annualized is not None else None,
        "max_drawdown_pct": round(max_drawdown * 100, 4),
        "volatility_pct": round(volatility * 100, 4) if volatility is not None else None,
        "sharpe_ratio": round(sharpe, 4) if sharpe is not None else None,
        "trade_count": len(trades),
        "win_rate_pct": round(win_rate * 100, 4) if win_rate is not None else None,
        "final_equity": round(final_equity, 2),
    }


def _max_drawdown(equities: list[float]) -> float:
    peak = equities[0] if equities else 0
    max_dd = 0.0
    for equity in equities:
        peak = max(peak, equity)
        if peak > 0:
            max_dd = min(max_dd, equity / peak - 1)
    return abs(max_dd)
