from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StrategySignalPublic(BaseModel):
    id: UUID
    user_id: UUID
    strategy_config_id: UUID | None
    template_id: UUID | None
    strategy_config_name: str | None = None
    template_name: str | None = None
    symbol: str
    market: str
    signal_type: str
    severity: str
    title: str
    message: str
    score: float | None
    payload_json: dict
    triggered_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
