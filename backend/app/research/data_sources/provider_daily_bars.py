from datetime import date, timedelta

from app.market_data.base import Bar
from app.market_data.provider import get_market_data_provider
from app.research.data_sources.base import BacktestMarketDataBundle
from app.research.sample_data import DailyBarPoint


class ProviderDailyBarsDataSource:
    data_source = "akshare_daily_bars"
    provider_name = "akshare"

    def load_daily_bars(
        self,
        instruments: list[str],
        start_date: date,
        end_date: date,
        adjustment_mode: str,
    ) -> BacktestMarketDataBundle:
        provider = get_market_data_provider()
        warmup_start = start_date - timedelta(days=520)
        bars_by_symbol: dict[str, list[DailyBarPoint]] = {}
        missing_symbols: list[str] = []
        warnings: list[str] = []

        for symbol in instruments:
            try:
                provider_bars = provider.get_daily_bars(symbol, "CN", warmup_start, end_date, adjustment_mode)
            except Exception as exc:
                missing_symbols.append(symbol)
                warnings.append(f"{symbol}: provider request failed: {exc}")
                continue
            bars = [_bar_point(bar) for bar in provider_bars]
            if not bars:
                missing_symbols.append(symbol)
                warnings.append(f"{symbol}: provider returned no daily bars")
                continue
            in_range_count = sum(1 for bar in bars if start_date <= bar.trade_date <= end_date)
            if in_range_count == 0:
                missing_symbols.append(symbol)
                warnings.append(f"{symbol}: no daily bars in requested date range")
            bars_by_symbol[symbol] = bars

        all_dates = [bar.trade_date for bars in bars_by_symbol.values() for bar in bars if start_date <= bar.trade_date <= end_date]
        return BacktestMarketDataBundle(
            bars_by_symbol=bars_by_symbol,
            requested_start_date=start_date,
            requested_end_date=end_date,
            actual_start_date=min(all_dates) if all_dates else None,
            actual_end_date=max(all_dates) if all_dates else None,
            bar_count=sum(1 for bars in bars_by_symbol.values() for bar in bars if start_date <= bar.trade_date <= end_date),
            missing_symbols=missing_symbols,
            warnings=warnings,
            provider_metadata={
                "provider_name": self.provider_name,
                "adjustment_mode": adjustment_mode,
                "warmup_start_date": warmup_start.isoformat(),
            },
        )


def _bar_point(bar: Bar) -> DailyBarPoint:
    return DailyBarPoint(
        symbol=bar.symbol,
        trade_date=bar.ts if isinstance(bar.ts, date) else bar.ts.date(),
        open=float(bar.open),
        high=float(bar.high),
        low=float(bar.low),
        close=float(bar.close),
        volume=float(bar.volume),
        amount=float(bar.amount),
    )
