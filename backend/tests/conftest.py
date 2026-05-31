"""Shared test config.

Unit tests (tests/unit) run with no external services. Integration tests
(tests/integration) require a Postgres database supplied via TEST_DATABASE_URL;
they are skipped automatically when it is absent. Redis is faked in-process so
integration tests need only a database, not a live Redis.
"""
from __future__ import annotations

import os

# Must be set before any `app.*` import triggers Settings() construction.
os.environ.setdefault("JWT_SECRET", "test-secret-which-is-at-least-32-characters-long")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("ENV", "test")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
_requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL not set — skipping integration tests",
)


# --------------------------------------------------------------------------- #
# In-memory fake Redis (covers everything our code calls)
# --------------------------------------------------------------------------- #
class _FakePipeline:
    def __init__(self, store: "FakeRedis") -> None:
        self._store = store
        self._ops: list[tuple[str, str]] = []

    def incr(self, key: str):
        self._ops.append(("incr", key))
        return self

    def ttl(self, key: str):
        self._ops.append(("ttl", key))
        return self

    async def execute(self):
        out = []
        for op, key in self._ops:
            if op == "incr":
                self._store.data[key] = int(self._store.data.get(key, 0)) + 1
                out.append(self._store.data[key])
            else:  # ttl
                out.append(self._store.ttls.get(key, -1))
        self._ops = []
        return out


class FakeRedis:
    def __init__(self) -> None:
        self.data: dict[str, object] = {}
        self.ttls: dict[str, int] = {}

    def pipeline(self) -> _FakePipeline:
        return _FakePipeline(self)

    async def incr(self, key: str) -> int:
        self.data[key] = int(self.data.get(key, 0)) + 1
        return self.data[key]  # type: ignore[return-value]

    async def ttl(self, key: str) -> int:
        return self.ttls.get(key, -1)

    async def expire(self, key: str, seconds: int) -> bool:
        self.ttls[key] = seconds
        return True

    async def get(self, key: str):
        return self.data.get(key)

    async def set(self, key: str, value, *args, **kwargs) -> bool:
        self.data[key] = value
        return True

    async def setex(self, key: str, seconds: int, value) -> bool:
        self.data[key] = value
        self.ttls[key] = seconds
        return True

    async def publish(self, channel: str, message: str) -> int:
        return 0


@pytest_asyncio.fixture
async def client(monkeypatch):
    """An httpx AsyncClient wired to the app against a fresh test schema."""
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set")

    from httpx import ASGITransport, AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.core.config import settings

    settings.DATABASE_URL = TEST_DATABASE_URL

    fake = FakeRedis()

    async def _fake_get_redis():
        return fake

    # Each module binds get_redis by name at import time, so patch each site.
    monkeypatch.setattr("app.core.redis.get_redis", _fake_get_redis)
    monkeypatch.setattr("app.services.ratelimit.get_redis", _fake_get_redis)
    monkeypatch.setattr("app.services.ws_manager.get_redis", _fake_get_redis)

    engine = create_async_engine(TEST_DATABASE_URL, future=True)

    from app.models import Base

    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    from app.core.database import get_db
    from app.main import app

    async def _get_db():
        async with TestSession() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def pytest_collection_modifyitems(config, items):
    """Auto-skip everything under tests/integration when there's no DB."""
    for item in items:
        if "integration" in str(item.fspath).replace("\\", "/"):
            item.add_marker(_requires_db)
