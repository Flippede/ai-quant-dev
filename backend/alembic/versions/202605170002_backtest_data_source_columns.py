"""backtest data source columns

Revision ID: 202605170002
Revises: 202605170001
Create Date: 2026-05-17 00:00:01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202605170002"
down_revision: Union[str, None] = "202605170001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("backtest_runs", sa.Column("data_source", sa.String(length=64), nullable=False, server_default="mock_daily_bars"))
    op.add_column("backtest_runs", sa.Column("adjustment_mode", sa.String(length=16), nullable=False, server_default="none"))
    op.create_index("ix_backtest_runs_data_source", "backtest_runs", ["data_source"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_backtest_runs_data_source", table_name="backtest_runs", if_exists=True)
    op.drop_column("backtest_runs", "adjustment_mode")
    op.drop_column("backtest_runs", "data_source")
