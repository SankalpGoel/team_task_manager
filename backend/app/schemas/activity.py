from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ActivityActor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    avatar_url: str | None = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    actor: ActivityActor | None
    verb: str
    target_type: str
    target_id: uuid.UUID | None
    meta: dict[str, Any] | None
    created_at: datetime
