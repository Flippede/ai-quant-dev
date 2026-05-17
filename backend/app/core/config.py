from functools import cached_property

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Quant Watch"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://ai_quant:ai_quant_dev_password@localhost:5432/ai_quant"
    redis_url: str = "redis://localhost:6379/0"
    backend_cors_origins: str = "http://localhost:3000"
    session_cookie_name: str = "ai_quant_session"
    session_cookie_secure: bool = False
    session_expire_hours: int = 168
    market_timezone: str = Field(default="Asia/Shanghai")
    market_data_provider: str = Field(default="akshare")
    market_cache_ttl_seconds: int = Field(default=30)
    signal_cooldown_seconds: int = Field(default=1800)
    market_refresh_interval_seconds: int = Field(default=60)
    strategy_scan_interval_seconds: int = Field(default=60)

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


settings = Settings()
