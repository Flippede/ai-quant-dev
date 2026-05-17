from app.research.data_sources.base import BACKTEST_DATA_SOURCES, BacktestMarketDataBundle
from app.research.data_sources.mock_daily_bars import MockDailyBarsDataSource
from app.research.data_sources.provider_daily_bars import ProviderDailyBarsDataSource


def get_backtest_data_source(data_source: str):
    if data_source == "mock_daily_bars":
        return MockDailyBarsDataSource()
    if data_source == "akshare_daily_bars":
        return ProviderDailyBarsDataSource()
    raise ValueError(f"Unsupported backtest data source: {data_source}")


__all__ = ["BACKTEST_DATA_SOURCES", "BacktestMarketDataBundle", "get_backtest_data_source"]
