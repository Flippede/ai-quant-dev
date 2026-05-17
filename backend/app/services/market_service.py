from decimal import Decimal
import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.market_data.base import InstrumentInfo, Quote
from app.market_data.mock_provider import MOCK_INSTRUMENTS
from app.market_data.provider import get_market_data_provider, get_market_data_provider_name
from app.core.config import settings
from app.core.redis import get_redis_client
from app.models.core import Instrument, MarketSnapshot
from app.schemas.market import QuotePublic

MAJOR_INDEX_SYMBOLS = ["000001", "000300", "399006"]


def seed_mock_instruments(db: Session) -> int:
    inserted = 0
    for item in MOCK_INSTRUMENTS:
        stmt = (
            insert(Instrument)
            .values(
                id=uuid4(),
                symbol=item.symbol,
                market=item.market,
                name=item.name,
                asset_type=item.asset_type,
                exchange=item.exchange,
                is_active=item.is_active,
                metadata_json=item.metadata or {},
            )
            .on_conflict_do_nothing(index_elements=["symbol", "market"])
        )
        result = db.execute(stmt)
        inserted += result.rowcount or 0
    db.commit()
    return inserted


def search_instruments(db: Session, keyword: str) -> list[Instrument]:
    seed_mock_instruments(db)
    provider = get_market_data_provider()
    for info in provider.search_instruments(keyword):
        _upsert_instrument(db, info)
    db.commit()
    q = f"%{keyword.strip()}%"
    stmt = select(Instrument).where(Instrument.is_active.is_(True))
    if keyword.strip():
        stmt = stmt.where(Instrument.symbol.ilike(q) | Instrument.name.ilike(q))
    return list(db.scalars(stmt.order_by(Instrument.asset_type, Instrument.symbol).limit(20)))


def get_instrument(db: Session, market: str, symbol: str) -> Instrument | None:
    seed_mock_instruments(db)
    return db.scalar(select(Instrument).where(Instrument.market == market, Instrument.symbol == symbol))


def get_quotes(db: Session, symbols: list[str]) -> list[QuotePublic]:
    seed_mock_instruments(db)
    quotes = _cached_quotes(db, symbols, index=False)
    upsert_market_snapshots(db, quotes)
    return [quote_to_public(quote) for quote in quotes]


def get_market_overview(db: Session) -> list[QuotePublic]:
    quotes = _cached_quotes(db, MAJOR_INDEX_SYMBOLS, index=True)
    upsert_market_snapshots(db, quotes)
    return [quote_to_public(quote) for quote in quotes]


def quote_for_instrument(db: Session, instrument: Instrument) -> QuotePublic:
    return get_quotes(db, [instrument.symbol])[0]


def instrument_info_to_model(info: InstrumentInfo) -> Instrument:
    return Instrument(
        symbol=info.symbol,
        market=info.market,
        name=info.name,
        asset_type=info.asset_type,
        exchange=info.exchange,
        is_active=info.is_active,
        metadata_json=info.metadata or {},
    )


def upsert_market_snapshots(db: Session, quotes: list[Quote]) -> None:
    for quote in quotes:
        stmt = (
            insert(MarketSnapshot)
            .values(
                symbol=quote.symbol,
                market=quote.market,
                ts=quote.ts,
                last_price=quote.last_price,
                pct_change=quote.pct_change,
                volume=quote.volume,
                amount=quote.amount,
                raw_json={
                    "name": quote.name,
                    "asset_type": quote.asset_type,
                    "provider": quote.provider,
                    "exchange": quote.exchange,
                    "source_status": quote.source_status,
                    "is_stale": quote.is_stale,
                },
            )
            .on_conflict_do_update(
                index_elements=["symbol", "market"],
                set_={
                    "ts": quote.ts,
                    "last_price": quote.last_price,
                    "pct_change": quote.pct_change,
                    "volume": quote.volume,
                    "amount": quote.amount,
                    "raw_json": {
                        "name": quote.name,
                        "asset_type": quote.asset_type,
                        "provider": quote.provider,
                        "exchange": quote.exchange,
                        "source_status": quote.source_status,
                        "is_stale": quote.is_stale,
                    },
                    "updated_at": quote.ts,
                },
            )
        )
        db.execute(stmt)
    db.commit()


def decimal_to_float(value: Decimal) -> float:
    return float(value)


def quote_to_public(quote: Quote) -> QuotePublic:
    return QuotePublic(
        symbol=quote.symbol,
        market=quote.market,
        name=quote.name,
        asset_type=quote.asset_type,
        last_price=decimal_to_float(quote.last_price),
        pct_change=decimal_to_float(quote.pct_change),
        volume=decimal_to_float(quote.volume),
        amount=decimal_to_float(quote.amount),
        updated_at=quote.ts,
        exchange=quote.exchange,
        provider=quote.provider,
        is_stale=quote.is_stale,
        source_status=quote.source_status,
    )


