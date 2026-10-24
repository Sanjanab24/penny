import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.dependencies import CurrentUser, DbSession
from app.models import Expense
from app.schemas.common import PageParams, page_params
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseFilters,
    ExpenseOut,
    ExpensePage,
    ExpenseSort,
    ExpenseUpdate,
)
from app.services import expenses as service

router = APIRouter(prefix="/expenses", tags=["expenses"])


def expense_filters(
    date_from: dt.date | None = Query(None, description="Inclusive, YYYY-MM-DD"),
    date_to: dt.date | None = Query(None, description="Inclusive, YYYY-MM-DD"),
    category_id: int | None = None,
    q: str | None = Query(None, max_length=100, description="Search in description"),
    sort: ExpenseSort = "date_desc",
) -> ExpenseFilters:
    return ExpenseFilters(
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        q=q.strip() if q else None,
        sort=sort,
    )


@router.get("", response_model=ExpensePage, summary="List expenses (filtered, paginated)")
def list_expenses(
    user: CurrentUser,
    db: DbSession,
    filters: Annotated[ExpenseFilters, Depends(expense_filters)],
    page: Annotated[PageParams, Depends(page_params)],
) -> ExpensePage:
    items, total, total_amount = service.list_expenses(db, user, filters, page)
    return ExpensePage(
        items=[ExpenseOut.model_validate(e) for e in items],
        total=total,
        page=page.page,
        page_size=page.page_size,
        total_amount=total_amount,
    )


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(data: ExpenseCreate, user: CurrentUser, db: DbSession) -> Expense:
    return service.create_expense(db, user, data)


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: int, user: CurrentUser, db: DbSession) -> Expense:
    return service.get_expense(db, user, expense_id)


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int, data: ExpenseUpdate, user: CurrentUser, db: DbSession
) -> Expense:
    return service.update_expense(db, user, expense_id, data)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, user: CurrentUser, db: DbSession) -> Response:
    service.delete_expense(db, user, expense_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
