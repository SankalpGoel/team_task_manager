from datetime import timedelta

import pytest
from jose import JWTError

from app.core import security
from app.core.config import settings


def test_hash_is_not_plaintext_and_verifies():
    hashed = security.hash_password("Password123")
    assert hashed != "Password123"
    assert security.verify_password("Password123", hashed) is True


def test_verify_rejects_wrong_password():
    hashed = security.hash_password("Password123")
    assert security.verify_password("wrong", hashed) is False


def test_verify_handles_garbage_hash_gracefully():
    # Must not raise — returns False on malformed hashes.
    assert security.verify_password("x", "not-a-real-hash") is False


def test_access_token_roundtrip():
    token = security.create_access_token("user-123")
    payload = security.decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_refresh_token_has_refresh_type():
    payload = security.decode_token(security.create_refresh_token("u"))
    assert payload["type"] == "refresh"


def test_decode_rejects_tampered_token():
    token = security.create_access_token("u") + "tampered"
    with pytest.raises(JWTError):
        security.decode_token(token)


def test_decode_rejects_expired_token():
    expired = security._create_token("u", timedelta(seconds=-10), "access")
    with pytest.raises(JWTError):
        security.decode_token(expired)


def test_token_signed_with_configured_secret():
    # Sanity: secret is the test secret, not the insecure default.
    assert len(settings.JWT_SECRET) >= 32
