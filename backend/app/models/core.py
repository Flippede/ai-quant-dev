from datetime import date, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def uuid_pk() -> Mapped[Any]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = uuid_pk()
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("role in ('admin', 'user')", name="ck_users_role"),
        UniqueConstraint("username", name="uq_users_username"),
        Index("ix_users_role", "role"),
        Index("ix_users_is_active", "is_active"),
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
        Index("ix_auth_sessions_user_id", "user_id"),
        Index("ix_auth_sessions_expires_at", "expires_at"),
    )


class Instrument(Base):
    __tablename__ = "instruments"

    id = uuid_pk()
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    market: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(32), nullable=False)
    exchange: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        CheckConstraint("asset_type in ('stock', 'etf', 'index')", name="ck_instruments_asset_type"),
        UniqueConstraint("symbol", "market", name="uq_instruments_symbol_market"),
        Index("ix_instruments_symbol", "symbol"),
        Index("ix_instruments_asset_type", "asset_type"),
    )


class MarketSnapshot(Base):
    """Latest quote snapshot per instrument, not an unbounded tick store."""

    __tablename__ = "market_snapshots"

    id = uuid_pk()
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    market: Mapped[str] = mapped_column(String(16), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_price: Mapped[float | None] = mapped_column(Numeric(18, 4))
    pct_change: Mapped[float | None] = mapped_column(Numeric(10, 4))
    volume: Mapped[float | None] = mapped_column(Numeric(24, 4))
    amount: Mapped[float | None] = mapped_column(Numeric(24, 4))
    raw_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("symbol", "market", name="uq_market_snapshots_symbol_market"),
        Index("ix_market_snapshots_ts", "ts"),
    )


class IntradayBar(Base):
    """Minute-level aggregated bars. V1 deliberately avoids unbounded tick accumulation."""

    __tablename__ = "intraday_bars"

    id = uuid_pk()
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    market: Mapped[str] = mapped_column(String(16), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    freq: Mapped[str] = mapped_column(String(16), nullable=False)
    open: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    volume: Mapped[float | None] = mapped_column(Numeric(24, 4))
    amount: Mapped[float | None] = mapped_column(Numeric(24, 4))

    __table_args__ = (
        UniqueConstraint("symbol", "market", "freq", "ts", name="uq_intraday_bars_symbol_market_freq_ts"),
        Index("ix_intraday_bars_symbol_ts", "symbol", "ts"),
    )


class DailyBar(Base):
    __tablename__ = "daily_bars"

    id = uuid_pk()
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    market: Mapped[str] = mapped_column(String(16), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    volume: Mapped[float | None] = mapped_column(Numeric(24, 4))
    amount: Mapped[float | None] = mapped_column(Numeric(24, 4))
    adj_factor: Mapped[float | None] = mapped_column(Numeric(18, 8))

    __table_args__ = (
        UniqueConstraint("symbol", "market", "trade_date", name="uq_daily_bars_symbol_market_trade_date"),
        Index("ix_daily_bars_symbol_trade_date", "symbol", "trade_date"),
    )


class WatchlistGroup(Base, TimestampMixin):
    __tablename__ = "watchlist_groups"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_watchlist_groups_user_name"),
        Index("ix_watchlist_groups_user_id", "user_id"),
        Index("ix_watchlist_groups_user_sort", "user_id", "sort_order"),
    )


class WatchlistItem(Base, TimestampMixin):
    __tablename__ = "watchlist_items"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    group_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("watchlist_groups.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    market: Mapped[str] = mapped_column(String(16), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(32), nullable=False)
    name_snapshot: Mapped[str | None] = mapped_column(String(128))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    note: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("user_id", "group_id", "symbol", "market", name="uq_watchlist_items_user_group_symbol_market"),
        Index("ix_watchlist_items_user_id", "user_id"),
        Index("ix_watchlist_items_user_group", "user_id", "group_id"),
        Index("ix_watchlist_items_symbol", "symbol"),
    )


class StrategyTemplate(Base, TimestampMixin):
    __tablename__ = "strategy_templates"

    id = uuid_pk()
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    default_params_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    schema_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("key", "version", name="uq_strategy_templates_key_version"),
        Index("ix_strategy_templates_key", "key"),
    )


