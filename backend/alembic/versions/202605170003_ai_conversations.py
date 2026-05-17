"""ai conversations

Revision ID: 202605170003
Revises: 202605170002
Create Date: 2026-05-17 00:00:02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202605170003"
down_revision: Union[str, None] = "202605170002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("ai_conversations"):
        op.create_table(
            "ai_conversations",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("provider", sa.String(length=64), nullable=False, server_default="mock"),
            sa.Column("model", sa.String(length=128), nullable=True),
            sa.Column("context_type", sa.String(length=64), nullable=True),
            sa.Column("context_id", sa.String(length=128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    if not inspector.has_table("ai_messages"):
        op.create_table(
            "ai_messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_conversations.id"), nullable=False),
            sa.Column("role", sa.String(length=32), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"], if_not_exists=True)
    op.create_index("ix_ai_conversations_context", "ai_conversations", ["user_id", "context_type", "context_id"], if_not_exists=True)
    op.create_index("ix_ai_conversations_updated_at", "ai_conversations", ["updated_at"], if_not_exists=True)
    op.create_index("ix_ai_messages_user_id", "ai_messages", ["user_id"], if_not_exists=True)
    op.create_index("ix_ai_messages_conversation_id", "ai_messages", ["conversation_id"], if_not_exists=True)
    op.create_index("ix_ai_messages_created_at", "ai_messages", ["created_at"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_ai_messages_created_at", table_name="ai_messages", if_exists=True)
    op.drop_index("ix_ai_messages_conversation_id", table_name="ai_messages", if_exists=True)
    op.drop_index("ix_ai_messages_user_id", table_name="ai_messages", if_exists=True)
    op.drop_index("ix_ai_conversations_updated_at", table_name="ai_conversations", if_exists=True)
    op.drop_index("ix_ai_conversations_context", table_name="ai_conversations", if_exists=True)
    op.drop_index("ix_ai_conversations_user_id", table_name="ai_conversations", if_exists=True)
    op.drop_table("ai_messages", if_exists=True)
    op.drop_table("ai_conversations", if_exists=True)
