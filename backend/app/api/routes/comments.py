from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_membership_for_workspace
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models import (
    Comment,
    Membership,
    Mention,
    NotificationType,
    Project,
    Role,
    Task,
    User,
)
from app.schemas.comment import CommentAuthor, CommentCreate, CommentOut
from app.services.activity import log_activity
from app.services.email_service import render_mention_email, send_email
from app.services.notifications import create_notification
from app.services.ws_manager import notify

router = APIRouter(tags=["comments"])

MENTION_RE = re.compile(r"@([\w\.\-+]+)")


async def _resolve_task(task_id: uuid.UUID, user: User, db: AsyncSession) -> tuple[Task, Project, Membership]:
    task = (
        await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    ).scalar_one_or_none()
    if not task:
        raise NotFoundError("Task not found")
    proj = (await db.execute(select(Project).where(Project.id == task.project_id))).scalar_one()
    membership = await require_membership_for_workspace(db, user, proj.workspace_id)
    return task, proj, membership


async def _parse_mentions(
    db: AsyncSession, body: str, workspace_id: uuid.UUID
) -> list[User]:
    handles = {m.group(1).lower() for m in MENTION_RE.finditer(body)}
    if not handles:
        return []

    rows = (
        await db.execute(
            select(User)
            .join(Membership, Membership.user_id == User.id)
            .where(Membership.workspace_id == workspace_id)
        )
    ).scalars().unique().all()

    resolved: list[User] = []
    for u in rows:
        full = u.full_name.lower().replace(" ", "")
        local = u.email.split("@")[0].lower()
        if full in handles or local in handles or u.email.lower() in handles:
            resolved.append(u)
    return resolved


@router.post(
    "/tasks/{task_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    task_id: uuid.UUID,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentOut:
    task, project, _ = await _resolve_task(task_id, user, db)

    parent = None
    if payload.parent_id:
        parent = (
            await db.execute(
                select(Comment).where(Comment.id == payload.parent_id, Comment.task_id == task_id)
            )
        ).scalar_one_or_none()
        if not parent:
            raise NotFoundError("Parent comment not found")

    comment = Comment(
        task_id=task_id,
        author_id=user.id,
        parent_id=parent.id if parent else None,
        body=payload.body.strip(),
    )
    db.add(comment)
    await db.flush()

    mentioned = await _parse_mentions(db, comment.body, project.workspace_id)
    mention_ids: list[uuid.UUID] = []
    for mu in mentioned:
        db.add(Mention(comment_id=comment.id, user_id=mu.id))
        mention_ids.append(mu.id)
        if mu.id == user.id:
            continue
        link = f"{settings.FRONTEND_URL}/app/projects/{project.id}/board?task={task_id}"
        await create_notification(
            db,
            user_id=mu.id,
            type_=NotificationType.MENTION,
            title=f"{user.full_name} mentioned you",
            body=f"on “{task.title}”",
            link=link,
            payload={"task_id": str(task_id), "comment_id": str(comment.id)},
        )
        subject, html = render_mention_email(
            actor_name=user.full_name,
            task_title=task.title,
            snippet=comment.body[:240],
            link=link,
        )
        send_email(mu.email, subject, html)

    await log_activity(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        verb="comment.created",
        target_type="comment",
        target_id=comment.id,
        meta={"task_id": str(task_id)},
    )
    await db.commit()
    await notify(
        project.workspace_id,
        "comment.created",
        {"task_id": str(task_id), "comment_id": str(comment.id)},
    )

    fresh = (
        await db.execute(
            select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
        )
    ).scalar_one()

    return CommentOut(
        id=fresh.id,
        task_id=fresh.task_id,
        parent_id=fresh.parent_id,
        body=fresh.body,
        author=CommentAuthor.model_validate(fresh.author) if fresh.author else None,
        created_at=fresh.created_at,
        updated_at=fresh.updated_at,
        mentions=mention_ids,
    )


@router.get("/tasks/{task_id}/comments", response_model=List[CommentOut])
async def list_comments(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CommentOut]:
    await _resolve_task(task_id, user, db)
    rows = (
        await db.execute(
            select(Comment)
            .options(selectinload(Comment.author), selectinload(Comment.mentions))
            .where(Comment.task_id == task_id, Comment.deleted_at.is_(None))
            .order_by(Comment.created_at.asc())
        )
    ).scalars().unique().all()
    return [
        CommentOut(
            id=c.id,
            task_id=c.task_id,
            parent_id=c.parent_id,
            body=c.body,
            author=CommentAuthor.model_validate(c.author) if c.author else None,
            created_at=c.created_at,
            updated_at=c.updated_at,
            mentions=[m.user_id for m in c.mentions],
        )
        for c in rows
    ]


@router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_comment(
    comment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    cmt = (
        await db.execute(select(Comment).where(Comment.id == comment_id, Comment.deleted_at.is_(None)))
    ).scalar_one_or_none()
    if not cmt:
        raise NotFoundError("Comment not found")
    task = (await db.execute(select(Task).where(Task.id == cmt.task_id))).scalar_one()
    project = (await db.execute(select(Project).where(Project.id == task.project_id))).scalar_one()
    m = await require_membership_for_workspace(db, user, project.workspace_id)
    if cmt.author_id != user.id and m.role not in (Role.ADMIN, Role.MANAGER):
        raise ForbiddenError("Only the author, admins or managers can delete this comment")
    cmt.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    await notify(
        project.workspace_id,
        "comment.deleted",
        {"task_id": str(cmt.task_id), "comment_id": str(cmt.id)},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
