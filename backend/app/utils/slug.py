from __future__ import annotations

import re
import secrets

from slugify import slugify as _slugify


def slugify(text: str) -> str:
    s = _slugify(text)
    return s or "workspace"


def unique_slug(base: str, *, suffix_len: int = 6) -> str:
    return f"{slugify(base)}-{secrets.token_hex(suffix_len // 2)}"


_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")


def is_hex_color(value: str) -> bool:
    return bool(_HEX_COLOR.match(value))
