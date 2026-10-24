import datetime as dt
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.common import Page
from app.schemas.expense import Money

RecurringName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]
# 29-31 are allowed; shorter months charge on their last day instead.
DayOfMonth = Annotated[int, Field(ge=1, le=31)]


class RecurringOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    amount: Decimal
    category_id: int
    day_of_month: int
    active: bool
    # Date the next expense will be created; null while paused.
    next_charge_date: dt.date | None = None
    created_at: dt.datetime


class RecurringCreate(BaseModel):
    description: RecurringName
    amount: Money
    category_id: int
    day_of_month: DayOfMonth
    active: bool = True
    # When this month's billing day has already passed, also record this month's charge now.
    charge_current_month: bool = False


class RecurringUpdate(BaseModel):
    """PATCH body: omitted fields are left unchanged. Changes apply to future charges only."""

    description: RecurringName | None = None
    amount: Money | None = None
    category_id: int | None = None
    day_of_month: DayOfMonth | None = None
    active: bool | None = None


class RecurringPage(Page[RecurringOut]):
    # Sum of all active items: what recurring payments commit each month.
    monthly_total: Decimal


class GenerateResult(BaseModel):
    created: int
