from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
import json
import logging
from typing import Callable

from app.core.config import settings
from app.core.redis import get_redis_client
from app.core.timezone import utc_now
from app.market_data.base import Bar
from app.market_data.provider import get_market_data_provider_name

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CachedBarsResult:
    bars: list[Bar]
    cache_hit: bool
    stale: bool
    provider: str
    fetched_at: datetime
    warning: str | None = None


def get_cached_daily_bars(
    symbol: str,
    market: str,
    period: str,
    adjust: str,
    start_date: date,
    end_date: date,
    fetcher: Callable[[], list[Bar]],
) -> CachedBarsResult:
    provider = get_market_data_provider_name()
    key = f"market:{provider}:bars:daily:{market}:{symbol}:{period}:{adjust}:{start_date.isoformat()}:{end_date.isoformat()}"
    return _get_cached_bars(
        key=key,
        provider=provider,
        ttl=settings.market_daily_bars_cache_ttl_seconds,
        stale_ttl=settings.market_stale_bars_cache_ttl_seconds,
        context={"kind": "daily", "symbol": symbol, "period": period},
        fetcher=fetcher,
    )


def get_cached_intraday_bars(
    symbol: str,
    market: str,
    instrument_type: str,
    period: str,
    adjust: str,
    start_datetime: datetime,
    end_datetime: datetime,
    fetcher: Callable[[], list[Bar]],
) -> CachedBarsResult:
    provider = get_market_data_provider_name()
    key = (
        f"market:{provider}:bars:intraday:{market}:{symbol}:{instrument_type}:{period}:{adjust}:"
        f"{start_datetime.isoformat()}:{end_datetime.isoformat()}"
    )
    return _get_cached_bars(
        key=key,
        provider=provider,
        ttl=settings.market_intraday_bars_cache_ttl_seconds,
        stale_ttl=settings.market_stale_bars_cache_ttl_seconds,
        context={"kind": "intraday", "symbol": symbol, "period": period, "instrument_type": instrument_type},
        fetcher=fetcher,
    )


def _get_cached_bars(
    key: str,
    provider: str,
    ttl: int,
    stale_ttl: int,
    context: dict[str, str],
    fetcher: Callable[[], list[Bar]],
) -> CachedBarsResult:
    redis = get_redis_client()
    stale_key = f"{key}:stale"
    cached = redis.get(key)
    if cached:
        result = _result_from_cache(cached, provider=provider, cache_hit=True, stale=False)
        logger.info("Market bars cache hit provider=%s symbol=%s period=%s stale=false", provider, context.get("symbol"), context.get("period"))
        return result

    try:
        bars = fetcher()
    except ValueError:
        raise
    except Exception as exc:
        stale_raw = redis.get(stale_key)
        if stale_raw:
            logger.warning(
                "Market bars provider failed; returning stale cache provider=%s symbol=%s period=%s error_type=%s stale_cache=true",
                provider,
                context.get("symbol"),
                context.get("period"),
                type(exc).__name__,
            )
            result = _result_from_cache(stale_raw, provider=provider, cache_hit=True, stale=True)
            return CachedBarsResult(
                bars=result.bars,
                cache_hit=True,
                stale=True,
                provider=result.provider,
                fetched_at=result.fetched_at,
                warning="行情源暂时波动，已展示最近可用缓存数据。",
            )
        logger.warning(
            "Market bars provider failed without stale cache provider=%s symbol=%s period=%s error_type=%s stale_cache=false",
            provider,
            context.get("symbol"),
            context.get("period"),
            type(exc).__name__,
        )
        raise

    fetched_at = utc_now()
    payload = _bars_to_cache(bars, provider=provider, fetched_at=fetched_at)
    encoded = json.dumps(payload)
    if bars:
        redis.setex(key, ttl, encoded)
        redis.setex(stale_key, stale_ttl, encoded)
    else:
        logger.warning("Market bars provider returned no data provider=%s symbol=%s period=%s", provider, context.get("symbol"), context.get("period"))
    return CachedBarsResult(
        bars=bars,
        cache_hit=False,
        stale=False,
        provider=provider,
        fetched_at=fetched_at,
        warning=None if bars else "行情源未返回可用数据。",
    )


def _bars_to_cache(bars: list[Bar], provider: str, fetched_at: datetime) -> dict:
    return {
        "provider": provider,
        "fetched_at": fetched_at.isoformat(),
        "bars": [
            {
                "symbol": bar.symbol,
                "market": bar.market,
                "ts": bar.ts.isoformat(),
                "open": str(bar.open),
                "high": str(bar.high),
                "low": str(bar.low),
                "close": str(bar.close),
                "volume": str(bar.volume),
                "amount": str(bar.amount),
                "ts_kind": "datetime" if isinstance(bar.ts, datetime) else "date",
            }
            for bar in bars
        ],
    }


def _result_from_cache(raw: str, provider: str, cache_hit: bool, stale: bool) -> CachedBarsResult:
    data = json.loads(raw)
    return CachedBarsResult(
        bars=[
            Bar(
                symbol=item["symbol"],
                market=item.get("market", "CN"),
                ts=datetime.fromisoformat(item["ts"]) if item.get("ts_kind") == "datetime" else date.fromisoformat(item["ts"]),
                open=Decimal(item.get("open", "0")),
                high=Decimal(item.get("high", "0")),
                low=Decimal(item.get("low", "0")),
                close=Decimal(item.get("close", "0")),
                volume=Decimal(item.get("volume", "0")),
                amount=Decimal(item.get("amount", "0")),
            )
            for item in data.get("bars", [])
        ],
        cache_hit=cache_hit,
        stale=stale,
        provider=data.get("provider", provider),
        fetched_at=datetime.fromisoformat(data["fetched_at"]),
        warning="当前展示缓存行情。" if stale else None,
    )
