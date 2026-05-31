from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog


async def log_activity(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    verb: str,
    target_type: str,
    target_id: uuid.UUID | None = None,
    meta: dict[str, Any] | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        workspace_id=workspace_id,
        actor_id=actor_id,
        verb=verb,
        target_type=target_type,
        target_id=target_id,
        meta=meta,
    )
    db.add(entry)
    await db.flush()
    return entry
