from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.mention import Mention
    from app.models.task import Task
    from app.models.user import User


class Comment(Base, IdMixin, TimestampMixin):
    __tablename__ = "comments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    task: Mapped["Task"] = relationship(back_populates="comments")
    author: Mapped["User | None"] = relationship(foreign_keys=[author_id])
    parent: Mapped["Comment | None"] = relationship(remote_side="Comment.id", foreign_keys=[parent_id])
    mentions: Mapped[List["Mention"]] = relationship(
        back_populates="comment", cascade="all, delete-orphan"
    )
