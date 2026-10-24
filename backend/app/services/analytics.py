"""Read-only spending aggregates for charts. Every query is scoped to one user and whole months."""

import calendar
import datetime as dt
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Budget, Category, Expense, User
from app.schemas.analytics import (
    CategoryChange,
    CategorySpend,
    MonthComparison,
    MonthSummary,
    Savings,
    SavingsPoint,
    TrendPoint,
    Trends,
)
from app.services.budgets import month_bounds, percent

_CENTS = Decimal("0.01")
_ZERO = Decimal("0.00")


def _money(value: object) -> Decimal:
    # SQLite (tests) returns NUMERIC sums as floats; normalise to exact cents.
    return Decimal(str(value or 0)).quantize(_CENTS)


def month_of(date: dt.date) -> str:
    return f"{date.year:04d}-{date.month:02d}"


def shift_month(month: str, delta: int) -> str:
    """shift_month("2026-01", -1) == "2025-12"."""
    index = int(month[:4]) * 12 + int(month[5:7]) - 1 + delta
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def _by_category(db: Session, user: User, month: str) -> dict[int, tuple[Decimal, int]]:
    """category_id -> (amount spent, expense count) for one month."""
    first, last = month_bounds(month)
    rows = db.execute(
        select(Expense.category_id, func.sum(Expense.amount), func.count())
        .where(Expense.user_id == user.id, Expense.date >= first, Expense.date <= last)
        .group_by(Expense.category_id)
    ).all()
    return {category_id: (_money(total), count) for category_id, total, count in rows}


def _categories(db: Session, ids: set[int]) -> dict[int, Category]:
    if not ids:
        return {}
    return {c.id: c for c in db.scalars(select(Category).where(Category.id.in_(ids))).all()}


def _ref(category: Category) -> dict[str, object]:
    return {
        "category_id": category.id,
        "name": category.name,
        "color": category.color,
        "icon": category.icon,
    }


def _days_counted(month: str, today: dt.date) -> int:
    """Days to average over: elapsed days for the current month, all days for past months."""
    days_in_month = calendar.monthrange(int(month[:4]), int(month[5:7]))[1]
    current = month_of(today)
    if month == current:
        return today.day
    return days_in_month if month < current else 0


def month_summary(db: Session, user: User, month: str, today: dt.date) -> MonthSummary:
    spend = _by_category(db, user, month)
    categories = _categories(db, set(spend))
    total = sum((amount for amount, _ in spend.values()), _ZERO)
    days = _days_counted(month, today)

    rows = [
        CategorySpend(
            **_ref(categories[cid]),
            amount=amount,
            percent=percent(amount, total) or Decimal("0.0"),
            expense_count=count,
        )
        for cid, (amount, count) in spend.items()
    ]
    rows.sort(key=lambda r: (-r.amount, r.name.lower()))
    return MonthSummary(
        month=month,
        total=total,
        expense_count=sum(count for _, count in spend.values()),
        daily_average=(total / days).quantize(_CENTS) if days else _ZERO,
        categories=rows,
    )


def _month_labels(end_month: str, months: int) -> list[str]:
    """The `months` months ending at `end_month`, oldest first."""
    return [shift_month(end_month, -i) for i in range(months - 1, -1, -1)]


def _spent_per_month(db: Session, user: User, labels: list[str]) -> dict[str, Decimal]:
    """Total spending per month for `labels` (consecutive months), zero-filled."""
    first, _ = month_bounds(labels[0])
    _, last = month_bounds(labels[-1])
    # Group by month in Python: date-to-month SQL differs between Postgres and SQLite.
    rows = db.execute(
        select(Expense.date, func.sum(Expense.amount))
        .where(Expense.user_id == user.id, Expense.date >= first, Expense.date <= last)
        .group_by(Expense.date)
    ).all()
    totals = dict.fromkeys(labels, _ZERO)
    for date, amount in rows:
        totals[month_of(date)] += _money(amount)
    return totals


