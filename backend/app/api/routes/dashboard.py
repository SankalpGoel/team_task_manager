from __future__ import annotations

import asyncio
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import cast, func, select
from sqlalchemy.dialects.postgresql import DATE
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_workspace_membership
from app.core.database import SessionLocal, get_db
from app.models import Membership, Project, Task, TaskStatus, User
from app.schemas.dashboard import (
    DashboardOut,
    ProjectProgressOut,
    StatusCounts,
    TrendPoint,
    WorkloadOut,
)
from app.schemas.task import LabelMini, TaskOut, UserMini

router = APIRouter(tags=["dashboard"])


def _task_out_lite(t: Task) -> TaskOut:
    """Serialize a task WITHOUT extra subtask/comment-count queries.

    The dashboard lists only render title/priority/assignee/due, so we skip the
    per-task count round-trips entirely (counts default to 0)."""
    return TaskOut(
        id=t.id,
        project_id=t.project_id,
        title=t.title,
        description=t.description,
        status=t.status,
        priority=t.priority,
        assignee=UserMini.model_validate(t.assignee) if t.assignee else None,
        due_date=t.due_date,
        position=t.position,
        created_by=t.created_by,
        created_at=t.created_at,
        updated_at=t.updated_at,
        labels=[LabelMini.model_validate(l) for l in t.labels],
        subtask_total=0,
        subtask_done=0,
        comment_count=0,
    )


@router.get("/workspaces/{workspace_id}/dashboard", response_model=DashboardOut)
async def workspace_dashboard(
    workspace_id: uuid.UUID,
    user: User = Depends(get_current_user),
    membership: Membership = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> DashboardOut:
    today = date.today()
    in_a_week = today + timedelta(days=7)
    since = today - timedelta(days=13)

    project_ids = [
        pid
        for (pid,) in (
            await db.execute(
                select(Project.id).where(
                    Project.workspace_id == workspace_id, Project.deleted_at.is_(None)
                )
            )
        ).all()
    ]

    if not project_ids:
        return DashboardOut(
            status_counts=StatusCounts(),
            overdue_count=0,
            overdue=[],
            my_open=[],
            due_today_count=0,
            due_today=[],
            due_this_week_count=0,
            due_this_week=[],
            project_progress=[],
            workload=[],
            completion_trend=[],
        )

    def base():
        return (Task.project_id.in_(project_ids), Task.deleted_at.is_(None))

    opts = (selectinload(Task.assignee), selectinload(Task.labels))

    # Each block below runs on its OWN session so they can execute concurrently.
    async def status_counts() -> StatusCounts:
        async with SessionLocal() as s:
            rows = (
                await s.execute(
                    select(Task.status, func.count(Task.id)).where(*base()).group_by(Task.status)
                )
            ).all()
        sc = StatusCounts()
        for st, n in rows:
            n = int(n)
            if st == TaskStatus.TODO:
                sc.todo = n
            elif st == TaskStatus.IN_PROGRESS:
                sc.in_progress = n
            elif st == TaskStatus.IN_REVIEW:
                sc.in_review = n
            elif st == TaskStatus.DONE:
                sc.done = n
        return sc

    async def task_list(extra_where, order_by, limit=None) -> list[TaskOut]:
        async with SessionLocal() as s:
            q = select(Task).options(*opts).where(*base(), *extra_where).order_by(*order_by)
            if limit:
                q = q.limit(limit)
            rows = (await s.execute(q)).scalars().unique().all()
            return [_task_out_lite(t) for t in rows]

    async def project_progress() -> list[ProjectProgressOut]:
        async with SessionLocal() as s:
            projs = (
                await s.execute(
                    select(Project).where(Project.id.in_(project_ids)).order_by(Project.name.asc())
                )
            ).scalars().all()
            count_rows = (
                await s.execute(
                    select(Task.project_id, Task.status, func.count(Task.id))
                    .where(Task.project_id.in_(project_ids), Task.deleted_at.is_(None))
                    .group_by(Task.project_id, Task.status)
                )
            ).all()
        totals: dict[uuid.UUID, int] = {pid: 0 for pid in project_ids}
        dones: dict[uuid.UUID, int] = {pid: 0 for pid in project_ids}
        for pid, st, n in count_rows:
            totals[pid] += int(n)
            if st == TaskStatus.DONE:
                dones[pid] += int(n)
        return [
            ProjectProgressOut(
                id=p.id,
                name=p.name,
                total=totals.get(p.id, 0),
                done=dones.get(p.id, 0),
                progress=(dones.get(p.id, 0) / totals[p.id]) if totals.get(p.id) else 0.0,
            )
            for p in projs
        ]

    async def workload() -> list[WorkloadOut]:
        async with SessionLocal() as s:
            members = (
                await s.execute(
                    select(Membership)
                    .options(selectinload(Membership.user))
                    .where(Membership.workspace_id == workspace_id)
                )
            ).scalars().all()
            open_rows = (
                await s.execute(
                    select(Task.assignee_id, func.count(Task.id))
                    .where(*base(), Task.status != TaskStatus.DONE, Task.assignee_id.is_not(None))
                    .group_by(Task.assignee_id)
                )
            ).all()
        wmap = {uid: int(n) for uid, n in open_rows}
        out = [
            WorkloadOut(user_id=m.user_id, full_name=m.user.full_name, open_count=wmap.get(m.user_id, 0))
            for m in members
        ]
        out.sort(key=lambda w: -w.open_count)
        return out

    async def completion_trend() -> list[TrendPoint]:
        async with SessionLocal() as s:
            rows = (
                await s.execute(
                    select(cast(Task.updated_at, DATE).label("d"), func.count(Task.id))
                    .where(*base(), Task.status == TaskStatus.DONE, cast(Task.updated_at, DATE) >= since)
                    .group_by("d")
                    .order_by("d")
                )
            ).all()
        tmap = {d: int(n) for d, n in rows}
        return [
            TrendPoint(day=since + timedelta(days=i), completed=tmap.get(since + timedelta(days=i), 0))
            for i in range(14)
        ]

    (sc, overdue, my_open, due_today, due_week, progress, wload, trend) = await asyncio.gather(
        status_counts(),
        task_list(
            (Task.due_date.is_not(None), Task.due_date < today, Task.status != TaskStatus.DONE),
            (Task.due_date.asc(),),
            limit=20,
        ),
        task_list(
            (Task.assignee_id == user.id, Task.status != TaskStatus.DONE),
            (Task.due_date.asc().nullslast(), Task.created_at.desc()),
            limit=20,
        ),
        task_list(
            (Task.due_date == today, Task.status != TaskStatus.DONE),
            (Task.priority.desc(), Task.title.asc()),
        ),
        task_list(
            (Task.due_date.between(today, in_a_week), Task.status != TaskStatus.DONE),
            (Task.due_date.asc(),),
        ),
        project_progress(),
        workload(),
        completion_trend(),
    )

    return DashboardOut(
        status_counts=sc,
        overdue_count=len(overdue),
        overdue=overdue,
        my_open=my_open,
        due_today_count=len(due_today),
        due_today=due_today,
        due_this_week_count=len(due_week),
        due_this_week=due_week,
        project_progress=progress,
        workload=wload,
        completion_trend=trend,
    )
