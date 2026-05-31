from __future__ import annotations

import uuid
from typing import List

from pydantic import BaseModel, Field


class AiResponse(BaseModel):
    text: str
    provider_used: str  # "gemini" | "groq" | "cache" | "none"
    cached: bool = False


class TaskDraftIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    context: str | None = Field(default=None, max_length=2000)


class TaskDraftOut(BaseModel):
    description: str
    acceptance_criteria: List[str]
    provider_used: str
    cached: bool = False


class SubtaskBreakdownIn(BaseModel):
    task_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=200)


class SubtaskBreakdownOut(BaseModel):
    subtasks: List[str]
    provider_used: str
    cached: bool = False


class ProjectSummaryIn(BaseModel):
    project_id: uuid.UUID


class StandupIn(BaseModel):
    workspace_id: uuid.UUID
    days: int = Field(default=7, ge=1, le=30)
