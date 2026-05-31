from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.models import Membership, User
from app.services.ws_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    workspace_id: uuid.UUID = Query(...),
) -> None:
    try:
        payload = decode_token(token)
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    sub = payload.get("sub")
    try:
        uid = uuid.UUID(sub) if sub else None
    except ValueError:
        uid = None
    if uid is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Verify membership
    async with SessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == uid, User.is_active.is_(True)))).scalar_one_or_none()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        membership = (
            await db.execute(
                select(Membership).where(
                    Membership.user_id == uid, Membership.workspace_id == workspace_id
                )
            )
        ).scalar_one_or_none()
        if not membership:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect(workspace_id, websocket)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if msg.lower() == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text('{"type":"ping"}')
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(workspace_id, websocket)
