import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.auth.dependencies import CurrentUser, DbSession
from app.core.clock import get_today
from app.models import RecurringExpense
from app.schemas.common import PageParams, page_params
from app.schemas.recurring import (
    GenerateResult,
    RecurringCreate,
    RecurringOut,
    RecurringPage,
    RecurringUpdate,
)
from app.services import recurring as service

router = APIRouter(prefix="/recurring", tags=["recurring"])

Today = Annotated[dt.date, Depends(get_today)]


def _out(item: RecurringExpense, today: dt.date) -> RecurringOut:
    return RecurringOut.model_validate(item).model_copy(
        update={"next_charge_date": service.next_charge_date(item, today)}
    )


@router.get("", response_model=RecurringPage, summary="List recurring payments")
def list_recurring(
    user: CurrentUser,
    db: DbSession,
    today: Today,
    page: Annotated[PageParams, Depends(page_params)],
) -> RecurringPage:
    items, total, monthly_total = service.list_items(db, user, page)
    return RecurringPage(
        items=[_out(item, today) for item in items],
        total=total,
        page=page.page,
        page_size=page.page_size,
        monthly_total=monthly_total,
    )


@router.post(
    "/generate",
    response_model=GenerateResult,
    summary="Create the expenses for every recurring charge due up to today",
    description="Idempotent: running it again creates nothing new. Clients call it on startup.",
)
def generate(user: CurrentUser, db: DbSession, today: Today) -> GenerateResult:
    return GenerateResult(created=service.generate_due(db, user, today))


@router.post("", response_model=RecurringOut, status_code=status.HTTP_201_CREATED)
def create_recurring(
    data: RecurringCreate, user: CurrentUser, db: DbSession, today: Today
) -> RecurringOut:
    return _out(service.create_item(db, user, data, today), today)


@router.get("/{item_id}", response_model=RecurringOut)
def get_recurring(item_id: int, user: CurrentUser, db: DbSession, today: Today) -> RecurringOut:
    return _out(service.get_item(db, user, item_id), today)


@router.patch("/{item_id}", response_model=RecurringOut, summary="Update, pause or resume")
def update_recurring(
    item_id: int, data: RecurringUpdate, user: CurrentUser, db: DbSession, today: Today
) -> RecurringOut:
    return _out(service.update_item(db, user, item_id, data, today), today)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a recurring payment (expenses it already created are kept)",
)
def delete_recurring(item_id: int, user: CurrentUser, db: DbSession) -> Response:
    service.delete_item(db, user, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
