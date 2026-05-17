from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.backtests import router as backtests_router
from app.api.health import router as health_router
from app.api.market import router as market_router
from app.api.strategies import router as strategies_router
from app.api.signals import router as signals_router
from app.api.system import router as system_router
from app.api.watchlist import router as watchlist_router
from app.core.config import settings
from app.monitoring.scheduler import monitoring_loop
import asyncio


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Private AI quantitative watch platform API.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(ai_router)
    app.include_router(backtests_router)
    app.include_router(market_router)
    app.include_router(signals_router)
    app.include_router(strategies_router)
    app.include_router(system_router)
    app.include_router(watchlist_router)
    app.include_router(health_router, tags=["health"])

    @app.on_event("startup")
    async def start_monitoring_scheduler() -> None:
        asyncio.create_task(monitoring_loop())

    return app


app = create_app()
