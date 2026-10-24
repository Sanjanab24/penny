from typing import Annotated, Literal

from pydantic import BaseModel, Field

Occupation = Literal[
    "student_undergraduate",
    "student_postgraduate",
    "working_professional",
    "self_employed",
    "homemaker",
    "retired",
    "other",
]

# Plain-English labels, also used when describing the user to the AI.
OCCUPATION_LABELS: dict[str, str] = {
    "student_undergraduate": "undergraduate student",
    "student_postgraduate": "postgraduate student",
    "working_professional": "working professional",
    "self_employed": "self-employed / runs a business",
    "homemaker": "homemaker",
    "retired": "retired",
    "other": "other",
}

Age = Annotated[int, Field(ge=13, le=100)]


class ProfileOut(BaseModel):
    age: int | None
    occupation: Occupation | None
    # False until onboarding is finished or skipped; the client shows onboarding until then.
    onboarded: bool


class ProfileUpdate(BaseModel):
    """PUT body. Both fields are optional: skipping onboarding sends neither."""

    age: Age | None = None
    occupation: Occupation | None = None
