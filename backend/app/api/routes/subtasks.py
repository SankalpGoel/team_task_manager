from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_membership_for_workspace
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models import Project, Subtask, Task, User
from app.schemas.subtask import SubtaskCreate, SubtaskOut, SubtaskUpdate
from app.services.ws_manager import notify

router = APIRouter(tags=["subtasks"])


async def _resolve_task_for_member(
    task_id: uuid.UUID, user: User, db: AsyncSession
) -> tuple[Task, Project]:
    task = (
        await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    ).scalar_one_or_none()
    if not task:
        raise NotFoundError("Task not found")
    proj = (await db.execute(select(Project).where(Project.id == task.project_id))).scalar_one()
    await require_membership_for_workspace(db, user, proj.workspace_id)
    return task, proj


@router.post(
    "/tasks/{task_id}/subtasks",
    response_model=SubtaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_subtask(
    task_id: uuid.UUID,
    payload: SubtaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubtaskOut:
    _, proj = await _resolve_task_for_member(task_id, user, db)
    max_pos = (
        await db.execute(select(func.max(Subtask.position)).where(Subtask.task_id == task_id))
    ).scalar()
    st = Subtask(task_id=task_id, title=payload.title.strip(), position=(max_pos or 0.0) + 1024.0)
    db.add(st)
    await db.commit()
    await db.refresh(st)
    await notify(proj.workspace_id, "subtask.changed", {"task_id": str(task_id)})
    return SubtaskOut.model_validate(st)


@router.patch("/subtasks/{subtask_id}", response_model=SubtaskOut)
async def update_subtask(
    subtask_id: uuid.UUID,
    payload: SubtaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubtaskOut:
    st = (await db.execute(select(Subtask).where(Subtask.id == subtask_id))).scalar_one_or_none()
    if not st:
        raise NotFoundError("Subtask not found")
    _, proj = await _resolve_task_for_member(st.task_id, user, db)
    if payload.title is not None:
        st.title = payload.title.strip()
    if payload.is_done is not None:
        st.is_done = payload.is_done
    await db.commit()
    await db.refresh(st)
    await notify(proj.workspace_id, "subtask.changed", {"task_id": str(st.task_id)})
    return SubtaskOut.model_validate(st)


@router.delete(
    "/subtasks/{subtask_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_subtask(
    subtask_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    st = (await db.execute(select(Subtask).where(Subtask.id == subtask_id))).scalar_one_or_none()
    if not st:
        raise NotFoundError("Subtask not found")
    _, proj = await _resolve_task_for_member(st.task_id, user, db)
    task_id = st.task_id
    await db.delete(st)
    await db.commit()
    await notify(proj.workspace_id, "subtask.changed", {"task_id": str(task_id)})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
