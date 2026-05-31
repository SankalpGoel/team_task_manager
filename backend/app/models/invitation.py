from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin
from app.models.enums import InvitationStatus, Role

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.workspace import Workspace


class Invitation(Base, IdMixin, TimestampMixin):
    __tablename__ = "invitations"
    __table_args__ = (
        Index("ix_invitations_email", "email"),
        Index("ix_invitations_workspace", "workspace_id"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(
        SAEnum(Role, name="invitation_role_enum", native_enum=False, length=20),
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    status: Mapped[InvitationStatus] = mapped_column(
        SAEnum(InvitationStatus, name="invitation_status_enum", native_enum=False, length=20),
        nullable=False,
        default=InvitationStatus.PENDING,
    )
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    workspace: Mapped["Workspace"] = relationship(back_populates="invitations")
    inviter: Mapped["User | None"] = relationship(foreign_keys=[invited_by])
