from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.market_data.base import InstrumentInfo, Quote
from app.market_data.mock_provider import MOCK_INSTRUMENTS
from app.market_data.provider import get_market_data_provider
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
    provider = get_market_data_provider()
    quotes = provider.get_realtime_quotes(symbols)
    upsert_market_snapshots(db, quotes)
    return [quote_to_public(quote) for quote in quotes]


def get_market_overview(db: Session) -> list[QuotePublic]:
    provider = get_market_data_provider()
    quotes = provider.get_index_quotes(MAJOR_INDEX_SYMBOLS)
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
                    "provider": "mock",
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
                        "provider": "mock",
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
    )
