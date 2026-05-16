"""initial schema

Revision ID: 202605160001
Revises:
Create Date: 2026-05-16 00:00:00
"""
from typing import Sequence, Union

from alembic import op

from app.models import core  # noqa: F401
from app.models.base import Base

revision: str = "202605160001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())

