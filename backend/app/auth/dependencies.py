from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.clerk import TokenVerifier, get_token_verifier
from app.core.errors import AppError
from app.db.session import get_db
from app.models import User

_bearer = HTTPBearer(auto_error=False, description="Clerk session token")


def _get_or_create_user(db: Session, external_auth_id: str) -> User:
    """Users are provisioned lazily on their first authenticated request."""
    user = db.scalar(select(User).where(User.external_auth_id == external_auth_id))
    if user:
        return user
    user = User(external_auth_id=external_auth_id)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two concurrent first requests raced to insert; the other one won.
        db.rollback()
        user = db.scalars(select(User).where(User.external_auth_id == external_auth_id)).one()
    return user


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(401, "unauthorized", "Missing bearer token")
    claims = verifier.verify(credentials.credentials)
    return _get_or_create_user(db, str(claims["sub"]))


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
