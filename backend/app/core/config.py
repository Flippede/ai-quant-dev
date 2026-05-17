from functools import cached_property

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Quant Watch"
    app_env: str = Field(default="development")
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
    run_scheduler_in_api: bool = Field(default=True)
    enable_admin_monitoring_actions: bool = Field(default=True)
    trusted_hosts: str = Field(default="localhost,127.0.0.1")
    login_rate_limit_window_seconds: int = Field(default=300)
    login_rate_limit_max_failures: int = Field(default=8)
    ai_provider: str = Field(default="mock")
    ai_base_url: str | None = None
    ai_api_key: str | None = None
    ai_model: str = Field(default="mock-ai")
    ai_timeout_seconds: int = Field(default=30)
    ai_max_output_tokens: int = Field(default=1200)
    ai_rate_limit_window_seconds: int = Field(default=30)
    ai_rate_limit_max_requests: int = Field(default=5)

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @cached_property
    def allowed_hosts(self) -> list[str]:
        return [host.strip() for host in self.trusted_hosts.split(",") if host.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production" or self.environment == "production"


settings = Settings()
