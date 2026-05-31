from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis

router = APIRouter()


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    db_ok = True
    redis_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    try:
        r = await get_redis()
        pong = await r.ping()
        redis_ok = bool(pong)
    except Exception:
        redis_ok = False
    overall = "ok" if (db_ok and redis_ok) else "degraded"
    return {"status": overall, "db": db_ok, "redis": redis_ok}
