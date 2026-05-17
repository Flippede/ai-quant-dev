from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.core import User
from app.schemas.signals import StrategySignalPublic
from app.services.signal_service import get_signal, list_signals, recent_signals

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.get("/recent", response_model=list[StrategySignalPublic])
def recent_signals_api(
    limit: int = Query(default=10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return recent_signals(db, current_user, limit)


@router.get("", response_model=list[StrategySignalPublic])
def list_signals_api(
    severity: str | None = None,
    signal_type: str | None = None,
    strategy_config_id: UUID | None = None,
    symbol: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_signals(db, current_user, severity, signal_type, strategy_config_id, symbol, start, end, limit, offset)


@router.get("/{signal_id}", response_model=StrategySignalPublic)
def get_signal_api(signal_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    signal = get_signal(db, current_user, signal_id)
    if signal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return signal


@router.post("/{signal_id}/read")
def mark_signal_read_api(signal_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if get_signal(db, current_user, signal_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return {"status": "ok", "read_policy": "notification_read_state_deferred"}
