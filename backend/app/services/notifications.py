from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, NotificationType


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type_: NotificationType,
    title: str,
    body: str,
    link: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        body=body,
        link=link,
        payload=payload,
    )
    db.add(n)
    await db.flush()
    return n
