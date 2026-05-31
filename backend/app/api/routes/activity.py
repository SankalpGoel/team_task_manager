from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_workspace_membership
from app.core.database import get_db
from app.models import ActivityLog, Membership, User
from app.schemas.activity import ActivityActor, ActivityOut

router = APIRouter(tags=["activity"])


@router.get("/workspaces/{workspace_id}/activity", response_model=List[ActivityOut])
async def list_activity(
    workspace_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    membership: Membership = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> List[ActivityOut]:
    rows = (
        await db.execute(
            select(ActivityLog)
            .where(ActivityLog.workspace_id == workspace_id)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    actor_ids = {a.actor_id for a in rows if a.actor_id is not None}
    actors: dict[uuid.UUID, User] = {}
    if actor_ids:
        actor_rows = (
            await db.execute(select(User).where(User.id.in_(actor_ids)))
        ).scalars().all()
        actors = {u.id: u for u in actor_rows}

    return [
        ActivityOut(
            id=a.id,
            workspace_id=a.workspace_id,
            actor=ActivityActor.model_validate(actors[a.actor_id]) if a.actor_id in actors else None,
            verb=a.verb,
            target_type=a.target_type,
            target_id=a.target_id,
            meta=a.meta,
            created_at=a.created_at,
        )
        for a in rows
    ]
