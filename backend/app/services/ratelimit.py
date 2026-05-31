from __future__ import annotations

from typing import Tuple

from app.core.exceptions import RateLimitError
from app.core.redis import get_redis


async def hit(key: str, limit: int, window_seconds: int) -> Tuple[int, int]:
    """Returns (count_after, ttl_seconds). Raises RateLimitError when over limit."""
    r = await get_redis()
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.ttl(key)
    count_res, ttl_res = await pipe.execute()
    count = int(count_res)
    ttl = int(ttl_res)
    if count == 1 or ttl < 0:
        await r.expire(key, window_seconds)
        ttl = window_seconds
    if count > limit:
        raise RateLimitError(f"Rate limit exceeded ({limit}/{window_seconds}s)")
    return count, ttl
