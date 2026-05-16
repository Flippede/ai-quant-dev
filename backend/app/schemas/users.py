from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AdminUserPublic(BaseModel):
    id: UUID
    username: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=256)
    role: str = Field(default="user", pattern="^(admin|user)$")


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=256)

