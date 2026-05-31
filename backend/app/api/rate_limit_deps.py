from __future__ import annotations

from fastapi import Request

from app.services.ratelimit import hit


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limit_per_ip(bucket: str, *, limit: int, window_seconds: int):
    """Returns a FastAPI dependency that enforces a per-IP Redis rate limit."""

    async def _dep(request: Request) -> None:
        ip = _client_ip(request)
        await hit(f"rl:{bucket}:{ip}", limit, window_seconds)

    return _dep
