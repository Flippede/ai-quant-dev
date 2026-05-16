from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.core import User
from app.schemas.backtests import BacktestRunPublic, BacktestSummaryPublic, CreateBacktestRequest
from app.services.backtest_service import (
    BacktestServiceError,
    backtest_summary,
    create_backtest,
    delete_backtest,
    get_backtest,
    list_backtests,
)

router = APIRouter(prefix="/api/backtests", tags=["backtests"])


@router.post("", response_model=BacktestRunPublic, status_code=status.HTTP_201_CREATED)
def create_backtest_api(
    payload: CreateBacktestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return create_backtest(
            db,
            current_user,
            payload.strategy_config_id,
            payload.symbols,
            payload.start_date,
            payload.end_date,
            payload.initial_cash,
            payload.fee_rate,
            payload.slippage_rate,
            payload.execution_price_type,
            payload.adjustment_mode,
        )
    except BacktestServiceError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.get("", response_model=list[BacktestRunPublic])
def list_backtests_api(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_backtests(db, current_user)


@router.get("/summary", response_model=BacktestSummaryPublic)
def backtest_summary_api(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return backtest_summary(db, current_user)


@router.get("/{run_id}", response_model=BacktestRunPublic)
def get_backtest_api(run_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    run = get_backtest(db, current_user, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found")
    return run


@router.delete("/{run_id}")
def delete_backtest_api(run_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    if not delete_backtest(db, current_user, run_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found")
    return {"status": "ok"}
