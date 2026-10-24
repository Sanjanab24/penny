from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class CategoryRef(BaseModel):
    category_id: int
    name: str
    color: str
    icon: str


class CategorySpend(CategoryRef):
    amount: Decimal
    # Share of the month's total, to one decimal place.
    percent: Decimal
    expense_count: int


class MonthSummary(BaseModel):
    month: str
    total: Decimal
    expense_count: int
    # Total / days so far (current month) or days in the month (past months).
    daily_average: Decimal
    # Every category with spending this month, largest first.
    categories: list[CategorySpend]


class TrendPoint(BaseModel):
    month: str
    total: Decimal
    # The month's budget total, or null when none was set.
    budget: Decimal | None


class Trends(BaseModel):
    # Oldest first; months with no spending are included as zero.
    points: list[TrendPoint]
    average: Decimal


class CategoryChange(CategoryRef):
    current: Decimal
    previous: Decimal
    change: Decimal


class MonthComparison(BaseModel):
    month: str
    previous_month: str
    total: Decimal
    previous_total: Decimal
    change: Decimal
    # Change relative to the previous month, to one decimal; null when it had no spending.
    change_percent: Decimal | None
    # Categories with spending in either month, ordered by this month's spending.
    categories: list[CategoryChange]


class SavingsPoint(BaseModel):
    month: str
    # "complete": the month is over. "in_progress": this month, so far. "future": not started.
    status: Literal["complete", "in_progress", "future"]
    budget: Decimal | None  # null when no budget was set: savings can't be worked out
    spent: Decimal
    # budget - spent; negative means overspent. Null without a budget.
    saved: Decimal | None
    # saved / budget * 100 to one decimal; null without a budget or with a zero budget.
    savings_rate: Decimal | None


class Savings(BaseModel):
    # Oldest first.
    points: list[SavingsPoint]
    # The month before the current one, whether or not it is in `points`.
    last_month: SavingsPoint
    # Totals over complete months that had a budget (the current month isn't final yet).
    months_counted: int
    total_saved: Decimal
    average_saved: Decimal | None
    average_rate: Decimal | None
