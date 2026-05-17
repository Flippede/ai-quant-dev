from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import StrategySignal as StrategySignalModel
from app.models.core import StrategyTemplate, User, UserStrategyConfig
from app.schemas.signals import StrategySignalPublic


def list_signals(
    db: Session,
    user: User,
    severity: str | None = None,
    signal_type: str | None = None,
    strategy_config_id: UUID | None = None,
    symbol: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[StrategySignalPublic]:
    stmt = select(StrategySignalModel).where(StrategySignalModel.user_id == user.id)
    if severity:
        stmt = stmt.where(StrategySignalModel.severity == severity)
    if signal_type:
        stmt = stmt.where(StrategySignalModel.signal_type == signal_type)
    if strategy_config_id:
        stmt = stmt.where(StrategySignalModel.strategy_config_id == strategy_config_id)
    if symbol:
        stmt = stmt.where(StrategySignalModel.symbol == symbol)
    if start:
        stmt = stmt.where(StrategySignalModel.triggered_at >= start)
    if end:
        stmt = stmt.where(StrategySignalModel.triggered_at <= end)
    rows = list(db.scalars(stmt.order_by(StrategySignalModel.triggered_at.desc()).offset(offset).limit(limit)))
    return [_signal_public(db, row) for row in rows]


def recent_signals(db: Session, user: User, limit: int = 10) -> list[StrategySignalPublic]:
    return list_signals(db, user, limit=limit)


def get_signal(db: Session, user: User, signal_id: UUID) -> StrategySignalPublic | None:
    signal = db.scalar(select(StrategySignalModel).where(StrategySignalModel.id == signal_id, StrategySignalModel.user_id == user.id))
    if signal is None:
        return None
    return _signal_public(db, signal)


def _signal_public(db: Session, signal: StrategySignalModel) -> StrategySignalPublic:
    config = db.get(UserStrategyConfig, signal.strategy_config_id) if signal.strategy_config_id else None
    template = db.get(StrategyTemplate, signal.template_id) if signal.template_id else None
    return StrategySignalPublic(
        id=signal.id,
        user_id=signal.user_id,
        strategy_config_id=signal.strategy_config_id,
        template_id=signal.template_id,
        strategy_config_name=config.name if config else None,
        template_name=template.name if template else None,
        symbol=signal.symbol,
        market=signal.market,
        signal_type=signal.signal_type,
        severity=signal.severity,
        title=signal.title,
        message=signal.message,
        score=float(signal.score) if signal.score is not None else None,
        payload_json=signal.payload_json,
        triggered_at=signal.triggered_at,
        created_at=signal.created_at,
    )
