"""auth constraints

Revision ID: 202605160002
Revises: 202605160001
Create Date: 2026-05-16 00:00:01
"""
from typing import Sequence, Union

from alembic import op

revision: str = "202605160002"
down_revision: Union[str, None] = "202605160001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_role'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT ck_users_role CHECK (role in ('admin', 'user'));
            END IF;
        END
        $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_is_active ON users (is_active)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_is_active")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")

