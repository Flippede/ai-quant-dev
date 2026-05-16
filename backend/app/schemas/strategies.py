from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StrategyTemplatePublic(BaseModel):
    id: UUID
    key: str
    name: str
    version: str
    category: str
    description: str
    default_params_json: dict[str, Any]
    schema_data: dict[str, Any] = Field(alias="schema_json")
    is_builtin: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class InstrumentScopeItem(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    market: str = Field(default="CN", min_length=1, max_length=16)
    asset_type: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, max_length=128)


class WatchScope(BaseModel):
    type: Literal["all_watchlists", "watchlist_groups", "instruments", "etf_pool"] = "all_watchlists"
    watchlist_group_ids: list[UUID] = Field(default_factory=list)
    instruments: list[InstrumentScopeItem] = Field(default_factory=list)
    etf_pool: list[InstrumentScopeItem] = Field(default_factory=list)


class StrategyConfigPublic(BaseModel):
    id: UUID
    user_id: UUID
    template_id: UUID
    template_key: str
    template_name: str
    template_category: str
    name: str
    params_json: dict[str, Any]
    watch_scope_json: dict[str, Any]
    is_enabled: bool
    monitor_interval_sec: int
    risk_level: str | None
    created_at: datetime
    updated_at: datetime


class StrategySummaryPublic(BaseModel):
    total_count: int
    enabled_count: int
    recent_configs: list[StrategyConfigPublic]


class CreateStrategyConfigRequest(BaseModel):
    template_key: str = Field(min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=128)
    params_json: dict[str, Any] | None = None
    watch_scope_json: dict[str, Any] | None = None
    monitor_interval_sec: int = Field(default=60, ge=10, le=86400)
    risk_level: str | None = Field(default="medium", pattern="^(low|medium|high)$")
    is_enabled: bool = False


class UpdateStrategyConfigRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    params_json: dict[str, Any] | None = None
    watch_scope_json: dict[str, Any] | None = None
    monitor_interval_sec: int | None = Field(default=None, ge=10, le=86400)
    risk_level: str | None = Field(default=None, pattern="^(low|medium|high)$")
    is_enabled: bool | None = None
