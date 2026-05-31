from __future__ import annotations

import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Role
from app.schemas.types import Email


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class WorkspaceWithRole(WorkspaceOut):
    role: Role


class MemberUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: Email
    full_name: str
    avatar_url: str | None = None


class MemberOut(BaseModel):
    user: MemberUser
    role: Role
    joined_at: datetime
    membership_id: uuid.UUID


class MemberRoleUpdate(BaseModel):
    role: Role
