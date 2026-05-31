from __future__ import annotations

import uuid
from typing import Callable

from fastapi import Depends, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import decode_token
from app.models import Membership, Role, User, Workspace

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Missing bearer token")
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")
    if payload.get("type") != "access":
        raise UnauthorizedError("Wrong token type")
    sub = payload.get("sub")
    if not sub:
        raise UnauthorizedError("Invalid token payload")
    try:
        uid = uuid.UUID(sub)
    except (ValueError, TypeError):
        raise UnauthorizedError("Invalid token payload")
    user = (
        await db.execute(select(User).where(User.id == uid, User.is_active.is_(True)))
    ).scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found or inactive")
    return user


async def get_workspace_membership(
    workspace_id: uuid.UUID = Path(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Membership:
    ws = (
        await db.execute(
            select(Workspace).where(
                Workspace.id == workspace_id, Workspace.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if not ws:
        raise NotFoundError("Workspace not found")
    m = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.workspace_id == workspace_id,
            )
        )
    ).scalar_one_or_none()
    if not m:
        # Don't leak that the workspace exists
        raise NotFoundError("Workspace not found")
    return m


def require_role(*allowed: Role) -> Callable:
    async def _dep(membership: Membership = Depends(get_workspace_membership)) -> Membership:
        if membership.role not in allowed:
            raise ForbiddenError("Insufficient role for this action")
        return membership

    return _dep


async def require_membership_for_workspace(
    db: AsyncSession,
    user: User,
    workspace_id: uuid.UUID,
    *allowed_roles: Role,
) -> Membership:
    """Helper for routes whose workspace_id comes from a parent resource (not path)."""
    m = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.workspace_id == workspace_id,
            )
        )
    ).scalar_one_or_none()
    if not m:
        raise NotFoundError("Resource not found")
    if allowed_roles and m.role not in allowed_roles:
        raise ForbiddenError("Insufficient role for this action")
    return m
