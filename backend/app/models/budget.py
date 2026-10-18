from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin


class Budget(CreatedAtMixin, Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    allocations: Mapped[list["BudgetAllocation"]] = relationship(
        back_populates="budget", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "month", name="uq_budgets_user_id_month"),
        CheckConstraint("total_amount >= 0", name="total_non_negative"),
    )


class BudgetAllocation(Base):
    __tablename__ = "budget_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    budget_id: Mapped[int] = mapped_column(
        ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    budget: Mapped[Budget] = relationship(back_populates="allocations")

    __table_args__ = (
        UniqueConstraint("budget_id", "category_id", name="uq_budget_allocations_budget_category"),
        CheckConstraint("amount >= 0", name="amount_non_negative"),
    )
