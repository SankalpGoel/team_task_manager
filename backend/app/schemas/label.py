from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.slug import is_hex_color


class LabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = Field(min_length=4, max_length=9)

    @field_validator("color")
    @classmethod
    def _validate_color(cls, v: str) -> str:
        if not is_hex_color(v):
            raise ValueError("color must be a hex color like #RRGGBB")
        return v


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    color: str
