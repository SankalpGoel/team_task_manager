from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.workspace import Workspace


class Label(Base, IdMixin, TimestampMixin):
    __tablename__ = "labels"
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_labels_workspace_name"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    color: Mapped[str] = mapped_column(String(9), nullable=False)  # #RRGGBB or #RRGGBBAA

    workspace: Mapped["Workspace"] = relationship(back_populates="labels")
    tasks: Mapped[List["Task"]] = relationship(secondary="task_labels", back_populates="labels")
