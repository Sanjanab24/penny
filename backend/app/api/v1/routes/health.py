from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.auth.dependencies import DbSession

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]


@router.get("/health", response_model=HealthResponse, summary="Liveness + DB connectivity")
def health(db: DbSession) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        return HealthResponse(status="ok", database="ok")
    except Exception:
        return HealthResponse(status="degraded", database="unavailable")
