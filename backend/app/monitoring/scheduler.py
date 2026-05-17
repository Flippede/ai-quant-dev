import asyncio
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.monitoring.market_time import is_cn_market_session_now
from app.services.monitoring_service import mark_scheduler_heartbeat, monitoring_status, record_monitoring_error, refresh_market_quotes_once, scan_enabled_strategies_once

logger = logging.getLogger(__name__)


async def monitoring_loop() -> None:
    mark_scheduler_heartbeat(True)
    logger.info("Monitoring scheduler started interval_seconds=%s", settings.market_refresh_interval_seconds)
    while True:
        try:
            mark_scheduler_heartbeat(True)
            if is_cn_market_session_now():
                with SessionLocal() as db:
                    refresh_market_quotes_once(db)
                    scan_enabled_strategies_once(db)
            monitoring_status.last_error = None
        except Exception as exc:
            record_monitoring_error(str(exc))
            logger.exception("Monitoring scheduler iteration failed")
        await asyncio.sleep(max(10, settings.market_refresh_interval_seconds))


def run_scheduler() -> None:
    asyncio.run(monitoring_loop())


if __name__ == "__main__":
    run_scheduler()
