from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_workspace_membership
from app.core.database import get_db
from app.models import Membership, Project, Task
from app.schemas.search import ProjectHit, SearchResults, TaskHit

router = APIRouter(tags=["search"])


@router.get("/workspaces/{workspace_id}/search", response_model=SearchResults)
async def search(
    workspace_id: uuid.UUID,
    q: str = Query(min_length=1, max_length=200),
    membership: Membership = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> SearchResults:
    like = f"%{q.lower()}%"

    project_rows = (
        await db.execute(
            select(Project)
            .where(
                Project.workspace_id == workspace_id,
                Project.deleted_at.is_(None),
                or_(
                    func.lower(Project.name).like(like),
                    func.lower(Project.description).like(like),
                ),
            )
            .order_by(Project.name.asc())
            .limit(20)
        )
    ).scalars().all()

    project_ids_q = select(Project.id).where(
        Project.workspace_id == workspace_id, Project.deleted_at.is_(None)
    )

    task_rows = (
        await db.execute(
            select(Task)
            .where(
                Task.project_id.in_(project_ids_q),
                Task.deleted_at.is_(None),
                or_(
                    func.lower(Task.title).like(like),
                    func.lower(Task.description).like(like),
                ),
            )
            .order_by(Task.updated_at.desc())
            .limit(40)
        )
    ).scalars().all()

    return SearchResults(
        projects=[
            ProjectHit(id=p.id, name=p.name, description=p.description) for p in project_rows
        ],
        tasks=[
            TaskHit(
                id=t.id,
                project_id=t.project_id,
                title=t.title,
                status=t.status,
                priority=t.priority,
            )
            for t in task_rows
        ],
    )
