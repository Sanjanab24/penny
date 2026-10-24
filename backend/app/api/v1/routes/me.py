import datetime as dt

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.auth.dependencies import CurrentUser, DbSession
from app.models import User
from app.schemas.profile import ProfileOut, ProfileUpdate

router = APIRouter(tags=["auth"])


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_auth_id: str
    created_at: dt.datetime


@router.get("/me", response_model=MeResponse, summary="Protected test endpoint: current user")
def read_me(user: CurrentUser) -> User:
    return user


def _profile(user: User) -> ProfileOut:
    return ProfileOut.model_validate(
        {"age": user.age, "occupation": user.occupation, "onboarded": user.onboarded_at is not None}
    )


@router.get("/me/profile", response_model=ProfileOut, tags=["profile"], summary="Your profile")
def read_profile(user: CurrentUser) -> ProfileOut:
    return _profile(user)


@router.put(
    "/me/profile",
    response_model=ProfileOut,
    tags=["profile"],
    summary="Save your profile (also marks onboarding as done)",
    description="Send `{}` to skip onboarding without sharing anything.",
)
def update_profile(data: ProfileUpdate, user: CurrentUser, db: DbSession) -> ProfileOut:
    user.age = data.age
    user.occupation = data.occupation
    if user.onboarded_at is None:
        user.onboarded_at = dt.datetime.now(dt.UTC)
    db.commit()
    return _profile(user)
