import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import CurrentUser, DbSession
from app.core.clock import get_today
from app.schemas.analytics import MonthComparison, MonthSummary, Savings, Trends
from app.services import analytics as service

router = APIRouter(prefix="/analytics", tags=["analytics"])

_MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"
Today = Annotated[dt.date, Depends(get_today)]
# Optional everywhere: defaults to the current month.
MonthQuery = Annotated[
    str | None, Query(pattern=_MONTH_PATTERN, description="YYYY-MM; defaults to this month")
]


@router.get("/summary", response_model=MonthSummary, summary="Category breakdown for a month")
def summary(
    user: CurrentUser, db: DbSession, today: Today, month: MonthQuery = None
) -> MonthSummary:
    return service.month_summary(db, user, month or service.month_of(today), today)


@router.get("/trends", response_model=Trends, summary="Monthly spending totals over time")
def trends(
    user: CurrentUser,
    db: DbSession,
    today: Today,
    months: Annotated[int, Query(ge=1, le=24, description="How many months to include")] = 6,
    end: MonthQuery = None,
) -> Trends:
    return service.trends(db, user, end or service.month_of(today), months)


@router.get("/compare", response_model=MonthComparison, summary="A month vs the month before")
def compare(
    user: CurrentUser, db: DbSession, today: Today, month: MonthQuery = None
) -> MonthComparison:
    return service.compare(db, user, month or service.month_of(today))


@router.get(
    "/savings",
    response_model=Savings,
    summary="Saved per month (budget minus spending)",
    description="Months without a budget have `saved: null`. Totals count complete months only.",
)
def savings(
    user: CurrentUser,
    db: DbSession,
    today: Today,
    months: Annotated[int, Query(ge=1, le=24, description="How many months to include")] = 6,
    end: MonthQuery = None,
) -> Savings:
    return service.savings(db, user, end or service.month_of(today), months, today)
