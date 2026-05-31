from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Role
from app.schemas.types import Email

_PW_RULE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")


class SignupRequest(BaseModel):
    email: Email
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        if not _PW_RULE.match(v):
            raise ValueError("Password must be 8+ chars and include a letter and a number")
        return v

    @field_validator("full_name")
    @classmethod
    def _validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("full_name is required")
        return v


class LoginRequest(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        if not _PW_RULE.match(v):
            raise ValueError("Password must be 8+ chars and include a letter and a number")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: Email
    full_name: str
    avatar_url: str | None = None
    is_active: bool
    created_at: datetime


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=500)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenOnly(BaseModel):
    access_token: str
    token_type: str = "bearer"


class WorkspaceBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class MembershipBrief(BaseModel):
    workspace: WorkspaceBrief
    role: Role


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    user: UserOut
    memberships: List[MembershipBrief]