class UserStrategyConfig(Base, TimestampMixin):
    __tablename__ = "user_strategy_configs"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    template_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("strategy_templates.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    params_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    watch_scope_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    monitor_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    risk_level: Mapped[str | None] = mapped_column(String(32))

    __table_args__ = (
        Index("ix_user_strategy_configs_user_id", "user_id"),
        Index("ix_user_strategy_configs_template_id", "template_id"),
        Index("ix_user_strategy_configs_enabled", "is_enabled"),
    )


class BacktestRun(Base, TimestampMixin):
    __tablename__ = "backtest_runs"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    strategy_config_id: Mapped[Any | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user_strategy_configs.id"))
    strategy_template_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("strategy_templates.id"), nullable=False)
    symbols_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    params_snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    assumptions_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    metrics_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    equity_curve_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_backtest_runs_user_id", "user_id"),
        Index("ix_backtest_runs_created_at", "created_at"),
    )


class BacktestTrade(Base):
    __tablename__ = "backtest_trades"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    backtest_run_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("backtest_runs.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    side: Mapped[str] = mapped_column(String(16), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(24, 4), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(24, 4), nullable=False)
    fee: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    pnl: Mapped[float | None] = mapped_column(Numeric(24, 4))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_backtest_trades_user_id", "user_id"),
        Index("ix_backtest_trades_run_id", "backtest_run_id"),
        Index("ix_backtest_trades_symbol_trade_date", "symbol", "trade_date"),
    )


class StrategySignal(Base):
    __tablename__ = "strategy_signals"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    strategy_config_id: Mapped[Any | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user_strategy_configs.id"))
    template_id: Mapped[Any | None] = mapped_column(UUID(as_uuid=True), ForeignKey("strategy_templates.id"))
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    market: Mapped[str] = mapped_column(String(16), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float | None] = mapped_column(Numeric(10, 4))
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_strategy_signals_user_id", "user_id"),
        Index("ix_strategy_signals_symbol", "symbol"),
        Index("ix_strategy_signals_triggered_at", "triggered_at"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[Any | None] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="in_app")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_notifications_user_id", "user_id"),
        Index("ix_notifications_created_at", "created_at"),
    )


class NotificationReadState(Base):
    __tablename__ = "notification_read_states"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notification_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("notifications.id"), nullable=False)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "notification_id", name="uq_notification_read_states_user_notification"),
        Index("ix_notification_read_states_user_id", "user_id"),
    )


class AiConversation(Base, TimestampMixin):
    __tablename__ = "ai_conversations"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="mock")
    model: Mapped[str | None] = mapped_column(String(128))
    context_type: Mapped[str | None] = mapped_column(String(64))
    context_id: Mapped[str | None] = mapped_column(String(128))

    __table_args__ = (Index("ix_ai_conversations_user_id", "user_id"),)


class AiMessage(Base):
    __tablename__ = "ai_messages"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    conversation_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_ai_messages_user_id", "user_id"),
        Index("ix_ai_messages_conversation_id", "conversation_id"),
        Index("ix_ai_messages_created_at", "created_at"),
    )


class RecentlyViewedItem(Base):
    __tablename__ = "recently_viewed_items"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    item_type: Mapped[str] = mapped_column(String(64), nullable=False)
    item_id: Mapped[str | None] = mapped_column(String(128))
    symbol: Mapped[str | None] = mapped_column(String(32))
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_recently_viewed_items_user_id", "user_id"),
        Index("ix_recently_viewed_items_viewed_at", "viewed_at"),
    )


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = uuid_pk()
    user_id: Mapped[Any] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    value_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_user_preferences_user_key"),
        Index("ix_user_preferences_user_id", "user_id"),
    )
