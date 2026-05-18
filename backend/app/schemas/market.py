from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class InstrumentPublic(BaseModel):
    id: UUID | None = None
    symbol: str
    market: str
    name: str
    asset_type: str
    exchange: str | None
    is_active: bool
    metadata_json: dict

    model_config = {"from_attributes": True}


class QuotePublic(BaseModel):
    symbol: str
    market: str
    name: str
    asset_type: str
    last_price: float
    pct_change: float
    volume: float
    amount: float
    updated_at: datetime
    exchange: str | None = None
    provider: str = "mock"
    is_stale: bool = False
    source_status: str = "ok"


class MarketOverviewResponse(BaseModel):
    indices: list[QuotePublic]
    updated_at: datetime


class QuotesRequest(BaseModel):
    symbols: list[str] = Field(min_length=1, max_length=100)


class InstrumentDetailResponse(BaseModel):
    instrument: InstrumentPublic
    quote: QuotePublic


class DailyBarPublic(BaseModel):
    symbol: str
    market: str
    trade_date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float


class MarketBarsResponse(BaseModel):
    symbol: str
    market: str
    period: str
    adjustment_mode: str
    bars: list[DailyBarPublic]


class IntradayBarPublic(BaseModel):
    symbol: str
    market: str
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float


class IntradayBarsResponse(BaseModel):
    symbol: str
    market: str
    instrument_type: str
    period: str
    adjustment_mode: str
    bars: list[IntradayBarPublic]
    source_note: str | None = None
