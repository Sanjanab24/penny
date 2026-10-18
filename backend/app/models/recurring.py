from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin


class RecurringExpense(CreatedAtMixin, Base):
    __tablename__ = "recurring_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    # 1-31; the generator clamps to the month's last day (31 -> Feb 28/29).
    day_of_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("day_of_month BETWEEN 1 AND 31", name="day_of_month_range"),
    )
