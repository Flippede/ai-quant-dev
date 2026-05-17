from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class StrategyAdvisorRequest(BaseModel):
    user_prompt: str = Field(min_length=1, max_length=4000)
    risk_preference: str | None = Field(default=None, max_length=64)
    asset_focus: str | None = Field(default=None, max_length=64)


class AIResponsePublic(BaseModel):
    conversation_id: UUID
    content: str
    parsed_json: dict[str, Any] | None
    provider: str
    model: str | None


class AIMessagePublic(BaseModel):
    id: UUID
    role: str
    content: str
    metadata_json: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class AIConversationPublic(BaseModel):
    id: UUID
    title: str
    provider: str
    model: str | None
    context_type: str | None
    context_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIConversationDetailPublic(AIConversationPublic):
    messages: list[AIMessagePublic]
