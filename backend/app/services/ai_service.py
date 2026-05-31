from __future__ import annotations

import hashlib
import json
import logging
import uuid
from typing import Any

from app.core.config import settings
from app.core.redis import get_redis
from app.services.ratelimit import hit

log = logging.getLogger("ai")

CACHE_TTL = 60 * 60 * 6  # 6h


def _cache_key(feature: str, payload: dict[str, Any]) -> str:
    norm = json.dumps(payload, sort_keys=True, default=str)
    h = hashlib.sha256(f"{feature}::{norm}".encode()).hexdigest()
    return f"ai:cache:{feature}:{h}"


async def _gemini(prompt: str, max_tokens: int) -> str | None:
    if not settings.GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        result = await model.generate_content_async(
            prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": 0.4},
        )
        return (result.text or "").strip() or None
    except Exception as e:
        log.warning("Gemini call failed: %s", e)
        return None


async def _groq(prompt: str, max_tokens: int) -> str | None:
    if not settings.GROQ_API_KEY:
        return None
    try:
        from groq import AsyncGroq  # type: ignore

        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        resp = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.4,
        )
        text = (resp.choices[0].message.content or "").strip()
        return text or None
    except Exception as e:
        log.warning("Groq call failed: %s", e)
        return None


async def generate(
    *,
    feature: str,
    prompt: str,
    user_id: uuid.UUID,
    payload: dict[str, Any] | None = None,
    max_tokens: int = 600,
) -> dict[str, Any]:
    """Returns {"text": str, "provider_used": str, "cached": bool}."""
    if not settings.GEMINI_API_KEY and not settings.GROQ_API_KEY:
        return {
            "text": "AI is not configured. Add GEMINI_API_KEY or GROQ_API_KEY to enable AI features.",
            "provider_used": "none",
            "cached": False,
        }

    payload = payload or {}
    key = _cache_key(feature, payload)
    r = await get_redis()
    try:
        cached = await r.get(key)
        if cached:
            return {"text": cached, "provider_used": "cache", "cached": True}
    except Exception:
        pass

    # Per-user hourly rate limit
    rl_key = f"ai:rl:{user_id}"
    await hit(rl_key, settings.AI_RATE_LIMIT_PER_HOUR, 3600)

    text = await _gemini(prompt, max_tokens)
    provider = "gemini"
    if text is None:
        text = await _groq(prompt, max_tokens)
        provider = "groq"
    if text is None:
        return {
            "text": "AI is temporarily unavailable. Please try again later.",
            "provider_used": "none",
            "cached": False,
        }

    try:
        await r.setex(key, CACHE_TTL, text)
    except Exception:
        pass

    return {"text": text, "provider_used": provider, "cached": False}
