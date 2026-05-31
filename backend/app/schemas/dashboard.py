from __future__ import annotations

import uuid
from datetime import date
from typing import Dict, List

from pydantic import BaseModel

from app.models.enums import TaskStatus
from app.schemas.task import TaskOut


class StatusCounts(BaseModel):
    todo: int = 0
    in_progress: int = 0
    in_review: int = 0
    done: int = 0


class ProjectProgressOut(BaseModel):
    id: uuid.UUID
    name: str
    total: int
    done: int
    progress: float  # 0..1


class WorkloadOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    open_count: int


class TrendPoint(BaseModel):
    day: date
    completed: int


class DashboardOut(BaseModel):
    status_counts: StatusCounts
    overdue_count: int
    overdue: List[TaskOut]
    my_open: List[TaskOut]
    due_today_count: int
    due_today: List[TaskOut]
    due_this_week_count: int
    due_this_week: List[TaskOut]
    project_progress: List[ProjectProgressOut]
    workload: List[WorkloadOut]
    completion_trend: List[TrendPoint]
