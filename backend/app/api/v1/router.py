from fastapi import APIRouter

from app.api.v1.routes import ai, analytics, budgets, categories, expenses, health, me, recurring
from app.schemas.common import ErrorResponse

api_router = APIRouter(
    prefix="/api/v1",
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(categories.router)
api_router.include_router(expenses.router)
api_router.include_router(budgets.router)
api_router.include_router(recurring.router)
api_router.include_router(analytics.router)
api_router.include_router(ai.router)
