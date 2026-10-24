import datetime as dt

from sqlalchemy import CheckConstraint, DateTime, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin


class User(CreatedAtMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Clerk user id (the JWT `sub` claim), e.g. "user_2abc...".
    external_auth_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    # Optional profile from onboarding; both may stay empty if the user skips.
    age: Mapped[int | None] = mapped_column(SmallInteger)
    # One of app.schemas.profile.Occupation, e.g. "student_undergraduate".
    occupation: Mapped[str | None] = mapped_column(String(40))
    # Set when onboarding is finished or skipped, so it is only shown once.
    onboarded_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("age BETWEEN 13 AND 100", name="age_range"),)
