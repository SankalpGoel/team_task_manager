from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_user,
    require_membership_for_workspace,
)
from app.core.database import get_db
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.models import (
    Comment,
    Label,
    Membership,
    Project,
    Role,
    Subtask,
    Task,
    TaskLabel,
    TaskPriority,
    TaskStatus,
    User,
)
from app.schemas.task import (
    BoardGroup,
    BoardOut,
    LabelMini,
    SubtaskMini,
    TaskAssign,
    TaskCreate,
    TaskDetailOut,
    TaskMove,
    TaskOut,
    TaskUpdate,
    UserMini,
)
from app.services.activity import log_activity
from app.services.ws_manager import notify
from app.utils.position import compute_position

router = APIRouter(tags=["tasks"])


# -------- helpers ----------------------------------------------------------


async def _load_task_with_relations(db: AsyncSession, task_id: uuid.UUID) -> Task | None:
    return (
        await db.execute(
            select(Task)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.labels),
                selectinload(Task.subtasks),
            )
            .where(Task.id == task_id, Task.deleted_at.is_(None))
        )
    ).scalar_one_or_none()


async def _task_summary_counts(
    db: AsyncSession, task_ids: list[uuid.UUID]
) -> tuple[dict[uuid.UUID, tuple[int, int]], dict[uuid.UUID, int]]:
    if not task_ids:
        return {}, {}
    sub_rows = (
        await db.execute(
            select(Subtask.task_id, Subtask.is_done, func.count(Subtask.id))
            .where(Subtask.task_id.in_(task_ids))
            .group_by(Subtask.task_id, Subtask.is_done)
        )
    ).all()
    sub_totals: dict[uuid.UUID, tuple[int, int]] = {}
    for tid, done, n in sub_rows:
        total, done_count = sub_totals.get(tid, (0, 0))
        total += int(n)
        if done:
            done_count += int(n)
        sub_totals[tid] = (total, done_count)

    cmt_rows = (
        await db.execute(
            select(Comment.task_id, func.count(Comment.id))
            .where(Comment.task_id.in_(task_ids), Comment.deleted_at.is_(None))
            .group_by(Comment.task_id)
        )
    ).all()
    cmt_map = {tid: int(n) for tid, n in cmt_rows}
    return sub_totals, cmt_map


def _serialize_task(task: Task, sub_counts: tuple[int, int], cmt_count: int) -> TaskOut:
    return TaskOut(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assignee=UserMini.model_validate(task.assignee) if task.assignee else None,
        due_date=task.due_date,
        position=task.position,
        created_by=task.created_by,
        created_at=task.created_at,
        updated_at=task.updated_at,
        labels=[LabelMini.model_validate(l) for l in task.labels],
        subtask_total=sub_counts[0],
        subtask_done=sub_counts[1],
        comment_count=cmt_count,
    )


