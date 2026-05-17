import asyncio

from app.core.config import settings
from app.core.database import SessionLocal
from app.monitoring.market_time import is_cn_market_session_now
from app.services.monitoring_service import monitoring_status, refresh_market_quotes_once, scan_enabled_strategies_once


async def monitoring_loop() -> None:
    monitoring_status.scheduler_running = True
    while True:
        try:
            if is_cn_market_session_now():
                with SessionLocal() as db:
                    refresh_market_quotes_once(db)
                    scan_enabled_strategies_once(db)
            monitoring_status.last_error = None
        except Exception as exc:
            monitoring_status.last_error = str(exc)
        await asyncio.sleep(max(10, settings.market_refresh_interval_seconds))
