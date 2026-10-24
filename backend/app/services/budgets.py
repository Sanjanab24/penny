"""Monthly budgets: the total available funds, its split across categories, and usage.

Spending is always scoped to one calendar month (expenses dated inside it), so months never
mix. The sum of category allocations may not exceed the month's total. Active recurring
payments are reported as commitments for the current and future months, so planning starts
from them; past months show only what actually happened.
"""

import calendar
import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.models import Budget, BudgetAllocation, Category, Expense, User
from app.schemas.budget import BudgetIn, BudgetSummary, CategoryUsage
from app.services.categories import require_usable_category
from app.services.recurring import monthly_commitments

_CENTS = Decimal("0.01")
_TENTH = Decimal("0.1")
_ZERO = Decimal("0.00")


def _money(value: object) -> Decimal:
    # SQLite (tests) returns NUMERIC sums as floats; normalise to exact cents.
    return Decimal(str(value or 0)).quantize(_CENTS)


def month_bounds(month: str) -> tuple[dt.date, dt.date]:
    """First and last day of a YYYY-MM month, e.g. 2026-02 -> (Feb 1, Feb 28)."""
    year, mon = int(month[:4]), int(month[5:7])
    return dt.date(year, mon, 1), dt.date(year, mon, calendar.monthrange(year, mon)[1])


def percent(part: Decimal, whole: Decimal) -> Decimal | None:
    """part / whole as a percentage to one decimal place; None when whole is zero."""
    if whole <= 0:
        return None
    return (part * 100 / whole).quantize(_TENTH, rounding=ROUND_HALF_UP)


def _get_budget(db: Session, user: User, month: str) -> Budget | None:
    return db.scalar(
        select(Budget)
        .where(Budget.user_id == user.id, Budget.month == month)
        .options(selectinload(Budget.allocations))
    )


def _spent_by_category(db: Session, user: User, month: str) -> dict[int, Decimal]:
    first, last = month_bounds(month)
    rows = db.execute(
        select(Expense.category_id, func.sum(Expense.amount))
        .where(Expense.user_id == user.id, Expense.date >= first, Expense.date <= last)
        .group_by(Expense.category_id)
    ).all()
    return {category_id: _money(total) for category_id, total in rows}


def get_summary(db: Session, user: User, month: str, today: dt.date) -> BudgetSummary:
    budget = _get_budget(db, user, month)
    allocated = {a.category_id: _money(a.amount) for a in budget.allocations} if budget else {}
    spent = _spent_by_category(db, user, month)
    is_past = month < f"{today.year:04d}-{today.month:02d}"
    recurring = {} if is_past else monthly_commitments(db, user)

    category_ids = allocated.keys() | spent.keys() | recurring.keys()
    categories = (
        db.scalars(select(Category).where(Category.id.in_(category_ids))).all()
        if category_ids
        else []
    )

    usages = []
    for category in categories:
        cat_allocated = allocated.get(category.id, _ZERO)
        cat_spent = spent.get(category.id, _ZERO)
        usages.append(
            CategoryUsage(
                category_id=category.id,
                name=category.name,
                color=category.color,
                icon=category.icon,
                is_default=category.is_default,
                allocated=cat_allocated,
                spent=cat_spent,
                recurring=recurring.get(category.id, _ZERO),
                remaining=cat_allocated - cat_spent,
                percent_used=percent(cat_spent, cat_allocated),
                over_budget=cat_spent > cat_allocated,
            )
        )
    usages.sort(key=lambda u: (-u.allocated, -u.spent, u.name.lower()))

    total = _money(budget.total_amount) if budget else _ZERO
    allocated_total = sum(allocated.values(), _ZERO)
    spent_total = sum(spent.values(), _ZERO)
    return BudgetSummary(
        month=month,
        has_budget=budget is not None,
        total_amount=total,
        allocated_total=allocated_total,
        recurring_total=sum(recurring.values(), _ZERO),
        unallocated=total - allocated_total,
        spent_total=spent_total,
        remaining=total - spent_total,
        percent_used=percent(spent_total, total),
        categories=usages,
    )


def _validate(db: Session, user: User, data: BudgetIn) -> None:
    category_ids = [a.category_id for a in data.allocations]
    duplicates = sorted({cid for cid in category_ids if category_ids.count(cid) > 1})
    if duplicates:
        raise AppError(
            422,
            "duplicate_allocation",
            "Each category can only be allocated once",
            {"category_ids": duplicates},
        )
    for category_id in category_ids:
        require_usable_category(db, user, category_id)

    allocated_total = sum((a.amount for a in data.allocations), _ZERO)
    if allocated_total > data.total_amount:
        raise AppError(
            422,
            "allocations_exceed_total",
            "Category allocations can't add up to more than the total budget",
            # Strings, like every money value in responses (JSON numbers would lose precision).
            {
                "total_amount": str(data.total_amount),
                "allocated_total": str(allocated_total),
                "over_by": str(allocated_total - data.total_amount),
            },
        )


def save_budget(
    db: Session, user: User, month: str, data: BudgetIn, today: dt.date
) -> BudgetSummary:
    _validate(db, user, data)

    budget = _get_budget(db, user, month)
    if budget is None:
        budget = Budget(user_id=user.id, month=month, total_amount=data.total_amount)
        db.add(budget)
    budget.total_amount = data.total_amount

    # Update rows in place rather than replacing the list: the unit of work inserts before it
    # deletes, which would trip the unique (budget_id, category_id) constraint on re-save.
    # Zero allocations carry no information, so they are not stored.
    wanted = {a.category_id: a.amount for a in data.allocations if a.amount > 0}
    for allocation in list(budget.allocations):
        if allocation.category_id in wanted:
            allocation.amount = wanted.pop(allocation.category_id)
        else:
            budget.allocations.remove(allocation)
    for category_id, amount in wanted.items():
        budget.allocations.append(BudgetAllocation(category_id=category_id, amount=amount))
    db.commit()
    return get_summary(db, user, month, today)
