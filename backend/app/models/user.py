from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin


class User(CreatedAtMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Clerk user id (the JWT `sub` claim), e.g. "user_2abc...".
    external_auth_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
