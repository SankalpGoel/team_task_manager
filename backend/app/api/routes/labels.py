from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    get_workspace_membership,
    require_membership_for_workspace,
    require_role,
)
from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError
from app.models import Label, Membership, Project, Role, Task, TaskLabel, User
from app.schemas.label import LabelCreate, LabelOut

router = APIRouter(tags=["labels"])


@router.post(
    "/workspaces/{workspace_id}/labels",
    response_model=LabelOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_label(
    workspace_id: uuid.UUID,
    payload: LabelCreate,
    membership: Membership = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> LabelOut:
    lbl = Label(workspace_id=workspace_id, name=payload.name.strip(), color=payload.color)
    db.add(lbl)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ConflictError("A label with this name already exists in the workspace")
    await db.refresh(lbl)
    return LabelOut.model_validate(lbl)


@router.get("/workspaces/{workspace_id}/labels", response_model=List[LabelOut])
async def list_labels(
    workspace_id: uuid.UUID,
    membership: Membership = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> List[LabelOut]:
    rows = (
        await db.execute(
            select(Label).where(Label.workspace_id == workspace_id).order_by(Label.name.asc())
        )
    ).scalars().all()
    return [LabelOut.model_validate(r) for r in rows]


@router.delete(
    "/labels/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_label(
    label_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    lbl = (await db.execute(select(Label).where(Label.id == label_id))).scalar_one_or_none()
    if not lbl:
        raise NotFoundError("Label not found")
    await require_membership_for_workspace(db, user, lbl.workspace_id, Role.ADMIN, Role.MANAGER)
    await db.delete(lbl)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/tasks/{task_id}/labels/{label_id}",
    response_model=LabelOut,
)
async def attach_label(
    task_id: uuid.UUID,
    label_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LabelOut:
    task = (await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))).scalar_one_or_none()
    if not task:
        raise NotFoundError("Task not found")
    proj = (await db.execute(select(Project).where(Project.id == task.project_id))).scalar_one()
    await require_membership_for_workspace(db, user, proj.workspace_id)
    lbl = (await db.execute(select(Label).where(Label.id == label_id, Label.workspace_id == proj.workspace_id))).scalar_one_or_none()
    if not lbl:
        raise NotFoundError("Label not found in this workspace")
    existing = (
        await db.execute(
            select(TaskLabel).where(TaskLabel.task_id == task_id, TaskLabel.label_id == label_id)
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(TaskLabel(task_id=task_id, label_id=label_id))
        await db.commit()
    return LabelOut.model_validate(lbl)


@router.delete(
    "/tasks/{task_id}/labels/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def detach_label(
    task_id: uuid.UUID,
    label_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise NotFoundError("Task not found")
    proj = (await db.execute(select(Project).where(Project.id == task.project_id))).scalar_one()
    await require_membership_for_workspace(db, user, proj.workspace_id)
    link = (
        await db.execute(
            select(TaskLabel).where(TaskLabel.task_id == task_id, TaskLabel.label_id == label_id)
        )
    ).scalar_one_or_none()
    if link:
        await db.delete(link)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