def _cached_quotes(db: Session, symbols: list[str], index: bool) -> list[Quote]:
    provider = get_market_data_provider()
    provider_name = get_market_data_provider_name()
    cache = get_redis_client()
    missing: list[str] = []
    quotes_by_symbol: dict[str, Quote] = {}

    for symbol in symbols:
        cache_key = _quote_cache_key(provider_name, symbol, index)
        raw = cache.get(cache_key)
        if raw:
            quotes_by_symbol[symbol] = _quote_from_cache(json.loads(raw))
        else:
            missing.append(symbol)

    if missing:
        try:
            fresh = provider.get_index_quotes(missing) if index else provider.get_realtime_quotes(missing)
            for quote in fresh:
                quotes_by_symbol[quote.symbol] = quote
                cache.setex(_quote_cache_key(provider_name, quote.symbol, index), settings.market_cache_ttl_seconds, json.dumps(_quote_to_cache(quote)))
        except Exception:
            for symbol in missing:
                stale = _snapshot_quote(db, symbol)
                if stale is not None:
                    quotes_by_symbol[symbol] = stale
    for symbol in symbols:
        if symbol not in quotes_by_symbol:
            stale = _snapshot_quote(db, symbol)
            if stale is not None:
                quotes_by_symbol[symbol] = stale

    return [quotes_by_symbol[symbol] for symbol in symbols if symbol in quotes_by_symbol]


def _quote_cache_key(provider: str, symbol: str, index: bool) -> str:
    kind = "index" if index else "quote"
    return f"market:{provider}:{kind}:CN:{symbol}"


def _quote_to_cache(quote: Quote) -> dict:
    return {
        "symbol": quote.symbol,
        "market": quote.market,
        "name": quote.name,
        "asset_type": quote.asset_type,
        "ts": quote.ts.isoformat(),
        "last_price": str(quote.last_price),
        "pct_change": str(quote.pct_change),
        "volume": str(quote.volume),
        "amount": str(quote.amount),
        "exchange": quote.exchange,
        "provider": quote.provider,
        "source_status": quote.source_status,
    }


def _quote_from_cache(data: dict) -> Quote:
    from datetime import datetime

    return Quote(
        symbol=data["symbol"],
        market=data.get("market", "CN"),
        name=data.get("name", data["symbol"]),
        asset_type=data.get("asset_type", "stock"),
        ts=datetime.fromisoformat(data["ts"]),
        last_price=Decimal(data.get("last_price", "0")),
        pct_change=Decimal(data.get("pct_change", "0")),
        volume=Decimal(data.get("volume", "0")),
        amount=Decimal(data.get("amount", "0")),
        exchange=data.get("exchange"),
        provider=data.get("provider", get_market_data_provider_name()),
        source_status=data.get("source_status", "ok"),
    )


def _snapshot_quote(db: Session, symbol: str) -> Quote | None:
    snapshot = db.scalar(select(MarketSnapshot).where(MarketSnapshot.symbol == symbol, MarketSnapshot.market == "CN"))
    if snapshot is None:
        return None
    raw = snapshot.raw_json or {}
    return Quote(
        symbol=snapshot.symbol,
        market=snapshot.market,
        name=raw.get("name", snapshot.symbol),
        asset_type=raw.get("asset_type", "stock"),
        ts=snapshot.ts,
        last_price=Decimal(snapshot.last_price or 0),
        pct_change=Decimal(snapshot.pct_change or 0),
        volume=Decimal(snapshot.volume or 0),
        amount=Decimal(snapshot.amount or 0),
        exchange=raw.get("exchange"),
        provider=raw.get("provider", get_market_data_provider_name()),
        is_stale=True,
        source_status="stale_snapshot",
    )


def _upsert_instrument(db: Session, info: InstrumentInfo) -> None:
    stmt = (
        insert(Instrument)
        .values(
            id=uuid4(),
            symbol=info.symbol,
            market=info.market,
            name=info.name,
            asset_type=info.asset_type,
            exchange=info.exchange,
            is_active=info.is_active,
            metadata_json=info.metadata or {},
        )
        .on_conflict_do_update(
            index_elements=["symbol", "market"],
            set_={
                "name": info.name,
                "asset_type": info.asset_type,
                "exchange": info.exchange,
                "is_active": info.is_active,
                "metadata_json": info.metadata or {},
            },
        )
    )
    db.execute(stmt)
