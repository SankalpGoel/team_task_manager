from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Date, DateTime, Enum as SAEnum, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin
from app.models.enums import TaskPriority, TaskStatus

if TYPE_CHECKING:
    from app.models.comment import Comment
    from app.models.label import Label
    from app.models.project import Project
    from app.models.subtask import Subtask
    from app.models.user import User


class Task(Base, IdMixin, TimestampMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_project_status_position", "project_id", "status", "position"),
        Index("ix_tasks_assignee", "assignee_id"),
        Index("ix_tasks_due_date", "due_date"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="task_status_enum", native_enum=False, length=20),
        nullable=False,
        default=TaskStatus.TODO,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="task_priority_enum", native_enum=False, length=20),
        nullable=False,
        default=TaskPriority.MEDIUM,
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    position: Mapped[float] = mapped_column(Float, nullable=False, default=1000.0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    project: Mapped["Project"] = relationship(back_populates="tasks")
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assignee_id])
    creator: Mapped["User | None"] = relationship(foreign_keys=[created_by])
    subtasks: Mapped[List["Subtask"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="Subtask.position"
    )
    comments: Mapped[List["Comment"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    labels: Mapped[List["Label"]] = relationship(
        secondary="task_labels", back_populates="tasks"
    )
