from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.auth.dependencies import CurrentUser
from app.models import User

router = APIRouter(tags=["auth"])


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_auth_id: str
    created_at: datetime


@router.get("/me", response_model=MeResponse, summary="Protected test endpoint: current user")
def read_me(user: CurrentUser) -> User:
    return user
