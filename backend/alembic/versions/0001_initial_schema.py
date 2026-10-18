"""Initial schema and default category seed.

Revision ID: 0001
Revises:
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Global, read-only defaults visible to every user. Icons are lucide-react names.
DEFAULT_CATEGORIES = [
    {"name": "Food", "color": "#f97316", "icon": "utensils"},
    {"name": "Shopping", "color": "#ec4899", "icon": "shopping-bag"},
    {"name": "Transportation", "color": "#3b82f6", "icon": "car"},
    {"name": "Groceries", "color": "#22c55e", "icon": "shopping-cart"},
    {"name": "Bills", "color": "#ef4444", "icon": "receipt"},
    {"name": "Subscriptions", "color": "#8b5cf6", "icon": "repeat"},
    {"name": "Other", "color": "#64748b", "icon": "circle-ellipsis"},
]


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_auth_id", sa.String(255), nullable=False),
        _created_at(),
        sa.UniqueConstraint("external_auth_id", name="uq_users_external_auth_id"),
    )

    categories = op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_categories_user_id_users"),
            nullable=True,
        ),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("icon", sa.String(50), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        _created_at(),
        sa.CheckConstraint(
            "(is_default AND user_id IS NULL) OR (NOT is_default AND user_id IS NOT NULL)",
            name="ck_categories_default_xor_owner",
        ),
    )
    op.create_index(
        "uq_categories_user_id_lower_name",
        "categories",
        ["user_id", sa.text("lower(name)")],
        unique=True,
    )

    op.create_table(
        "recurring_expenses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id", ondelete="CASCADE", name="fk_recurring_expenses_user_id_users"
            ),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey(
                "categories.id",
                ondelete="RESTRICT",
                name="fk_recurring_expenses_category_id_categories",
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("day_of_month", sa.SmallInteger(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        _created_at(),
        sa.CheckConstraint("amount > 0", name="ck_recurring_expenses_amount_positive"),
        sa.CheckConstraint(
            "day_of_month BETWEEN 1 AND 31", name="ck_recurring_expenses_day_of_month_range"
        ),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_expenses_user_id_users"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey(
                "categories.id", ondelete="RESTRICT", name="fk_expenses_category_id_categories"
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(255), nullable=False, server_default=""),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "recurring_id",
            sa.Integer(),
            sa.ForeignKey(
                "recurring_expenses.id",
                ondelete="SET NULL",
                name="fk_expenses_recurring_id_recurring_expenses",
            ),
            nullable=True,
        ),
        _created_at(),
        sa.CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
    )
    op.create_index("ix_expenses_user_id_date", "expenses", ["user_id", "date"])
    op.create_index(
        "uq_expenses_recurring_id_date", "expenses", ["recurring_id", "date"], unique=True
    )

    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_budgets_user_id_users"),
            nullable=False,
        ),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        _created_at(),
        sa.UniqueConstraint("user_id", "month", name="uq_budgets_user_id_month"),
        sa.CheckConstraint("total_amount >= 0", name="ck_budgets_total_non_negative"),
    )

    op.create_table(
        "budget_allocations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "budget_id",
            sa.Integer(),
            sa.ForeignKey(
                "budgets.id", ondelete="CASCADE", name="fk_budget_allocations_budget_id_budgets"
            ),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey(
                "categories.id",
                ondelete="RESTRICT",
                name="fk_budget_allocations_category_id_categories",
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.UniqueConstraint(
            "budget_id", "category_id", name="uq_budget_allocations_budget_category"
        ),
        sa.CheckConstraint("amount >= 0", name="ck_budget_allocations_amount_non_negative"),
    )

    op.bulk_insert(
        categories,
        [{**c, "user_id": None, "is_default": True} for c in DEFAULT_CATEGORIES],
    )


def downgrade() -> None:
    op.drop_table("budget_allocations")
    op.drop_table("budgets")
    op.drop_index("uq_expenses_recurring_id_date", table_name="expenses")
    op.drop_index("ix_expenses_user_id_date", table_name="expenses")
    op.drop_table("expenses")
    op.drop_table("recurring_expenses")
    op.drop_index("uq_categories_user_id_lower_name", table_name="categories")
    op.drop_table("categories")
    op.drop_table("users")
