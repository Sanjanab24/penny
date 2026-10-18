import datetime as dt
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin


class Expense(CreatedAtMixin, Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # RESTRICT: deleting a category must go through reassign, never silently drop expenses.
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    recurring_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_expenses.id", ondelete="SET NULL")
    )

    __table_args__ = (
        Index("ix_expenses_user_id_date", "user_id", "date"),
        CheckConstraint("amount > 0", name="amount_positive"),
        # Backstop for recurring-generation idempotency: one generated row per item per date.
        # NULL recurring_id (manual expenses) never conflicts.
        Index("uq_expenses_recurring_id_date", "recurring_id", "date", unique=True),
    )
