"""monitoring signals indexes

Revision ID: 202605170001
Revises: 202605160005
Create Date: 2026-05-17 00:00:00
"""
from typing import Sequence, Union

from alembic import op

revision: str = "202605170001"
down_revision: Union[str, None] = "202605160005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_strategy_signals_cooldown",
        "strategy_signals",
        ["user_id", "strategy_config_id", "symbol", "signal_type", "triggered_at"],
        if_not_exists=True,
    )
    op.create_index("ix_strategy_signals_config_id", "strategy_signals", ["strategy_config_id"], if_not_exists=True)
    op.create_index("ix_strategy_signals_severity", "strategy_signals", ["severity"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_strategy_signals_severity", table_name="strategy_signals", if_exists=True)
    op.drop_index("ix_strategy_signals_config_id", table_name="strategy_signals", if_exists=True)
    op.drop_index("ix_strategy_signals_cooldown", table_name="strategy_signals", if_exists=True)
