from functools import lru_cache

from app.market_data.base import MarketDataProvider
from app.market_data.mock_provider import MockMarketDataProvider


@lru_cache
def get_market_data_provider() -> MarketDataProvider:
    return MockMarketDataProvider()

