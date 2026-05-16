from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class CreateBacktestRequest(BaseModel):
    strategy_config_id: UUID
    symbols: list[str] | None = None
    start_date: date
    end_date: date
    initial_cash: float = Field(default=100000, gt=0, le=1_000_000_000)
    fee_rate: float = Field(default=0.0003, ge=0, le=0.1)
    slippage_rate: float = Field(default=0.0005, ge=0, le=0.1)
    execution_price_type: str = Field(default="close", pattern="^close$")
    adjustment_mode: str = Field(default="none", pattern="^(none|qfq|hfq)$")


class BacktestTradePublic(BaseModel):
    id: UUID
    backtest_run_id: UUID
    symbol: str
    side: str
    trade_date: date
    price: float
    quantity: float
    amount: float
    fee: float
    pnl: float | None
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BacktestRunPublic(BaseModel):
    id: UUID
    user_id: UUID
    strategy_config_id: UUID | None
    strategy_template_id: UUID
    strategy_config_name: str | None = None
    strategy_template_key: str | None = None
    strategy_template_name: str | None = None
    status: str
    symbols_json: list[str]
    start_date: date
    end_date: date
    params_snapshot_json: dict[str, Any]
    assumptions_json: dict[str, Any]
    metrics_json: dict[str, Any]
    equity_curve_json: list[dict[str, Any]]
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    trades: list[BacktestTradePublic] = []


class BacktestSummaryPublic(BaseModel):
    total_count: int
    recent_runs: list[BacktestRunPublic]
