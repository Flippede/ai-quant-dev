from functools import lru_cache

from app.core.config import settings
from app.market_data.akshare_provider import AKShareProvider
from app.market_data.base import MarketDataProvider
from app.market_data.mock_provider import MockMarketDataProvider
from app.market_data.tushare_provider import TushareProvider


@lru_cache
def get_market_data_provider() -> MarketDataProvider:
    provider = settings.market_data_provider.lower()
    if provider == "akshare":
        return AKShareProvider()
    if provider == "tushare":
        return TushareProvider()
    return MockMarketDataProvider()


def get_market_data_provider_name() -> str:
    return settings.market_data_provider.lower()