def _budgets_for(db: Session, user: User, labels: list[str]) -> dict[str, Decimal]:
    rows = db.execute(
        select(Budget.month, Budget.total_amount).where(
            Budget.user_id == user.id, Budget.month.in_(labels)
        )
    ).all()
    return {month: _money(total) for month, total in rows}


def trends(db: Session, user: User, end_month: str, months: int) -> Trends:
    """Monthly totals for the `months` months ending at `end_month`, zero-filled."""
    labels = _month_labels(end_month, months)
    totals = _spent_per_month(db, user, labels)
    budgets = _budgets_for(db, user, labels)
    points = [
        TrendPoint(
            month=m,
            total=totals[m],
            budget=budgets.get(m),
        )
        for m in labels
    ]
    average = (sum(totals.values(), _ZERO) / len(labels)).quantize(_CENTS)
    return Trends(points=points, average=average)


def compare(db: Session, user: User, month: str) -> MonthComparison:
    """This month against the month before, overall and per category."""
    previous_month = shift_month(month, -1)
    current = _by_category(db, user, month)
    previous = _by_category(db, user, previous_month)
    categories = _categories(db, set(current) | set(previous))

    rows = []
    for cid, category in categories.items():
        now = current.get(cid, (_ZERO, 0))[0]
        before = previous.get(cid, (_ZERO, 0))[0]
        rows.append(
            CategoryChange(**_ref(category), current=now, previous=before, change=now - before)
        )
    rows.sort(key=lambda r: (-r.current, -r.previous, r.name.lower()))

    total = sum((r.current for r in rows), _ZERO)
    previous_total = sum((r.previous for r in rows), _ZERO)
    change = total - previous_total
    return MonthComparison(
        month=month,
        previous_month=previous_month,
        total=total,
        previous_total=previous_total,
        change=change,
        change_percent=percent(change, previous_total) if previous_total > 0 else None,
        categories=rows,
    )


def _savings_point(
    month: str, budget: Decimal | None, spent: Decimal, today: dt.date
) -> SavingsPoint:
    current = month_of(today)
    status = "complete" if month < current else "in_progress" if month == current else "future"
    saved = budget - spent if budget is not None else None
    return SavingsPoint(
        month=month,
        status=status,
        budget=budget,
        spent=spent,
        saved=saved,
        savings_rate=percent(saved, budget) if saved is not None and budget else None,
    )


def savings(db: Session, user: User, end_month: str, months: int, today: dt.date) -> Savings:
    """Saved = the month's budget minus what was spent. Negative means overspent.

    Months without a budget have no savings figure (we don't know what was available).
    Totals only count complete months, since the current month can still change.
    """
    last_month = shift_month(month_of(today), -1)
    labels = _month_labels(end_month, months)
    span = sorted(set(labels) | {last_month})
    # One query over the whole range, even if last month sits outside the chart window.
    spent = _spent_per_month(db, user, _month_labels(span[-1], _months_between(span[0], span[-1])))
    budgets = _budgets_for(db, user, span)

    points = [_savings_point(m, budgets.get(m), spent[m], today) for m in labels]
    counted = [p for p in points if p.status == "complete" and p.saved is not None]
    total_saved = sum((p.saved for p in counted if p.saved is not None), _ZERO)
    total_budget = sum((p.budget for p in counted if p.budget is not None), _ZERO)
    return Savings(
        points=points,
        last_month=_savings_point(last_month, budgets.get(last_month), spent[last_month], today),
        months_counted=len(counted),
        total_saved=total_saved,
        average_saved=(total_saved / len(counted)).quantize(_CENTS) if counted else None,
        average_rate=percent(total_saved, total_budget) if counted else None,
    )


def _months_between(first: str, last: str) -> int:
    """Number of months from `first` to `last`, both included."""
    return (int(last[:4]) - int(first[:4])) * 12 + int(last[5:]) - int(first[5:]) + 1
