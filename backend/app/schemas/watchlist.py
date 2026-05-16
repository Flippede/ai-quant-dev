from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.market import QuotePublic


class WatchlistItemPublic(BaseModel):
    id: UUID
    group_id: UUID
    symbol: str
    market: str
    asset_type: str
    name_snapshot: str | None
    sort_order: int
    note: str | None
    quote: QuotePublic | None = None

    model_config = {"from_attributes": True}


class WatchlistGroupPublic(BaseModel):
    id: UUID
    name: str
    sort_order: int
    items: list[WatchlistItemPublic]

    model_config = {"from_attributes": True}


class CreateWatchlistGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    sort_order: int = 0


class UpdateWatchlistGroupRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    sort_order: int | None = None


class CreateWatchlistItemRequest(BaseModel):
    group_id: UUID
    symbol: str = Field(min_length=1, max_length=32)
    market: str = Field(default="CN", min_length=1, max_length=16)
    note: str | None = Field(default=None, max_length=1000)
    sort_order: int = 0


class UpdateWatchlistItemRequest(BaseModel):
    note: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = None

