from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.budget import BudgetMoney

Month = Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
EventText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]

MAX_EVENTS = 10
MAX_FOLLOW_UPS = 3


# --- Step 1: follow-up questions about upcoming events ------------------------------------


class QuestionsRequest(BaseModel):
    month: Month
    available_funds: BudgetMoney
    # e.g. "Birthday party", "Trip to Goa with friends, 3 days, 4 people"
    upcoming_events: list[EventText] = Field(min_length=1, max_length=MAX_EVENTS)


class FollowUpQuestion(BaseModel):
    id: str  # stable within one response, e.g. "e0q1"
    text: str
    kind: Literal["number", "text", "choice"]
    options: list[str] = Field(default_factory=list)  # for "choice"


class EventQuestions(BaseModel):
    event: str
    # The app always asks how much the user plans to spend, and which category it comes from.
    suggested_category_id: int | None
    questions: list[FollowUpQuestion]


class QuestionsResponse(BaseModel):
    source: Literal["ai", "fallback"]
    events: list[EventQuestions]


# --- Step 2: the recommendation -----------------------------------------------------------


class Answer(BaseModel):
    question: ShortText
    answer: ShortText


class EventPlan(BaseModel):
    """What the user told us about one event. A budget with a category is set aside first."""

    event: EventText
    budget: BudgetMoney | None = None
    category_id: int | None = None
    answers: list[Answer] = Field(default_factory=list, max_length=MAX_FOLLOW_UPS)


class PreviousAllocation(BaseModel):
    category_id: int
    amount: BudgetMoney


class RecommendationRequest(BaseModel):
    month: Month
    available_funds: BudgetMoney
    # Plain event descriptions, for when the user skipped the questions.
    upcoming_events: list[EventText] = Field(default_factory=list, max_length=MAX_EVENTS)
    event_plans: list[EventPlan] = Field(default_factory=list, max_length=MAX_EVENTS)
    # "Try another suggestion": the split the user saw last, so the AI offers a different one.
    previous_suggestion: list[PreviousAllocation] = Field(default_factory=list, max_length=100)


class RecommendedAllocation(BaseModel):
    category_id: int
    name: str
    color: str
    icon: str
    # Total suggested for the category, recurring payments and event budgets included.
    amount: Decimal
    recurring: Decimal
    # Set aside for events the user gave a budget for (e.g. ₹5,000 for a birthday).
    reserved: Decimal = Decimal("0.00")
    reason: str


class Recommendation(BaseModel):
    """A suggestion only: nothing is saved until the user reviews it and saves the budget."""

    month: str
    source: Literal["ai", "fallback"]
    # Why the rule-based suggestion was used instead of the AI, when it was.
    fallback_reason: str | None
    available_funds: Decimal
    recurring_total: Decimal
    reserved_total: Decimal = Decimal("0.00")
    # What the split was based on, e.g. "your spending in October so far"; null with no history.
    based_on: str | None
    allocations: list[RecommendedAllocation]
    summary: str


# --- The shapes the model must return (validated before anything is shown) ---------------


class AIAllocation(BaseModel):
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    amount: Annotated[Decimal, Field(ge=0, allow_inf_nan=False)]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""


class AIResponse(BaseModel):
    allocations: list[AIAllocation] = Field(max_length=100)
    summary: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""


class AIQuestion(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    kind: Literal["number", "text", "choice"]
    options: list[
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    ] = Field(default_factory=list, max_length=6)


class AIEventQuestions(BaseModel):
    event: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    category: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    questions: list[AIQuestion] = Field(default_factory=list, max_length=MAX_FOLLOW_UPS)


class AIQuestionsResponse(BaseModel):
    events: list[AIEventQuestions] = Field(max_length=MAX_EVENTS)
