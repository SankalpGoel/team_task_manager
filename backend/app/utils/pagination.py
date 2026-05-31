from __future__ import annotations

from typing import Generic, List, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def page_params(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> PageParams:
    return PageParams(page=page, size=size)


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int


async def paginate(
    db: AsyncSession,
    stmt: Select,
    params: PageParams,
) -> tuple[list, int, int]:
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int((await db.execute(count_stmt)).scalar() or 0)
    paged = stmt.offset(params.offset).limit(params.size)
    rows = (await db.execute(paged)).scalars().all()
    pages = (total + params.size - 1) // params.size if params.size else 1
    return list(rows), total, pages
