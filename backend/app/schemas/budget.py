from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

# Budgets may be zero (e.g. a month with no funds), unlike expenses.
BudgetMoney = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


class AllocationIn(BaseModel):
    category_id: int
    amount: BudgetMoney


class BudgetIn(BaseModel):
    """PUT body: replaces the month's total and its whole set of allocations."""

    total_amount: BudgetMoney
    allocations: list[AllocationIn] = Field(default_factory=list, max_length=200)


class CategoryUsage(BaseModel):
    category_id: int
    name: str
    color: str
    icon: str
    is_default: bool
    allocated: Decimal
    spent: Decimal
    # Active recurring payments in this category (current and future months only).
    recurring: Decimal
    # allocated - spent; negative when over budget.
    remaining: Decimal
    # spent / allocated * 100 to one decimal; null when nothing is allocated.
    percent_used: Decimal | None
    over_budget: bool


class BudgetSummary(BaseModel):
    month: str
    has_budget: bool
    total_amount: Decimal
    allocated_total: Decimal
    # Monthly sum of active recurring payments; counted first when planning the budget.
    recurring_total: Decimal
    # total_amount - allocated_total; never negative because saving enforces the cap.
    unallocated: Decimal
    spent_total: Decimal
    remaining: Decimal
    percent_used: Decimal | None
    # Categories with an allocation, spending or recurring payments, most allocated first.
    categories: list[CategoryUsage]
