from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ENV: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/taskmanager"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "change-me-min-32-chars-please-replace-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TTL_MIN: int = 30
    JWT_REFRESH_TTL_DAYS: int = 7

    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Team Task Manager <onboarding@resend.dev>"

    FRONTEND_URL: str = "http://localhost:5173"
    AI_RATE_LIMIT_PER_HOUR: int = 30
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def sync_database_url(self) -> str:
        """Alembic uses sync drivers; strip +asyncpg from the URL."""
        url = self.DATABASE_URL
        if "+asyncpg" in url:
            url = url.replace("+asyncpg", "")
        return url

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