async def _resolve_project(
    project_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    *allowed: Role,
) -> tuple[Project, Membership]:
    proj = (
        await db.execute(
            select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if not proj:
        raise NotFoundError("Project not found")
    m = await require_membership_for_workspace(db, user, proj.workspace_id, *allowed)
    return proj, m


async def _resolve_task(
    task_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> tuple[Task, Project, Membership]:
    task = await _load_task_with_relations(db, task_id)
    if not task:
        raise NotFoundError("Task not found")
    proj = (await db.execute(select(Project).where(Project.id == task.project_id))).scalar_one()
    if proj.deleted_at is not None:
        raise NotFoundError("Task not found")
    m = await require_membership_for_workspace(db, user, proj.workspace_id)
    return task, proj, m


def _can_edit_task(task: Task, membership: Membership) -> bool:
    if membership.role in (Role.ADMIN, Role.MANAGER):
        return True
    # Members can edit/move tasks assigned to themselves
    return task.assignee_id == membership.user_id or task.created_by == membership.user_id


# -------- routes -----------------------------------------------------------


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    project_id: uuid.UUID,
    payload: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    project, membership = await _resolve_project(project_id, user, db)  # any member can create

    if payload.assignee_id is not None:
        m = (
            await db.execute(
                select(Membership).where(
                    Membership.user_id == payload.assignee_id,
                    Membership.workspace_id == project.workspace_id,
                )
            )
        ).scalar_one_or_none()
        if not m:
            raise ValidationError("Assignee must be a member of this workspace")

    label_objs: list[Label] = []
    if payload.label_ids:
        label_objs = list(
            (
                await db.execute(
                    select(Label).where(
                        Label.id.in_(payload.label_ids),
                        Label.workspace_id == project.workspace_id,
                    )
                )
            ).scalars().all()
        )
        if len(label_objs) != len(set(payload.label_ids)):
            raise ValidationError("One or more labels not found in this workspace")

    max_pos = (
        await db.execute(
            select(func.max(Task.position)).where(
                Task.project_id == project_id, Task.status == TaskStatus.TODO
            )
        )
    ).scalar()
    next_pos = (max_pos or 0.0) + 1024.0

    task = Task(
        project_id=project_id,
        title=payload.title.strip(),
        description=payload.description,
        status=TaskStatus.TODO,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        due_date=payload.due_date,
        position=next_pos,
        created_by=user.id,
    )
    db.add(task)
    await db.flush()

    for lbl in label_objs:
        db.add(TaskLabel(task_id=task.id, label_id=lbl.id))

    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        verb="task.created",
        target_type="task",
        target_id=task.id,
        meta={"title": task.title},
    )
    await db.commit()
    await notify(
        project.workspace_id,
        "task.created",
        {"task_id": str(task.id), "project_id": str(project_id)},
    )
    fresh = await _load_task_with_relations(db, task.id)
    assert fresh is not None
    sub_counts, cmt_counts = await _task_summary_counts(db, [fresh.id])
    return _serialize_task(
        fresh, sub_counts.get(fresh.id, (0, 0)), cmt_counts.get(fresh.id, 0)
    )


@router.get("/projects/{project_id}/tasks")
async def list_tasks(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_: Optional[TaskStatus] = Query(default=None, alias="status"),
    assignee_id: Optional[uuid.UUID] = None,
    priority: Optional[TaskPriority] = None,
    label_id: Optional[uuid.UUID] = None,
    q: Optional[str] = None,
    due_before: Optional[str] = None,
    overdue: bool = False,
    group_by: Optional[str] = Query(default=None, regex="^status$"),
):
    project, _ = await _resolve_project(project_id, user, db)

    stmt = (
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.labels))
        .where(Task.project_id == project_id, Task.deleted_at.is_(None))
    )
    if status_:
        stmt = stmt.where(Task.status == status_)
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Task.title).like(like), func.lower(Task.description).like(like)))
    if due_before:
        from datetime import date as _date

        try:
            d = _date.fromisoformat(due_before)
            stmt = stmt.where(Task.due_date.is_not(None), Task.due_date < d)
        except ValueError:
            raise ValidationError("due_before must be ISO date (YYYY-MM-DD)")
    if overdue:
        from datetime import date as _date

        stmt = stmt.where(
            Task.due_date.is_not(None),
            Task.due_date < _date.today(),
            Task.status != TaskStatus.DONE,
        )
    if label_id:
        stmt = stmt.join(TaskLabel, TaskLabel.task_id == Task.id).where(TaskLabel.label_id == label_id)

    stmt = stmt.order_by(Task.status, Task.position.asc())
    rows = (await db.execute(stmt)).scalars().unique().all()
    sub_counts, cmt_counts = await _task_summary_counts(db, [t.id for t in rows])
    items = [
        _serialize_task(t, sub_counts.get(t.id, (0, 0)), cmt_counts.get(t.id, 0)) for t in rows
    ]

    if group_by == "status":
        order = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE]
        buckets = {s: [] for s in order}
        for it in items:
            buckets[it.status].append(it)
        return BoardOut(columns=[BoardGroup(status=s, items=buckets[s]) for s in order])
    return items


