import re

from app.utils.slug import is_hex_color, slugify, unique_slug
from app.utils.tokens import url_safe_token


def test_slugify_basic():
    assert slugify("Acme Inc") == "acme-inc"


def test_slugify_empty_falls_back():
    assert slugify("!!!") == "workspace"


def test_unique_slug_has_suffix_and_is_unique():
    a = unique_slug("Acme Inc")
    b = unique_slug("Acme Inc")
    assert a.startswith("acme-inc-")
    assert a != b


def test_url_safe_token_unique_and_urlsafe():
    a = url_safe_token()
    b = url_safe_token()
    assert a != b
    assert re.fullmatch(r"[A-Za-z0-9_\-]+", a)


def test_is_hex_color_accepts_rgb_and_rgba():
    assert is_hex_color("#aabbcc")
    assert is_hex_color("#AABBCCDD")


def test_is_hex_color_rejects_bad_values():
    assert not is_hex_color("aabbcc")  # missing #
    assert not is_hex_color("#xyzxyz")
    assert not is_hex_color("#fff")  # 3-digit shorthand not allowed
