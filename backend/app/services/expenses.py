from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Expense, User
from app.schemas.common import PageParams
from app.schemas.expense import ExpenseCreate, ExpenseFilters, ExpenseUpdate
from app.services.categories import require_usable_category

_CENTS = Decimal("0.01")

_ORDER_BY = {
    # id as tie-breaker keeps paging stable when many rows share a date or amount.
    "date_desc": (Expense.date.desc(), Expense.id.desc()),
    "date_asc": (Expense.date.asc(), Expense.id.asc()),
    "amount_desc": (Expense.amount.desc(), Expense.id.desc()),
    "amount_asc": (Expense.amount.asc(), Expense.id.asc()),
}


def get_expense(db: Session, user: User, expense_id: int) -> Expense:
    # Another user's expense is reported as missing, never as forbidden.
    expense = db.scalar(select(Expense).where(Expense.id == expense_id, Expense.user_id == user.id))
    if expense is None:
        raise AppError(404, "not_found", "Expense not found")
    return expense


def list_expenses(
    db: Session, user: User, filters: ExpenseFilters, page: PageParams
) -> tuple[list[Expense], int, Decimal]:
    """Returns (page of expenses, total matching rows, sum of all matching amounts)."""
    if filters.date_from and filters.date_to and filters.date_from > filters.date_to:
        raise AppError(422, "validation_error", "date_from must be on or before date_to")

    conditions = [Expense.user_id == user.id]
    if filters.date_from:
        conditions.append(Expense.date >= filters.date_from)
    if filters.date_to:
        conditions.append(Expense.date <= filters.date_to)
    if filters.category_id is not None:
        conditions.append(Expense.category_id == filters.category_id)
    if filters.q:
        conditions.append(Expense.description.icontains(filters.q, autoescape=True))

    total, total_amount = db.execute(
        select(func.count(), func.coalesce(func.sum(Expense.amount), 0)).where(*conditions)
    ).one()
    items = db.scalars(
        select(Expense)
        .where(*conditions)
        .order_by(*_ORDER_BY[filters.sort])
        .offset(page.offset)
        .limit(page.page_size)
    ).all()
    # SQLite (tests) sums NUMERIC as float; normalise to exact cents.
    return list(items), total, Decimal(str(total_amount)).quantize(_CENTS)


def create_expense(db: Session, user: User, data: ExpenseCreate) -> Expense:
    require_usable_category(db, user, data.category_id)
    expense = Expense(user_id=user.id, **data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, user: User, expense_id: int, data: ExpenseUpdate) -> Expense:
    expense = get_expense(db, user, expense_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "category_id" in changes:
        require_usable_category(db, user, changes["category_id"])
    for field, value in changes.items():
        setattr(expense, field, value)
    db.commit()
    return expense


def delete_expense(db: Session, user: User, expense_id: int) -> None:
    db.delete(get_expense(db, user, expense_id))
    db.commit()
