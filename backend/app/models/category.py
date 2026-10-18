from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin


class Category(CreatedAtMixin, Base):
    """Default categories are global (user_id NULL, is_default true); custom ones belong to a user."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)  # hex, e.g. #22c55e
    icon: Mapped[str] = mapped_column(String(50), nullable=False)  # lucide icon name
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        # Case-insensitive uniqueness per user. Defaults share user_id NULL and are seeded unique;
        # a custom name clashing with a default name is rejected in the service layer (Phase 2).
        Index("uq_categories_user_id_lower_name", "user_id", func.lower(name), unique=True),
        # A row is either a global default or a user-owned custom category, never both.
        CheckConstraint(
            "(is_default AND user_id IS NULL) OR (NOT is_default AND user_id IS NOT NULL)",
            name="default_xor_owner",
        ),
    )
