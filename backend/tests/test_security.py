"""Unit tests for core security helpers."""

import time

import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


def test_password_hash_round_trip():
    hashed = get_password_hash("Sup3rSecret!")
    assert hashed != "Sup3rSecret!"
    assert verify_password("Sup3rSecret!", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_jwt_round_trip():
    token = create_access_token("user@example.com", extra={"role": "admin"})
    payload = decode_access_token(token)
    assert payload["sub"] == "user@example.com"
    assert payload["role"] == "admin"
    assert "exp" in payload


def test_decode_invalid_token_raises():
    with pytest.raises(ValueError):
        decode_access_token("not-a-valid-jwt")