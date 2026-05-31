from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.db_url import normalize_asyncpg_url


_db_url, _connect_args = normalize_asyncpg_url(settings.DATABASE_URL)

engine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,   # guards against managed-Postgres idle-closed connections
    pool_size=15,         # headroom for endpoints that fan out queries concurrently
    max_overflow=10,
    pool_recycle=1800,    # recycle before Neon/managed providers drop idle conns
    pool_timeout=30,
    future=True,
    connect_args=_connect_args,
)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
