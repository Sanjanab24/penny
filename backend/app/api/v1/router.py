from fastapi import APIRouter

from app.api.v1.routes import health, me
from app.schemas.common import ErrorResponse

api_router = APIRouter(
    prefix="/api/v1",
    responses={
        401: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
api_router.include_router(health.router)
api_router.include_router(me.router)
