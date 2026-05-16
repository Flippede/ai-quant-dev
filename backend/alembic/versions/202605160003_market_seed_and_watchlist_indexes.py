"""market seed and watchlist indexes

Revision ID: 202605160003
Revises: 202605160002
Create Date: 2026-05-16 00:00:02
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import insert

revision: str = "202605160003"
down_revision: Union[str, None] = "202605160002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INSTRUMENTS = [
    ("000001", "CN", "上证指数", "index", "SSE", {"alias": "SHCOMP"}),
    ("000300", "CN", "沪深300", "index", "CSI", {"alias": "CSI300"}),
    ("399006", "CN", "创业板指", "index", "SZSE", {"alias": "CHINEXT"}),
    ("510300", "CN", "沪深300ETF", "etf", "SSE", {"tracking": "沪深300"}),
    ("510500", "CN", "中证500ETF", "etf", "SSE", {"tracking": "中证500"}),
    ("159915", "CN", "创业板ETF", "etf", "SZSE", {"tracking": "创业板指"}),
    ("512880", "CN", "证券ETF", "etf", "SSE", {"theme": "证券"}),
    ("600519", "CN", "贵州茅台", "stock", "SSE", {"industry": "白酒"}),
    ("000858", "CN", "五粮液", "stock", "SZSE", {"industry": "白酒"}),
    ("300750", "CN", "宁德时代", "stock", "SZSE", {"industry": "电池"}),
    ("601318", "CN", "中国平安", "stock", "SSE", {"industry": "保险"}),
]


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'ck_instruments_asset_type'
            ) THEN
                ALTER TABLE instruments
                ADD CONSTRAINT ck_instruments_asset_type CHECK (asset_type in ('stock', 'etf', 'index'));
            END IF;
        END
        $$;
        """
    )
    op.create_index("ix_watchlist_groups_user_sort", "watchlist_groups", ["user_id", "sort_order"], if_not_exists=True)
    op.create_index("ix_watchlist_items_user_group", "watchlist_items", ["user_id", "group_id"], if_not_exists=True)

    instruments = sa.table(
        "instruments",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("symbol", sa.String),
        sa.column("market", sa.String),
        sa.column("name", sa.String),
        sa.column("asset_type", sa.String),
        sa.column("exchange", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("metadata_json", sa.JSON),
    )
    for symbol, market, name, asset_type, exchange, metadata_json in INSTRUMENTS:
        stmt = (
            insert(instruments)
            .values(
                id=uuid4(),
                symbol=symbol,
                market=market,
                name=name,
                asset_type=asset_type,
                exchange=exchange,
                is_active=True,
                metadata_json=metadata_json,
            )
            .on_conflict_do_nothing(index_elements=["symbol", "market"])
        )
        op.execute(stmt)


def downgrade() -> None:
    op.drop_index("ix_watchlist_items_user_group", table_name="watchlist_items", if_exists=True)
    op.drop_index("ix_watchlist_groups_user_sort", table_name="watchlist_groups", if_exists=True)
    op.execute("ALTER TABLE instruments DROP CONSTRAINT IF EXISTS ck_instruments_asset_type")
