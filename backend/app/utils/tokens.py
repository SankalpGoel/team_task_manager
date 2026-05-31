from __future__ import annotations

import secrets


def url_safe_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)
