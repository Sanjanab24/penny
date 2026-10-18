"""Phase 1: health check, auth wiring, default category seed, error envelope."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.auth import clerk
from app.auth.clerk import get_token_verifier
from app.core.config import Settings
from app.main import app
from app.models import Category, User

DEFAULT_NAMES = {"Food", "Shopping", "Transportation", "Groceries", "Bills", "Subscriptions", "Other"}


def test_health_ok(client: TestClient) -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_default_categories_seeded(db_factory: sessionmaker[Session]) -> None:
    with db_factory() as db:
        rows = db.scalars(select(Category).where(Category.is_default.is_(True))).all()
    assert {c.name for c in rows} == DEFAULT_NAMES
    assert all(c.user_id is None for c in rows)


def test_me_requires_token(client: TestClient) -> None:
    res = client.get("/api/v1/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthorized"


def test_me_rejects_garbage_token(client: TestClient) -> None:
    res = client.get("/api/v1/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid token"


def test_me_rejects_expired_token(client: TestClient, make_token: Callable[..., str]) -> None:
    token = make_token(exp=1, iat=0, nbf=0)
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Token expired"


def test_me_rejects_wrong_issuer(client: TestClient, make_token: Callable[..., str]) -> None:
    token = make_token(iss="https://evil.example.com")
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_me_rejects_unauthorized_party(client: TestClient, make_token: Callable[..., str]) -> None:
    token = make_token(azp="https://evil.example.com")
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_me_provisions_user_once(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    db_factory: sessionmaker[Session],
) -> None:
    first = client.get("/api/v1/me", headers=auth_headers("user_a"))
    second = client.get("/api/v1/me", headers=auth_headers("user_a"))
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["external_auth_id"] == "user_a"
    with db_factory() as db:
        assert len(db.scalars(select(User)).all()) == 1


def test_distinct_users_get_distinct_rows(
    client: TestClient, auth_headers: Callable[[str], dict[str, str]]
) -> None:
    a = client.get("/api/v1/me", headers=auth_headers("user_a")).json()
    b = client.get("/api/v1/me", headers=auth_headers("user_b")).json()
    assert a["id"] != b["id"]


def test_missing_clerk_issuer_returns_503(
    client: TestClient, make_token: Callable[..., str], monkeypatch: pytest.MonkeyPatch
) -> None:
    # Use the real verifier dependency, built from settings with no issuer.
    app.dependency_overrides.pop(get_token_verifier)
    monkeypatch.setattr(clerk, "get_settings", lambda: Settings(clerk_issuer=""))
    clerk._verifier_singleton.cache_clear()
    try:
        res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {make_token()}"})
    finally:
        clerk._verifier_singleton.cache_clear()
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "auth_not_configured"


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    res = client.get("/api/v1/does-not-exist")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"