@router.get("/tasks/{task_id}", response_model=TaskDetailOut)
async def get_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskDetailOut:
    task, _, _ = await _resolve_task(task_id, user, db)
    sub_counts, cmt_counts = await _task_summary_counts(db, [task.id])
    base = _serialize_task(task, sub_counts.get(task.id, (0, 0)), cmt_counts.get(task.id, 0))
    return TaskDetailOut(
        **base.model_dump(),
        subtasks=[SubtaskMini.model_validate(s) for s in sorted(task.subtasks, key=lambda s: s.position)],
    )


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    task, project, membership = await _resolve_task(task_id, user, db)
    if not _can_edit_task(task, membership):
        raise ForbiddenError("You can only edit tasks assigned to you")

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description or None
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.status is not None:
        task.status = payload.status
    if payload.assignee_id is not None or "assignee_id" in payload.model_fields_set:
        if payload.assignee_id is not None:
            ok = (
                await db.execute(
                    select(Membership).where(
                        Membership.user_id == payload.assignee_id,
                        Membership.workspace_id == project.workspace_id,
                    )
                )
            ).scalar_one_or_none()
            if not ok:
                raise ValidationError("Assignee must be a workspace member")
        task.assignee_id = payload.assignee_id

    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        verb="task.updated",
        target_type="task",
        target_id=task.id,
    )
    await db.commit()
    await notify(
        project.workspace_id,
        "task.updated",
        {"task_id": str(task.id), "project_id": str(task.project_id)},
    )
    fresh = await _load_task_with_relations(db, task.id)
    assert fresh is not None
    sub_counts, cmt_counts = await _task_summary_counts(db, [fresh.id])
    return _serialize_task(fresh, sub_counts.get(fresh.id, (0, 0)), cmt_counts.get(fresh.id, 0))


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    task, project, membership = await _resolve_task(task_id, user, db)
    if membership.role not in (Role.ADMIN, Role.MANAGER):
        raise ForbiddenError("Only admins and managers can delete tasks")
    task.deleted_at = datetime.now(timezone.utc)
    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        verb="task.deleted",
        target_type="task",
        target_id=task.id,
    )
    await db.commit()
    await notify(
        project.workspace_id,
        "task.deleted",
        {"task_id": str(task.id), "project_id": str(task.project_id)},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/tasks/{task_id}/move", response_model=TaskOut)
async def move_task(
    task_id: uuid.UUID,
    payload: TaskMove,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    task, project, membership = await _resolve_task(task_id, user, db)
    if not _can_edit_task(task, membership):
        raise ForbiddenError("You can only move tasks assigned to you")

    before_pos: float | None = None
    after_pos: float | None = None
    if payload.before_id:
        before = (
            await db.execute(
                select(Task).where(Task.id == payload.before_id, Task.project_id == project.id)
            )
        ).scalar_one_or_none()
        if before:
            before_pos = before.position
    if payload.after_id:
        after = (
            await db.execute(
                select(Task).where(Task.id == payload.after_id, Task.project_id == project.id)
            )
        ).scalar_one_or_none()
        if after:
            after_pos = after.position

    if before_pos is None and after_pos is None:
        # Move to end of target column
        max_pos = (
            await db.execute(
                select(func.max(Task.position)).where(
                    Task.project_id == project.id, Task.status == payload.status
                )
            )
        ).scalar()
        new_pos = (max_pos or 0.0) + 1024.0
    else:
        new_pos = compute_position(before_pos, after_pos)

    task.status = payload.status
    task.position = new_pos
    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        verb="task.moved",
        target_type="task",
        target_id=task.id,
        meta={"status": payload.status.value},
    )
    await db.commit()
    await notify(
        project.workspace_id,
        "task.moved",
        {"task_id": str(task.id), "project_id": str(task.project_id), "status": payload.status.value},
    )
    fresh = await _load_task_with_relations(db, task.id)
    assert fresh is not None
    sub_counts, cmt_counts = await _task_summary_counts(db, [fresh.id])
    return _serialize_task(fresh, sub_counts.get(fresh.id, (0, 0)), cmt_counts.get(fresh.id, 0))


@router.patch("/tasks/{task_id}/assign", response_model=TaskOut)
async def assign_task(
    task_id: uuid.UUID,
    payload: TaskAssign,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    task, project, membership = await _resolve_task(task_id, user, db)
    if membership.role not in (Role.ADMIN, Role.MANAGER):
        # Members may self-assign or un-assign themselves only
        if payload.assignee_id not in (None, membership.user_id):
            raise ForbiddenError("Members can only self-assign tasks")

    if payload.assignee_id is not None:
        ok = (
            await db.execute(
                select(Membership).where(
                    Membership.user_id == payload.assignee_id,
                    Membership.workspace_id == project.workspace_id,
                )
            )
        ).scalar_one_or_none()
        if not ok:
            raise ValidationError("Assignee must be a workspace member")

    task.assignee_id = payload.assignee_id
    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        verb="task.assigned",
        target_type="task",
        target_id=task.id,
        meta={"assignee_id": str(payload.assignee_id) if payload.assignee_id else None},
    )
    await db.commit()
    await notify(
        project.workspace_id,
        "task.assigned",
        {"task_id": str(task.id), "project_id": str(task.project_id)},
    )
    fresh = await _load_task_with_relations(db, task.id)
    assert fresh is not None
    sub_counts, cmt_counts = await _task_summary_counts(db, [fresh.id])
    return _serialize_task(fresh, sub_counts.get(fresh.id, (0, 0)), cmt_counts.get(fresh.id, 0))
