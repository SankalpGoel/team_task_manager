from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import InvitationStatus, Role
from app.schemas.types import Email


class InvitationCreate(BaseModel):
    email: Email
    role: Role


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    email: Email
    role: Role
    status: InvitationStatus
    token: str
    expires_at: datetime
    created_at: datetime


class InvitationPreview(BaseModel):
    workspace_id: uuid.UUID
    workspace_name: str
    email: Email
    role: Role
    status: InvitationStatus
    expires_at: datetime
    valid: bool
