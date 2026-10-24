"""Optional user profile from onboarding: age, occupation, onboarded_at.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("age", sa.SmallInteger(), nullable=True))
        batch.add_column(sa.Column("occupation", sa.String(40), nullable=True))
        batch.add_column(sa.Column("onboarded_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_check_constraint("ck_users_age_range", "age BETWEEN 13 AND 100")


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("ck_users_age_range", type_="check")
        batch.drop_column("onboarded_at")
        batch.drop_column("occupation")
        batch.drop_column("age")
