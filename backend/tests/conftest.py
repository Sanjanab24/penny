"""Test fixtures.

Uses TEST_DATABASE_URL (a disposable Postgres DB, from the environment or .env) when set,
otherwise a temporary SQLite file.
The schema is built by running the real Alembic migrations, so the default-category seed is
exercised too. Tokens are signed with a throwaway RSA key and checked by the real
ClerkTokenVerifier, only the JWKS lookup is replaced.
"""

import datetime as dt
import os
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import jwt
import pytest
from alembic import command
from alembic.config import Config
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, delete, event
from sqlalchemy.orm import Session, sessionmaker

from app.auth.clerk import ClerkTokenVerifier, get_token_verifier
from app.core.clock import get_today
from app.core.config import Settings
from app.db.session import get_db
from app.main import app
from app.models import Budget, Category, Expense, RecurringExpense, User

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_ISSUER = "https://test-clerk.example.com"
TEST_AZP = "http://localhost:3000"
# "Today" for every API test, so recurring charges and current-month logic are deterministic.
TEST_TODAY = dt.date(2026, 10, 19)

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="session")
def engine(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Engine]:
    url = os.environ.get("TEST_DATABASE_URL") or Settings().test_database_url or (
        f"sqlite:///{tmp_path_factory.mktemp('db') / 'test.db'}"
    )
    # The schema is dropped below: never run against the app's real database.
    if url == Settings().database_url:
        pytest.exit("TEST_DATABASE_URL must not be the same as DATABASE_URL", returncode=2)
    eng = create_engine(url)
    if eng.dialect.name == "sqlite":
        # SQLite ignores foreign keys unless asked; tests rely on RESTRICT/CASCADE behaviour.
        event.listen(eng, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    if eng.dialect.name != "sqlite":
        command.downgrade(cfg, "base")  # start from a clean, reused Postgres test DB
    command.upgrade(cfg, "head")
    yield eng
    eng.dispose()


@pytest.fixture()
def db_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    # Wipe user data between tests, keeping the seeded default categories.
    with factory() as db:
        for model in (Expense, RecurringExpense, Budget):
            db.execute(delete(model))
        db.execute(delete(Category).where(Category.is_default.is_(False)))
        db.execute(delete(User))
        db.commit()


@pytest.fixture()
def client(db_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    def _get_db() -> Iterator[Session]:
        with db_factory() as db:
            yield db

    verifier = ClerkTokenVerifier(
        issuer=TEST_ISSUER,
        key_resolver=lambda _token: _private_key.public_key(),
        authorized_parties=[TEST_AZP],
    )
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_token_verifier] = lambda: verifier
    app.dependency_overrides[get_today] = lambda: TEST_TODAY
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def make_token() -> Callable[..., str]:
    def _make(sub: str = "user_test_a", **overrides: object) -> str:
        now = int(time.time())
        claims: dict[str, object] = {
            "sub": sub,
            "iss": TEST_ISSUER,
            "azp": TEST_AZP,
            "iat": now,
            "nbf": now,
            "exp": now + 300,
            **overrides,
        }
        return jwt.encode(claims, _private_key, algorithm="RS256")

    return _make


@pytest.fixture()
def auth_headers(make_token: Callable[..., str]) -> Callable[[str], dict[str, str]]:
    return lambda sub="user_test_a": {"Authorization": f"Bearer {make_token(sub)}"}


@pytest.fixture()
def api(client: TestClient, auth_headers: Callable[[str], dict[str, str]]) -> Callable[..., Any]:
    """api("post", "/expenses", json=..., user="user_a") -> response."""

    def _call(method: str, path: str, user: str = "user_a", **kwargs: Any) -> Any:
        return client.request(method, f"/api/v1{path}", headers=auth_headers(user), **kwargs)

    return _call
