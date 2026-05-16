from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings

MARKET_TZ = ZoneInfo(settings.market_timezone)


def utc_now() -> datetime:
    return datetime.now(UTC)


def market_now() -> datetime:
    return datetime.now(MARKET_TZ)

