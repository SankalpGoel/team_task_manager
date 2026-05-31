from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_workspace_membership, require_role
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import (
    ConflictError,
    GoneError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.models import (
    Invitation,
    InvitationStatus,
    Membership,
    NotificationType,
    Role,
    User,
    Workspace,
)
from app.schemas.invitation import (
    InvitationCreate,
    InvitationOut,
    InvitationPreview,
)
from app.services.activity import log_activity
from app.services.email_service import render_invite_email, send_email
from app.services.notifications import create_notification
from app.services.ws_manager import notify
from app.utils.tokens import url_safe_token

router = APIRouter(tags=["invitations"])

INVITATION_TTL = timedelta(days=7)


@router.post(
    "/workspaces/{workspace_id}/invitations",
    response_model=InvitationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    workspace_id: uuid.UUID,
    payload: InvitationCreate,
    membership: Membership = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> InvitationOut:
    email = payload.email.lower().strip()

    existing_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing_user:
        already_member = (
            await db.execute(
                select(Membership).where(
                    Membership.user_id == existing_user.id,
                    Membership.workspace_id == workspace_id,
                )
            )
        ).scalar_one_or_none()
        if already_member:
            raise ConflictError("User is already a member of this workspace")

    existing_invite = (
        await db.execute(
            select(Invitation).where(
                Invitation.workspace_id == workspace_id,
                Invitation.email == email,
                Invitation.status == InvitationStatus.PENDING,
            )
        )
    ).scalar_one_or_none()
    if existing_invite:
        raise ConflictError("An invitation for this email is already pending")

    invitation = Invitation(
        workspace_id=workspace_id,
        email=email,
        role=payload.role,
        token=url_safe_token(32),
        status=InvitationStatus.PENDING,
        invited_by=membership.user_id,
        expires_at=datetime.now(timezone.utc) + INVITATION_TTL,
    )
    db.add(invitation)
    await db.flush()

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one()
    inviter = (await db.execute(select(User).where(User.id == membership.user_id))).scalar_one()
    accept_url = f"{settings.FRONTEND_URL}/invite/{invitation.token}"
    subject, html = render_invite_email(
        workspace_name=ws.name,
        inviter_name=inviter.full_name,
        accept_url=accept_url,
        role=payload.role.value,
    )
    send_email(email, subject, html)

    # If the invitee already has an account, drop the invite into their in-app
    # notification bell too (with the accept link), so email isn't the only channel.
    if existing_user:
        await create_notification(
            db,
            user_id=existing_user.id,
            type_=NotificationType.INVITATION,
            title=f"You're invited to {ws.name}",
            body=f"{inviter.full_name} invited you to join as {payload.role.value}",
            link=accept_url,
            payload={
                "invitation_id": str(invitation.id),
                "workspace_id": str(workspace_id),
                "token": invitation.token,
            },
        )

    await log_activity(
        db,
        workspace_id=workspace_id,
        actor_id=membership.user_id,
        verb="invitation.sent",
        target_type="invitation",
        target_id=invitation.id,
        meta={"email": email, "role": payload.role.value},
    )
    await db.commit()
    await db.refresh(invitation)

    # Live-nudge the invitee's bell across any workspace they're connected to.
    if existing_user:
        ws_ids = (
            await db.execute(
                select(Membership.workspace_id).where(Membership.user_id == existing_user.id)
            )
        ).scalars().all()
        for wid in ws_ids:
            await notify(wid, "notification.created", {"to": str(existing_user.id)})

    return InvitationOut.model_validate(invitation)


@router.get("/workspaces/{workspace_id}/invitations", response_model=List[InvitationOut])
async def list_pending_invitations(
    workspace_id: uuid.UUID,
    membership: Membership = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> List[InvitationOut]:
    rows = (
        await db.execute(
            select(Invitation)
            .where(
                Invitation.workspace_id == workspace_id,
                Invitation.status == InvitationStatus.PENDING,
            )
            .order_by(Invitation.created_at.desc())
        )
    ).scalars().all()
    return [InvitationOut.model_validate(i) for i in rows]


@router.delete(
    "/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    inv = (await db.execute(select(Invitation).where(Invitation.id == invitation_id))).scalar_one_or_none()
    if not inv:
        raise NotFoundError("Invitation not found")
    membership = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.workspace_id == inv.workspace_id,
            )
        )
    ).scalar_one_or_none()
    if not membership or membership.role != Role.ADMIN:
        raise NotFoundError("Invitation not found")
    inv.status = InvitationStatus.REVOKED
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/invitations/{token}", response_model=InvitationPreview)
async def preview_invitation(token: str, db: AsyncSession = Depends(get_db)) -> InvitationPreview:
    inv = (await db.execute(select(Invitation).where(Invitation.token == token))).scalar_one_or_none()
    if not inv:
        raise NotFoundError("Invitation not found")
    ws = (await db.execute(select(Workspace).where(Workspace.id == inv.workspace_id))).scalar_one()
    expires_at = inv.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    expired = expires_at < datetime.now(timezone.utc)
    valid = inv.status == InvitationStatus.PENDING and not expired and ws.deleted_at is None
    return InvitationPreview(
        workspace_id=ws.id,
        workspace_name=ws.name,
        email=inv.email,
        role=inv.role,
        status=inv.status,
        expires_at=expires_at,
        valid=valid,
    )


@router.post("/invitations/{token}/accept", response_model=InvitationOut)
async def accept_invitation(
    token: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InvitationOut:
    inv = (await db.execute(select(Invitation).where(Invitation.token == token))).scalar_one_or_none()
    if not inv:
        raise NotFoundError("Invitation not found")
    expires_at = inv.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        inv.status = InvitationStatus.EXPIRED
        await db.commit()
        raise GoneError("Invitation has expired")
    if inv.status != InvitationStatus.PENDING:
        raise GoneError("Invitation is no longer valid")

    if inv.email.lower() != user.email.lower():
        raise ValidationError("This invitation was sent to a different email address")

    existing = (
        await db.execute(
            select(Membership).where(
                Membership.user_id == user.id, Membership.workspace_id == inv.workspace_id
            )
        )
    ).scalar_one_or_none()
    if existing:
        inv.status = InvitationStatus.ACCEPTED
        await db.commit()
        await db.refresh(inv)
        return InvitationOut.model_validate(inv)

    db.add(Membership(user_id=user.id, workspace_id=inv.workspace_id, role=inv.role))
    inv.status = InvitationStatus.ACCEPTED
    await log_activity(
        db,
        workspace_id=inv.workspace_id,
        actor_id=user.id,
        verb="member.joined",
        target_type="user",
        target_id=user.id,
        meta={"via": "invitation", "role": inv.role.value},
    )
    await db.commit()
    await db.refresh(inv)
    return InvitationOut.model_validate(inv)
