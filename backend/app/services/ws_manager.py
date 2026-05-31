from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from app.core.redis import get_redis

log = logging.getLogger("ws")


class ConnectionManager:
    """Maps workspace_id -> set of local WebSocket connections.

    Cross-instance broadcast is done via Redis pub/sub: every server instance subscribes
    to ws:* channels and forwards messages to its local subscribers.
    """

    def __init__(self) -> None:
        self._local: dict[uuid.UUID, set[WebSocket]] = {}
        self._pubsub_task: asyncio.Task | None = None
        self._pubsub_started = False
        self._lock = asyncio.Lock()

    async def connect(self, workspace_id: uuid.UUID, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._local.setdefault(workspace_id, set()).add(ws)
            await self._ensure_pubsub()

    async def disconnect(self, workspace_id: uuid.UUID, ws: WebSocket) -> None:
        async with self._lock:
            self._local.get(workspace_id, set()).discard(ws)
            if not self._local.get(workspace_id):
                self._local.pop(workspace_id, None)

    async def broadcast(self, workspace_id: uuid.UUID, event: dict[str, Any]) -> None:
        payload = json.dumps(event, default=str)
        try:
            r = await get_redis()
            await r.publish(f"ws:{workspace_id}", payload)
        except Exception as e:
            log.warning("publish failed, falling back to local fan-out: %s", e)
            await self._fan_out_local(workspace_id, payload)

    async def _fan_out_local(self, workspace_id: uuid.UUID, payload: str) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._local.get(workspace_id, set())):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(workspace_id, ws)

    async def _ensure_pubsub(self) -> None:
        if self._pubsub_started:
            return
        self._pubsub_started = True
        self._pubsub_task = asyncio.create_task(self._pubsub_loop())

    async def _pubsub_loop(self) -> None:
        try:
            r: Redis = await get_redis()
            pubsub = r.pubsub()
            await pubsub.psubscribe("ws:*")
            async for msg in pubsub.listen():
                if msg is None:
                    continue
                if msg.get("type") != "pmessage":
                    continue
                channel = msg.get("channel", "")
                if isinstance(channel, bytes):
                    channel = channel.decode()
                if not channel.startswith("ws:"):
                    continue
                try:
                    wid = uuid.UUID(channel.split(":", 1)[1])
                except (ValueError, IndexError):
                    continue
                data = msg.get("data", "")
                if isinstance(data, bytes):
                    data = data.decode()
                await self._fan_out_local(wid, data)
        except Exception as e:
            log.warning("pubsub loop ended: %s", e)
            self._pubsub_started = False


manager = ConnectionManager()


async def notify(
    workspace_id: uuid.UUID,
    type_: str,
    payload: dict[str, Any] | None = None,
    **extra: Any,
) -> None:
    """Fire-and-forget broadcast helper for mutation routes.

    Never raises — a failed broadcast must not break the HTTP request that
    triggered the mutation. The actual fan-out happens via Redis pub/sub
    inside ConnectionManager.broadcast.
    """
    event: dict[str, Any] = {"type": type_}
    if payload is not None:
        event["payload"] = payload
    event.update(extra)
    try:
        await manager.broadcast(workspace_id, event)
    except Exception as e:  # pragma: no cover - defensive
        log.warning("notify(%s) failed: %s", type_, e)
