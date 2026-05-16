"""strategy templates seed

Revision ID: 202605160004
Revises: 202605160003
Create Date: 2026-05-16 00:00:03
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import insert

from app.strategies.builtin import BUILTIN_STRATEGY_DEFINITIONS

revision: str = "202605160004"
down_revision: Union[str, None] = "202605160003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS strategy_templates (
            id uuid PRIMARY KEY,
            key varchar(64) NOT NULL,
            name varchar(128) NOT NULL,
            version varchar(32) NOT NULL,
            category varchar(64) NOT NULL,
            description text NOT NULL,
            default_params_json jsonb NOT NULL,
            schema_json jsonb NOT NULL,
            is_builtin boolean NOT NULL DEFAULT true,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT uq_strategy_templates_key_version UNIQUE (key, version)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_strategy_configs (
            id uuid PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES users(id),
            template_id uuid NOT NULL REFERENCES strategy_templates(id),
            name varchar(128) NOT NULL,
            params_json jsonb NOT NULL,
            watch_scope_json jsonb NOT NULL,
            is_enabled boolean NOT NULL DEFAULT false,
            monitor_interval_sec integer NOT NULL DEFAULT 60,
            risk_level varchar(32),
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NOT NULL DEFAULT now()
        )
        """
    )
    op.create_index("ix_strategy_templates_key", "strategy_templates", ["key"], if_not_exists=True)
    op.create_index("ix_user_strategy_configs_user_id", "user_strategy_configs", ["user_id"], if_not_exists=True)
    op.create_index("ix_user_strategy_configs_template_id", "user_strategy_configs", ["template_id"], if_not_exists=True)
    op.create_index("ix_user_strategy_configs_enabled", "user_strategy_configs", ["is_enabled"], if_not_exists=True)

    templates = sa.table(
        "strategy_templates",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("key", sa.String),
        sa.column("name", sa.String),
        sa.column("version", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.Text),
        sa.column("default_params_json", postgresql.JSONB),
        sa.column("schema_json", postgresql.JSONB),
        sa.column("is_builtin", sa.Boolean),
        sa.column("is_active", sa.Boolean),
    )
    for definition in BUILTIN_STRATEGY_DEFINITIONS:
        stmt = (
            insert(templates)
            .values(
                id=uuid4(),
                key=definition.key,
                name=definition.name,
                version=definition.version,
                category=definition.category,
                description=definition.description,
                default_params_json=definition.default_params,
                schema_json={
                    **definition.param_schema,
                    "supported_modes": definition.supported_modes,
                    "watch_scope_schema": {
                        "type": "object",
                        "supported_types": ["all_watchlists", "watchlist_groups", "instruments", "etf_pool"],
                    },
                },
                is_builtin=definition.is_builtin,
                is_active=definition.is_active,
            )
            .on_conflict_do_update(
                constraint="uq_strategy_templates_key_version",
                set_={
                    "name": definition.name,
                    "category": definition.category,
                    "description": definition.description,
                    "default_params_json": definition.default_params,
                    "schema_json": {
                        **definition.param_schema,
                        "supported_modes": definition.supported_modes,
                        "watch_scope_schema": {
                            "type": "object",
                            "supported_types": ["all_watchlists", "watchlist_groups", "instruments", "etf_pool"],
                        },
                    },
                    "is_builtin": definition.is_builtin,
                    "is_active": definition.is_active,
                },
            )
        )
        op.execute(stmt)


def downgrade() -> None:
    op.execute(
        "DELETE FROM strategy_templates WHERE key IN ('trend_follow', 'volume_breakout', 'etf_momentum_rotation', 'risk_warning')"
    )
