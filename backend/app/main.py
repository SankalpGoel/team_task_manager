from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import register_exception_handlers
from app.core.redis import close_redis, get_redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Warm Redis connection on startup (non-fatal if it fails)
    try:
        await get_redis()
    except Exception as e:  # pragma: no cover
        log.warning("redis init failed: %s", e)
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="Team Task Manager API",
    version="0.1.0",
    description="Multi-tenant, role-based task management SaaS.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ---- Middleware ----------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time-ms"],
)


@app.middleware("http")
async def request_id_and_timing(request: Request, call_next) -> Response:
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Request-ID"] = rid
    response.headers["X-Response-Time-ms"] = str(duration_ms)
    log.info(
        "rid=%s %s %s -> %s in %sms",
        rid,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response


# ---- Error handlers ------------------------------------------------------

register_exception_handlers(app)


# ---- Routers -------------------------------------------------------------

from app.api.routes import (  # noqa: E402
    activity,
    ai,
    auth,
    comments,
    dashboard,
    health,
    invitations,
    labels,
    notifications,
    projects,
    search,
    subtasks,
    tasks,
    workspaces,
    ws,
)

API_V1 = "/api/v1"

# Bare /health for infra probes
app.include_router(health.router, tags=["health"])

# Versioned API
app.include_router(health.router, prefix=API_V1)
app.include_router(auth.router, prefix=API_V1)
app.include_router(workspaces.router, prefix=API_V1)
app.include_router(invitations.router, prefix=API_V1)
app.include_router(projects.router, prefix=API_V1)
app.include_router(tasks.router, prefix=API_V1)
app.include_router(subtasks.router, prefix=API_V1)
app.include_router(dashboard.router, prefix=API_V1)
app.include_router(comments.router, prefix=API_V1)
app.include_router(labels.router, prefix=API_V1)
app.include_router(search.router, prefix=API_V1)
app.include_router(activity.router, prefix=API_V1)
app.include_router(notifications.router, prefix=API_V1)
app.include_router(ai.router, prefix=API_V1)
# WebSocket is mounted at the bare path (not under /api/v1)
app.include_router(ws.router)


@app.get("/")
async def root() -> dict:
    return {
        "name": "Team Task Manager API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }
