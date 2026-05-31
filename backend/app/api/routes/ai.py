from __future__ import annotations

import json
import re
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    require_membership_for_workspace,
)
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models import ActivityLog, Project, Task, User
from app.schemas.ai import (
    AiResponse,
    ProjectSummaryIn,
    StandupIn,
    SubtaskBreakdownIn,
    SubtaskBreakdownOut,
    TaskDraftIn,
    TaskDraftOut,
)
from app.services.ai_service import generate

router = APIRouter(prefix="/ai", tags=["ai"])


def _parse_lines(text: str) -> list[str]:
    items: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        line = re.sub(r"^[\-\*\u2022\d\.\)]+\s*", "", line).strip()
        if line:
            items.append(line[:200])
    return items[:10]


@router.post("/project-summary", response_model=AiResponse)
async def project_summary(
    payload: ProjectSummaryIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AiResponse:
    proj = (
        await db.execute(
            select(Project).where(Project.id == payload.project_id, Project.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if not proj:
        raise NotFoundError("Project not found")
    await require_membership_for_workspace(db, user, proj.workspace_id)

    tasks = (
        await db.execute(
            select(Task)
            .where(Task.project_id == proj.id, Task.deleted_at.is_(None))
            .order_by(Task.status, Task.created_at.desc())
            .limit(60)
        )
    ).scalars().all()

    lines = [
        f"- [{t.status.value}/{t.priority.value}] {t.title}"
        f"{(' (due ' + t.due_date.isoformat() + ')') if t.due_date else ''}"
        for t in tasks
    ]
    body = "\n".join(lines) or "(no tasks yet)"
    prompt = (
        "You are a senior engineering manager. Write a 4-6 sentence executive summary of this "
        "project's status: highlight progress, blockers, and upcoming work. Be specific.\n\n"
        f"Project: {proj.name}\n"
        f"Description: {proj.description or '(none)'}\n\n"
        f"Tasks:\n{body}\n"
    )
    res = await generate(
        feature="project_summary",
        prompt=prompt,
        user_id=user.id,
        payload={"project_id": str(proj.id), "n": len(tasks)},
        max_tokens=400,
    )
    return AiResponse(**res)


@router.post("/task-draft", response_model=TaskDraftOut)
async def task_draft(
    payload: TaskDraftIn,
    user: User = Depends(get_current_user),
) -> TaskDraftOut:
    prompt = (
        "Draft a concise task description and 3-6 acceptance criteria for the following task. "
        "Return STRICT JSON of the form {\"description\": \"...\", \"acceptance_criteria\": [\"...\"]}\n\n"
        f"Title: {payload.title}\n"
        f"Context: {payload.context or '(none)'}\n"
    )
    res = await generate(
        feature="task_draft",
        prompt=prompt,
        user_id=user.id,
        payload={"title": payload.title, "context": payload.context or ""},
        max_tokens=500,
    )
    text = res["text"]
    description = text
    criteria: list[str] = []
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            obj = json.loads(match.group(0))
            description = str(obj.get("description") or text).strip()
            ac = obj.get("acceptance_criteria") or []
            if isinstance(ac, list):
                criteria = [str(x).strip()[:200] for x in ac if x][:8]
    except Exception:
        pass
    return TaskDraftOut(
        description=description,
        acceptance_criteria=criteria,
        provider_used=res["provider_used"],
        cached=res["cached"],
    )


@router.post("/subtask-breakdown", response_model=SubtaskBreakdownOut)
async def subtask_breakdown(
    payload: SubtaskBreakdownIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubtaskBreakdownOut:
    title = payload.title
    if payload.task_id and not title:
        t = (
            await db.execute(select(Task).where(Task.id == payload.task_id, Task.deleted_at.is_(None)))
        ).scalar_one_or_none()
        if not t:
            raise NotFoundError("Task not found")
        proj = (await db.execute(select(Project).where(Project.id == t.project_id))).scalar_one()
        await require_membership_for_workspace(db, user, proj.workspace_id)
        title = t.title
    if not title:
        title = "(untitled task)"

    prompt = (
        "Break this task into 3-7 small, concrete subtasks. Output one subtask per line, no "
        "numbering or bullets, max 80 characters each.\n\n"
        f"Task: {title}\n"
    )
    res = await generate(
        feature="subtask_breakdown",
        prompt=prompt,
        user_id=user.id,
        payload={"title": title},
        max_tokens=300,
    )
    return SubtaskBreakdownOut(
        subtasks=_parse_lines(res["text"]),
        provider_used=res["provider_used"],
        cached=res["cached"],
    )


@router.post("/standup", response_model=AiResponse)
async def standup(
    payload: StandupIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AiResponse:
    await require_membership_for_workspace(db, user, payload.workspace_id)
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=payload.days)
    rows = (
        await db.execute(
            select(ActivityLog)
            .where(ActivityLog.workspace_id == payload.workspace_id, ActivityLog.created_at >= since)
            .order_by(ActivityLog.created_at.desc())
            .limit(150)
        )
    ).scalars().all()
    lines = [f"- {a.created_at.date().isoformat()} {a.verb} ({a.target_type})" for a in rows]
    body = "\n".join(lines) or "(no recent activity)"
    prompt = (
        f"Summarise the last {payload.days} days of team activity into a short standup digest "
        "(4-6 bullets). Highlight what shipped, what's in progress, and any risks.\n\n"
        f"{body}\n"
    )
    res = await generate(
        feature="standup",
        prompt=prompt,
        user_id=user.id,
        payload={"workspace_id": str(payload.workspace_id), "days": payload.days, "n": len(rows)},
        max_tokens=500,
    )
    return AiResponse(**res)
