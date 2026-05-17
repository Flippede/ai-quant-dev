from dataclasses import dataclass, field
from datetime import date
from typing import Protocol

from app.research.sample_data import DailyBarPoint

BACKTEST_DATA_SOURCES = {"mock_daily_bars", "akshare_daily_bars"}
FUTURE_BACKTEST_DATA_SOURCES = {"tushare_daily_bars"}


@dataclass(frozen=True)
class BacktestMarketDataBundle:
    bars_by_symbol: dict[str, list[DailyBarPoint]]
    requested_start_date: date
    requested_end_date: date
    actual_start_date: date | None
    actual_end_date: date | None
    bar_count: int
    missing_symbols: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    provider_metadata: dict = field(default_factory=dict)

    def data_quality_json(self) -> dict:
        return {
            "requested_start_date": self.requested_start_date.isoformat(),
            "requested_end_date": self.requested_end_date.isoformat(),
            "actual_start_date": self.actual_start_date.isoformat() if self.actual_start_date else None,
            "actual_end_date": self.actual_end_date.isoformat() if self.actual_end_date else None,
            "bar_count": self.bar_count,
            "missing_symbols": self.missing_symbols,
            "warnings": self.warnings,
            "provider_metadata": self.provider_metadata,
        }


class BacktestDataSource(Protocol):
    data_source: str
    provider_name: str

    def load_daily_bars(
        self,
        instruments: list[str],
        start_date: date,
        end_date: date,
        adjustment_mode: str,
    ) -> BacktestMarketDataBundle:
        ...
