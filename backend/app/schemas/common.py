from __future__ import annotations

from typing import Any, Generic, List, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: dict[str, Any] = {}


class ErrorResponse(BaseModel):
    detail: ErrorDetail


class MessageResponse(BaseModel):
    message: str
