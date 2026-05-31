from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.comment import Comment
    from app.models.user import User


class Mention(Base, IdMixin, TimestampMixin):
    __tablename__ = "mentions"
    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_mentions_comment_user"),
    )

    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    comment: Mapped["Comment"] = relationship(back_populates="mentions")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
