"""backtest center

Revision ID: 202605160005
Revises: 202605160004
Create Date: 2026-05-16 00:00:04
"""
from typing import Sequence, Union

from alembic import op

revision: str = "202605160005"
down_revision: Union[str, None] = "202605160004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS backtest_runs (
            id uuid PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES users(id),
            strategy_config_id uuid REFERENCES user_strategy_configs(id),
            strategy_template_id uuid NOT NULL REFERENCES strategy_templates(id),
            symbols_json jsonb NOT NULL,
            start_date date NOT NULL,
            end_date date NOT NULL,
            params_snapshot_json jsonb NOT NULL,
            assumptions_json jsonb NOT NULL,
            status varchar(32) NOT NULL,
            metrics_json jsonb NOT NULL,
            equity_curve_json jsonb NOT NULL,
            error_message text,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NOT NULL DEFAULT now(),
            started_at timestamp with time zone,
            finished_at timestamp with time zone
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS backtest_trades (
            id uuid PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES users(id),
            backtest_run_id uuid NOT NULL REFERENCES backtest_runs(id),
            symbol varchar(32) NOT NULL,
            side varchar(16) NOT NULL,
            trade_date date NOT NULL,
            price numeric(18, 4) NOT NULL,
            quantity numeric(24, 4) NOT NULL,
            amount numeric(24, 4) NOT NULL,
            fee numeric(18, 4) NOT NULL DEFAULT 0,
            pnl numeric(24, 4),
            reason text,
            created_at timestamp with time zone NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'ck_backtest_runs_status'
            ) THEN
                ALTER TABLE backtest_runs
                ADD CONSTRAINT ck_backtest_runs_status CHECK (status in ('pending', 'running', 'succeeded', 'failed'));
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'ck_backtest_trades_side'
            ) THEN
                ALTER TABLE backtest_trades
                ADD CONSTRAINT ck_backtest_trades_side CHECK (side in ('buy', 'sell'));
            END IF;
        END
        $$;
        """
    )
    op.create_index("ix_backtest_runs_user_id", "backtest_runs", ["user_id"], if_not_exists=True)
    op.create_index("ix_backtest_runs_strategy_config_id", "backtest_runs", ["strategy_config_id"], if_not_exists=True)
    op.create_index("ix_backtest_runs_created_at", "backtest_runs", ["created_at"], if_not_exists=True)
    op.create_index("ix_backtest_trades_run_id", "backtest_trades", ["backtest_run_id"], if_not_exists=True)
    op.create_index("ix_backtest_trades_user_id", "backtest_trades", ["user_id"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_backtest_trades_user_id", table_name="backtest_trades", if_exists=True)
    op.drop_index("ix_backtest_trades_run_id", table_name="backtest_trades", if_exists=True)
    op.drop_index("ix_backtest_runs_created_at", table_name="backtest_runs", if_exists=True)
    op.drop_index("ix_backtest_runs_strategy_config_id", table_name="backtest_runs", if_exists=True)
    op.drop_index("ix_backtest_runs_user_id", table_name="backtest_runs", if_exists=True)
    op.execute("ALTER TABLE backtest_trades DROP CONSTRAINT IF EXISTS ck_backtest_trades_side")
    op.execute("ALTER TABLE backtest_runs DROP CONSTRAINT IF EXISTS ck_backtest_runs_status")
