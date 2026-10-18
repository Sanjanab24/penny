"""Clerk session-token verification.

The frontend sends `Authorization: Bearer <token>` where the token comes from Clerk's
`getToken()`. We verify the RS256 signature against Clerk's JWKS, plus issuer, expiry and
(optionally) the `azp` claim, then map the `sub` claim to a local `users` row.
"""

import logging
from collections.abc import Callable, Iterable
from functools import lru_cache
from typing import Any, Protocol

import jwt
from jwt import PyJWKClient

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

_LEEWAY_SECONDS = 10  # tolerate small clock skew between Clerk and this server

# Given a raw JWT, return the public key that should have signed it.
KeyResolver = Callable[[str], Any]


class TokenVerifier(Protocol):
    def verify(self, token: str) -> dict[str, Any]: ...


def _unauthorized(message: str) -> AppError:
    return AppError(401, "unauthorized", message)


def jwks_key_resolver(jwks_url: str) -> KeyResolver:
    # Caches signing keys in memory; refetches when it sees an unknown `kid` (key rotation).
    client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return lambda token: client.get_signing_key_from_jwt(token).key


class ClerkTokenVerifier:
    def __init__(
        self, issuer: str, key_resolver: KeyResolver, authorized_parties: Iterable[str] = ()
    ) -> None:
        if not issuer:
            raise RuntimeError("CLERK_ISSUER is not configured")
        self._issuer = issuer.rstrip("/")
        self._resolve_key = key_resolver
        self._authorized_parties = set(authorized_parties)

    def verify(self, token: str) -> dict[str, Any]:
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                self._resolve_key(token),
                algorithms=["RS256"],
                issuer=self._issuer,
                leeway=_LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "sub", "iss"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise _unauthorized("Token expired") from exc
        except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
            raise _unauthorized("Invalid token") from exc

        # Clerk sets `azp` to the frontend origin; reject tokens minted for other sites.
        azp = claims.get("azp")
        if self._authorized_parties and azp and azp not in self._authorized_parties:
            raise _unauthorized("Token issued for an unauthorized party")
        return claims


@lru_cache
def _verifier_singleton() -> ClerkTokenVerifier:
    settings = get_settings()
    # Check before building the JWKS client, which rejects the issuer-less URL on its own.
    if not settings.clerk_issuer:
        raise RuntimeError("CLERK_ISSUER is not configured")
    return ClerkTokenVerifier(
        issuer=settings.clerk_issuer,
        key_resolver=jwks_key_resolver(settings.jwks_url),
        authorized_parties=settings.clerk_authorized_parties,
    )


def get_token_verifier() -> TokenVerifier:
    """FastAPI dependency; tests override it with a verifier backed by a local key pair."""
    try:
        return _verifier_singleton()
    except RuntimeError as exc:
        # Server misconfiguration, not a client error: log the cause, return a clear 503.
        logger.error("Auth is not configured: %s", exc)
        raise AppError(
            503, "auth_not_configured", "Authentication is not configured on the server"
        ) from exc
