from datetime import datetime
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


class MarketOverviewResponse(BaseModel):
    indices: list[QuotePublic]
    updated_at: datetime


class QuotesRequest(BaseModel):
    symbols: list[str] = Field(min_length=1, max_length=100)


class InstrumentDetailResponse(BaseModel):
    instrument: InstrumentPublic
    quote: QuotePublic

