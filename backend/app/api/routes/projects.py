from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    get_workspace_membership,
    require_membership_for_workspace,
    require_role,
)
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models import Membership, Project, Role, Task, TaskStatus, User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate, ProjectWithStats
from app.services.activity import log_activity

router = APIRouter(tags=["projects"])


async def _project_with_membership(
    project_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    *allowed_roles: Role,
) -> tuple[Project, Membership]:
    proj = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if not proj:
        raise NotFoundError("Project not found")
    membership = await require_membership_for_workspace(db, user, proj.workspace_id, *allowed_roles)
    return proj, membership


@router.post(
    "/workspaces/{workspace_id}/projects",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    workspace_id: uuid.UUID,
    payload: ProjectCreate,
    membership: Membership = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    project = Project(
        workspace_id=workspace_id,
        name=payload.name.strip(),
        description=payload.description,
        created_by=membership.user_id,
    )
    db.add(project)
    await db.flush()
    await log_activity(
        db,
        workspace_id=workspace_id,
        actor_id=membership.user_id,
        verb="project.created",
        target_type="project",
        target_id=project.id,
        meta={"name": project.name},
    )
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get(
    "/workspaces/{workspace_id}/projects",
    response_model=List[ProjectWithStats],
)
async def list_projects(
    workspace_id: uuid.UUID,
    membership: Membership = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectWithStats]:
    rows = (
        await db.execute(
            select(Project)
            .where(Project.workspace_id == workspace_id, Project.deleted_at.is_(None))
            .order_by(Project.created_at.desc())
        )
    ).scalars().all()

    if not rows:
        return []

    project_ids = [p.id for p in rows]
    counts = (
        await db.execute(
            select(
                Task.project_id,
                Task.status,
                func.count(Task.id),
            )
            .where(Task.project_id.in_(project_ids), Task.deleted_at.is_(None))
            .group_by(Task.project_id, Task.status)
        )
    ).all()

    totals: dict[uuid.UUID, int] = {pid: 0 for pid in project_ids}
    done_counts: dict[uuid.UUID, int] = {pid: 0 for pid in project_ids}
    for pid, s, n in counts:
        totals[pid] += int(n)
        if s == TaskStatus.DONE:
            done_counts[pid] += int(n)

    return [
        ProjectWithStats(
            id=p.id,
            workspace_id=p.workspace_id,
            name=p.name,
            description=p.description,
            created_by=p.created_by,
            created_at=p.created_at,
            updated_at=p.updated_at,
            task_count=totals.get(p.id, 0),
            done_count=done_counts.get(p.id, 0),
            progress=(done_counts.get(p.id, 0) / totals[p.id]) if totals.get(p.id) else 0.0,
        )
        for p in rows
    ]


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    project, _ = await _project_with_membership(project_id, user, db)
    return ProjectOut.model_validate(project)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    project, membership = await _project_with_membership(project_id, user, db, Role.ADMIN, Role.MANAGER)
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description or None
    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=membership.user_id,
        verb="project.updated",
        target_type="project",
        target_id=project.id,
        meta={"name": project.name},
    )
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    project, membership = await _project_with_membership(project_id, user, db, Role.ADMIN, Role.MANAGER)
    project.deleted_at = datetime.now(timezone.utc)
    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=membership.user_id,
        verb="project.deleted",
        target_type="project",
        target_id=project.id,
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
