from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None
    label_ids: List[uuid.UUID] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    priority: TaskPriority | None = None
    due_date: date | None = None
    status: TaskStatus | None = None
    assignee_id: uuid.UUID | None = None


class TaskMove(BaseModel):
    status: TaskStatus
    before_id: uuid.UUID | None = None
    after_id: uuid.UUID | None = None


class TaskAssign(BaseModel):
    assignee_id: uuid.UUID | None = None


class UserMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None = None


class LabelMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str


class SubtaskMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    is_done: bool
    position: float


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    assignee: UserMini | None = None
    due_date: date | None
    position: float
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    labels: List[LabelMini] = Field(default_factory=list)
    subtask_total: int = 0
    subtask_done: int = 0
    comment_count: int = 0


class TaskDetailOut(TaskOut):
    subtasks: List[SubtaskMini] = Field(default_factory=list)


class BoardGroup(BaseModel):
    status: TaskStatus
    items: List[TaskOut]


class BoardOut(BaseModel):
    columns: List[BoardGroup]
