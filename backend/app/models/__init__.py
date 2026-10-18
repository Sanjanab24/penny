"""Import every model here so Base.metadata is complete for Alembic and tests."""

from app.models.budget import Budget, BudgetAllocation
from app.models.category import Category
from app.models.expense import Expense
from app.models.recurring import RecurringExpense
from app.models.user import User

__all__ = ["Budget", "BudgetAllocation", "Category", "Expense", "RecurringExpense", "User"]
