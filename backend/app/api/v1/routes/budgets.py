import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.auth.dependencies import CurrentUser, DbSession
from app.core.clock import get_today
from app.schemas.budget import BudgetIn, BudgetSummary
from app.services import budgets as service

router = APIRouter(prefix="/budgets", tags=["budgets"])

MonthPath = Annotated[str, Path(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-10"])]
Today = Annotated[dt.date, Depends(get_today)]


@router.get(
    "/{month}",
    response_model=BudgetSummary,
    summary="Budget, allocations and spending for one month",
)
def get_budget(month: MonthPath, user: CurrentUser, db: DbSession, today: Today) -> BudgetSummary:
    # A month without a budget still returns its spending, with has_budget = false.
    return service.get_summary(db, user, month, today)


@router.put(
    "/{month}",
    response_model=BudgetSummary,
    summary="Create or replace a month's budget and allocations",
)
def put_budget(
    month: MonthPath, data: BudgetIn, user: CurrentUser, db: DbSession, today: Today
) -> BudgetSummary:
    return service.save_budget(db, user, month, data, today)
