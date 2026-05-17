from datetime import date

from app.research.data_sources.base import BacktestMarketDataBundle
from app.research.sample_data import generate_mock_daily_bars


class MockDailyBarsDataSource:
    data_source = "mock_daily_bars"
    provider_name = "mock"

    def load_daily_bars(
        self,
        instruments: list[str],
        start_date: date,
        end_date: date,
        adjustment_mode: str,
    ) -> BacktestMarketDataBundle:
        bars_by_symbol = generate_mock_daily_bars(instruments, start_date, end_date)
        all_dates = [bar.trade_date for bars in bars_by_symbol.values() for bar in bars if start_date <= bar.trade_date <= end_date]
        return BacktestMarketDataBundle(
            bars_by_symbol=bars_by_symbol,
            requested_start_date=start_date,
            requested_end_date=end_date,
            actual_start_date=min(all_dates) if all_dates else None,
            actual_end_date=max(all_dates) if all_dates else None,
            bar_count=sum(1 for bars in bars_by_symbol.values() for bar in bars if start_date <= bar.trade_date <= end_date),
            warnings=["Using deterministic mock daily bars; not real market history."],
            provider_metadata={"provider_name": self.provider_name, "adjustment_mode": adjustment_mode},
        )
