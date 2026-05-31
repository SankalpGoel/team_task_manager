from __future__ import annotations

import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    parent_id: uuid.UUID | None = None


class CommentAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    avatar_url: str | None = None


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    parent_id: uuid.UUID | None
    body: str
    author: CommentAuthor | None
    created_at: datetime
    updated_at: datetime
    mentions: List[uuid.UUID] = Field(default_factory=list)
