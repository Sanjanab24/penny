"""Recurring payments (rent, Netflix, Spotify...) and the monthly expense generator.

Each active item is charged once a month on `day_of_month`, clamped to the month's last day
(31 -> Feb 28/29). `generate_due` creates the expenses for every charge date after the item's
`generated_through` mark and up to today, then moves the mark to today. That makes it
idempotent (running it twice creates nothing new), lets it catch up on months the app wasn't
opened, and means a charge the user deleted by hand is never recreated. Pausing skips charges;
resuming starts again from the resume date without backfilling the paused months.
"""

import calendar
import datetime as dt
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Expense, RecurringExpense, User
from app.schemas.common import PageParams
from app.schemas.recurring import RecurringCreate, RecurringUpdate
from app.services.categories import require_usable_category

_CENTS = Decimal("0.01")
_ONE_DAY = dt.timedelta(days=1)


def charge_date(year: int, month: int, day_of_month: int) -> dt.date:
    """The billing date in a given month, e.g. day 31 in February 2026 -> 2026-02-28."""
    return dt.date(year, month, min(day_of_month, calendar.monthrange(year, month)[1]))


def _next_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def charge_dates_between(day_of_month: int, start: dt.date, end: dt.date) -> list[dt.date]:
    """Every billing date d with start <= d <= end."""
    dates = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        date = charge_date(year, month, day_of_month)
        if start <= date <= end:
            dates.append(date)
        year, month = _next_month(year, month)
    return dates


def next_charge_date(item: RecurringExpense, today: dt.date) -> dt.date | None:
    if not item.active:
        return None
    # The first day not yet covered by the generator, and never in the past.
    start = max(today, (item.generated_through or today - _ONE_DAY) + _ONE_DAY)
    date = charge_date(start.year, start.month, item.day_of_month)
    if date < start:
        date = charge_date(*_next_month(start.year, start.month), item.day_of_month)
    return date


def get_item(db: Session, user: User, item_id: int) -> RecurringExpense:
    item = db.scalar(
        select(RecurringExpense).where(
            RecurringExpense.id == item_id, RecurringExpense.user_id == user.id
        )
    )
    if item is None:
        raise AppError(404, "not_found", "Recurring payment not found")
    return item


def list_items(
    db: Session, user: User, page: PageParams
) -> tuple[list[RecurringExpense], int, Decimal]:
    """Returns (page of items, total items, monthly total of active items)."""
    owned = RecurringExpense.user_id == user.id
    total = db.scalar(select(func.count()).select_from(RecurringExpense).where(owned)) or 0
    monthly = db.scalar(
        select(func.coalesce(func.sum(RecurringExpense.amount), 0)).where(
            owned, RecurringExpense.active.is_(True)
        )
    )
    items = db.scalars(
        select(RecurringExpense)
        .where(owned)
        # Active first, then by billing day, so the list reads like a calendar.
        .order_by(
            RecurringExpense.active.desc(),
            RecurringExpense.day_of_month,
            func.lower(RecurringExpense.description),
            RecurringExpense.id,
        )
        .offset(page.offset)
        .limit(page.page_size)
    ).all()
    return list(items), total, Decimal(str(monthly)).quantize(_CENTS)


def monthly_commitments(db: Session, user: User) -> dict[int, Decimal]:
    """Active recurring amounts per category: committed each month before anything else."""
    rows = db.execute(
        select(RecurringExpense.category_id, func.sum(RecurringExpense.amount))
        .where(RecurringExpense.user_id == user.id, RecurringExpense.active.is_(True))
        .group_by(RecurringExpense.category_id)
    ).all()
    return {category_id: Decimal(str(total)).quantize(_CENTS) for category_id, total in rows}


def _add_charge(db: Session, item: RecurringExpense, date: dt.date) -> bool:
    """Creates the expense for one charge unless it already exists. Returns True if created."""
    exists = db.scalar(
        select(Expense.id).where(Expense.recurring_id == item.id, Expense.date == date)
    )
    if exists is not None:
        return False
    db.add(
        Expense(
            user_id=item.user_id,
            category_id=item.category_id,
            amount=item.amount,
            description=item.description,
            date=date,
            recurring_id=item.id,
        )
    )
    return True


def create_item(db: Session, user: User, data: RecurringCreate, today: dt.date) -> RecurringExpense:
    require_usable_category(db, user, data.category_id)
    item = RecurringExpense(
        user_id=user.id,
        **data.model_dump(exclude={"charge_current_month"}),
        # Charges start from today; earlier dates are only added on request (below).
        generated_through=today - _ONE_DAY,
    )
    db.add(item)
    db.flush()
    if data.active:
        this_month = charge_date(today.year, today.month, data.day_of_month)
        if data.charge_current_month and this_month < today:
            _add_charge(db, item, this_month)
        generate_item(db, item, today)
    db.commit()
    return item


def update_item(
    db: Session, user: User, item_id: int, data: RecurringUpdate, today: dt.date
) -> RecurringExpense:
    item = get_item(db, user, item_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "category_id" in changes:
        require_usable_category(db, user, changes["category_id"])
    resuming = changes.get("active") is True and not item.active
    for field, value in changes.items():
        setattr(item, field, value)
    if resuming:
        # Skip everything missed while paused; a charge due today is still created.
        item.generated_through = today - _ONE_DAY
        generate_item(db, item, today)
    db.commit()
    return item


def delete_item(db: Session, user: User, item_id: int) -> None:
    # Expenses already generated stay; their recurring_id is set to NULL by the foreign key.
    db.delete(get_item(db, user, item_id))
    db.commit()


def generate_item(db: Session, item: RecurringExpense, today: dt.date) -> int:
    """Creates this item's charges due since its last run. Caller commits."""
    if not item.active:
        return 0
    since = item.generated_through or item.created_at.date() - _ONE_DAY
    if since >= today:
        return 0
    created = sum(
        _add_charge(db, item, date)
        for date in charge_dates_between(item.day_of_month, since + _ONE_DAY, today)
    )
    item.generated_through = today
    return created


def generate_due(db: Session, user: User, today: dt.date) -> int:
    """Creates every charge due up to today for the user's active items. Safe to run any time."""
    items = db.scalars(
        select(RecurringExpense).where(
            RecurringExpense.user_id == user.id, RecurringExpense.active.is_(True)
        )
    ).all()
    created = sum(generate_item(db, item, today) for item in items)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent run inserted the same charges first (the unique index caught it).
        db.rollback()
        return 0
    return created
