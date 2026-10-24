import datetime as dt
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.common import Page

# Serialized as a JSON string ("12.50") so no precision is lost in transit.
Money = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]

ExpenseSort = Literal["date_desc", "date_asc", "amount_desc", "amount_asc"]


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: Decimal
    category_id: int
    date: dt.date
    description: str
    recurring_id: int | None
    created_at: dt.datetime


class ExpenseCreate(BaseModel):
    amount: Money
    category_id: int
    date: dt.date
    description: Description = ""


class ExpenseUpdate(BaseModel):
    """PATCH body: omitted fields are left unchanged."""

    amount: Money | None = None
    category_id: int | None = None
    date: dt.date | None = None
    description: Description | None = None


class ExpenseFilters(BaseModel):
    model_config = ConfigDict(frozen=True)

    date_from: dt.date | None = None
    date_to: dt.date | None = None
    category_id: int | None = None
    q: str | None = None
    sort: ExpenseSort = "date_desc"


class ExpensePage(Page[ExpenseOut]):
    # Sum over every expense matching the filters, not just this page.
    total_amount: Decimal
