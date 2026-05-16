from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
        "utc_time": datetime.now(UTC).isoformat(),
        "market_timezone": settings.market_timezone,
        "market_time": datetime.now(ZoneInfo(settings.market_timezone)).isoformat(),
    }


@router.get("/health/db")
def database_health_check() -> dict[str, str]:
    with SessionLocal() as session:
        session.execute(text("SELECT 1"))
    return {"status": "ok"}

