from __future__ import annotations

import uuid
from typing import List

from pydantic import BaseModel

from app.models.enums import TaskPriority, TaskStatus


class ProjectHit(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None


class TaskHit(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    status: TaskStatus
    priority: TaskPriority


class SearchResults(BaseModel):
    projects: List[ProjectHit]
    tasks: List[TaskHit]
