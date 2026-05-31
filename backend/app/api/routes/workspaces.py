from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, Path, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_user,
    get_workspace_membership,
    require_role,
)
from app.core.database import get_db
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models import Membership, Role, User, Workspace
from app.schemas.workspace import (
    MemberOut,
    MemberRoleUpdate,
    MemberUser,
    WorkspaceCreate,
    WorkspaceOut,
    WorkspaceUpdate,
    WorkspaceWithRole,
)
from app.services.activity import log_activity
from app.utils.slug import unique_slug

router = APIRouter(tags=["workspaces"])


@router.post("/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceOut:
    name = payload.name.strip()
    workspace = Workspace(name=name, slug=unique_slug(name), owner_id=user.id)
    db.add(workspace)
    await db.flush()
    db.add(Membership(user_id=user.id, workspace_id=workspace.id, role=Role.ADMIN))
    await db.commit()
    await db.refresh(workspace)
    return WorkspaceOut.model_validate(workspace)


@router.get("/workspaces", response_model=List[WorkspaceWithRole])
async def list_my_workspaces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[WorkspaceWithRole]:
    rows = (
        await db.execute(
            select(Membership)
            .options(selectinload(Membership.workspace))
            .where(Membership.user_id == user.id)
        )
    ).scalars().all()
    result: list[WorkspaceWithRole] = []
    for m in rows:
        if m.workspace.deleted_at is not None:
            continue
        result.append(
            WorkspaceWithRole(
                id=m.workspace.id,
                name=m.workspace.name,
                slug=m.workspace.slug,
                owner_id=m.workspace.owner_id,
                created_at=m.workspace.created_at,
                updated_at=m.workspace.updated_at,
                role=m.role,
            )
        )
    return result


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: uuid.UUID,
    membership: Membership = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceOut:
    ws = (
        await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ).scalar_one_or_none()
    if not ws:
        raise NotFoundError("Workspace not found")
    return WorkspaceOut.model_validate(ws)


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
async def update_workspace(
    workspace_id: uuid.UUID,
    payload: WorkspaceUpdate,
    membership: Membership = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceOut:
    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    if not ws:
        raise NotFoundError("Workspace not found")
    ws.name = payload.name.strip()
    await log_activity(
        db,
        workspace_id=ws.id,
        actor_id=membership.user_id,
        verb="workspace.renamed",
        target_type="workspace",
        target_id=ws.id,
        meta={"name": ws.name},
    )
    await db.commit()
    await db.refresh(ws)
    return WorkspaceOut.model_validate(ws)


@router.delete(
    "/workspaces/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_workspace(
    workspace_id: uuid.UUID,
    membership: Membership = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    if not ws:
        raise NotFoundError("Workspace not found")
    if ws.owner_id != membership.user_id:
        raise ForbiddenError("Only the workspace owner can delete it")
    from datetime import datetime, timezone

    ws.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/workspaces/{workspace_id}/members", response_model=List[MemberOut])
async def list_members(
    workspace_id: uuid.UUID,
    membership: Membership = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> List[MemberOut]:
    rows = (
        await db.execute(
            select(Membership)
            .options(selectinload(Membership.user))
            .where(Membership.workspace_id == workspace_id)
            .order_by(Membership.created_at.asc())
        )
    ).scalars().all()
    return [
        MemberOut(
            user=MemberUser.model_validate(m.user),
            role=m.role,
            joined_at=m.created_at,
            membership_id=m.id,
        )
        for m in rows
    ]


@router.patch("/workspaces/{workspace_id}/members/{user_id}", response_model=MemberOut)
async def change_member_role(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: MemberRoleUpdate,
    membership: Membership = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MemberOut:
    if user_id == membership.user_id and payload.role != Role.ADMIN:
        raise ValidationError("You cannot demote yourself")

    target = (
        await db.execute(
            select(Membership)
            .options(selectinload(Membership.user))
            .where(Membership.workspace_id == workspace_id, Membership.user_id == user_id)
        )
    ).scalar_one_or_none()
    if not target:
        raise NotFoundError("Member not found")

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one()
    if target.user_id == ws.owner_id and payload.role != Role.ADMIN:
        raise ValidationError("Cannot demote the workspace owner")

    if target.role == Role.ADMIN and payload.role != Role.ADMIN:
        admin_count = (
            await db.execute(
                select(Membership).where(
                    Membership.workspace_id == workspace_id, Membership.role == Role.ADMIN
                )
            )
        ).scalars().all()
        if len(admin_count) <= 1:
            raise ValidationError("At least one admin is required")

    target.role = payload.role
    await log_activity(
        db,
        workspace_id=workspace_id,
        actor_id=membership.user_id,
        verb="member.role_changed",
        target_type="user",
        target_id=user_id,
        meta={"role": payload.role.value},
    )
    await db.commit()
    await db.refresh(target)
    return MemberOut(
        user=MemberUser.model_validate(target.user),
        role=target.role,
        joined_at=target.created_at,
        membership_id=target.id,
    )


@router.delete(
    "/workspaces/{workspace_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def remove_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    membership: Membership = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Response:
    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one()
    if user_id == ws.owner_id:
        raise ForbiddenError("Cannot remove the workspace owner")

    target = (
        await db.execute(
            select(Membership).where(
                Membership.workspace_id == workspace_id, Membership.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not target:
        raise NotFoundError("Member not found")

    if target.role == Role.ADMIN:
        admin_count = (
            await db.execute(
                select(Membership).where(
                    Membership.workspace_id == workspace_id, Membership.role == Role.ADMIN
                )
            )
        ).scalars().all()
        if len(admin_count) <= 1:
            raise ValidationError("At least one admin is required")

    await db.delete(target)
    await log_activity(
        db,
        workspace_id=workspace_id,
        actor_id=membership.user_id,
        verb="member.removed",
        target_type="user",
        target_id=user_id,
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
