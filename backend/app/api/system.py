from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.market_data.provider import get_market_data_provider_name
from app.models.core import User
from app.monitoring.market_time import is_cn_market_session_now
from app.services.monitoring_service import monitoring_status, refresh_market_quotes_once, scan_enabled_strategies_once

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/monitoring-status")
def monitoring_status_api(_: User = Depends(get_current_user)) -> dict:
    return {
        "provider": get_market_data_provider_name(),
        "scheduler_running": monitoring_status.scheduler_running,
        "last_quote_refresh_at": monitoring_status.last_quote_refresh_at,
        "last_strategy_scan_at": monitoring_status.last_strategy_scan_at,
        "last_error": monitoring_status.last_error,
        "is_market_session": is_cn_market_session_now(),
    }


@router.post("/monitoring/refresh-once")
def refresh_once_api(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    _ensure_monitoring_actions_enabled()
    count = refresh_market_quotes_once(db)
    return {"status": "ok", "refreshed_symbols": count}


@router.post("/monitoring/scan-once")
def scan_once_api(force: bool = False, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    _ensure_monitoring_actions_enabled()
    count = scan_enabled_strategies_once(db, force=force)
    return {"status": "ok", "signals_written": count}


def _ensure_monitoring_actions_enabled() -> None:
    if not settings.enable_admin_monitoring_actions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitoring actions are disabled")
