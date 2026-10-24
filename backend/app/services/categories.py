"""Category rules.

Users see the global defaults plus their own custom categories. Defaults are read-only.
Names are unique per user, case-insensitively, and may not clash with a default's name.
A category still referenced by expenses, recurring items or budget allocations can only be
deleted by reassigning those rows to another category in the same transaction.
"""

from sqlalchemy import ColumnElement, delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import BudgetAllocation, Category, Expense, RecurringExpense, User
from app.schemas.category import CategoryCreate, CategoryUpdate


def _visible_to(user: User) -> ColumnElement[bool]:
    return or_(Category.is_default.is_(True), Category.user_id == user.id)


def _not_found() -> AppError:
    return AppError(404, "not_found", "Category not found")


def list_categories(db: Session, user: User) -> list[tuple[Category, int]]:
    """Defaults first, then custom ones, each alphabetically, with the user's expense counts."""
    counts = (
        select(Expense.category_id, func.count().label("n"))
        .where(Expense.user_id == user.id)
        .group_by(Expense.category_id)
        .subquery()
    )
    rows = db.execute(
        select(Category, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.category_id == Category.id)
        .where(_visible_to(user))
        .order_by(Category.is_default.desc(), func.lower(Category.name))
    ).all()
    return [(category, count) for category, count in rows]


def count_expenses(db: Session, user: User, category_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Expense)
        .where(Expense.user_id == user.id, Expense.category_id == category_id)
    ) or 0


def get_visible_category(db: Session, user: User, category_id: int) -> Category:
    category = db.scalar(select(Category).where(Category.id == category_id, _visible_to(user)))
    if category is None:
        raise _not_found()
    return category


def require_usable_category(db: Session, user: User, category_id: int) -> Category:
    """For request bodies that reference a category: a bad id is a validation error, not a 404."""
    try:
        return get_visible_category(db, user, category_id)
    except AppError:
        raise AppError(422, "invalid_category", "Category does not exist") from None


def _get_own_category(db: Session, user: User, category_id: int) -> Category:
    category = get_visible_category(db, user, category_id)
    if category.is_default:
        raise AppError(403, "default_category_readonly", "Default categories can't be changed")
    return category


def _ensure_name_available(
    db: Session, user: User, name: str, exclude_id: int | None = None
) -> None:
    query = select(Category.id).where(_visible_to(user), func.lower(Category.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Category.id != exclude_id)
    if db.scalar(query) is not None:
        raise AppError(409, "category_name_taken", f'A category named "{name}" already exists')


def _commit_name_change(db: Session, name: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent request creating the same name.
        db.rollback()
        raise AppError(
            409, "category_name_taken", f'A category named "{name}" already exists'
        ) from None


def create_category(db: Session, user: User, data: CategoryCreate) -> Category:
    _ensure_name_available(db, user, data.name)
    category = Category(
        user_id=user.id, name=data.name, color=data.color, icon=data.icon, is_default=False
    )
    db.add(category)
    _commit_name_change(db, data.name)
    return category


def update_category(db: Session, user: User, category_id: int, data: CategoryUpdate) -> Category:
    category = _get_own_category(db, user, category_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "name" in changes:
        _ensure_name_available(db, user, changes["name"], exclude_id=category.id)
    for field, value in changes.items():
        setattr(category, field, value)
    _commit_name_change(db, category.name)
    return category


def delete_category(
    db: Session, user: User, category_id: int, reassign_to: int | None = None
) -> None:
    category = _get_own_category(db, user, category_id)

    expense_count = count_expenses(db, user, category.id)
    recurring_count = db.scalar(
        select(func.count())
        .select_from(RecurringExpense)
        .where(RecurringExpense.category_id == category.id)
    ) or 0
    allocations = db.scalars(
        select(BudgetAllocation).where(BudgetAllocation.category_id == category.id)
    ).all()
    in_use = expense_count or recurring_count or allocations

    if in_use and reassign_to is None:
        raise AppError(
            409,
            "category_in_use",
            "This category is in use. Choose another category to move its items to.",
            {
                "expense_count": expense_count,
                "recurring_count": recurring_count,
                "budget_allocation_count": len(allocations),
            },
        )

    if in_use and reassign_to is not None:
        if reassign_to == category.id:
            raise AppError(422, "invalid_category", "Can't reassign a category to itself")
        target = require_usable_category(db, user, reassign_to)
        db.execute(
            update(Expense).where(Expense.category_id == category.id).values(category_id=target.id)
        )
        db.execute(
            update(RecurringExpense)
            .where(RecurringExpense.category_id == category.id)
            .values(category_id=target.id)
        )
        # A budget holds at most one allocation per category, so merge into the target's.
        for allocation in allocations:
            existing = db.scalar(
                select(BudgetAllocation).where(
                    BudgetAllocation.budget_id == allocation.budget_id,
                    BudgetAllocation.category_id == target.id,
                )
            )
            if existing:
                existing.amount += allocation.amount
                db.delete(allocation)
            else:
                allocation.category_id = target.id
        db.flush()

    db.execute(delete(Category).where(Category.id == category.id))
    db.commit()
