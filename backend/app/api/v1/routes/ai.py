import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentUser, DbSession
from app.core.clock import get_today
from app.schemas.ai import (
    QuestionsRequest,
    QuestionsResponse,
    Recommendation,
    RecommendationRequest,
)
from app.services import ai_budget as service
from app.services import ai_questions
from app.services.llm import LLMClient, get_llm_client

router = APIRouter(prefix="/ai", tags=["ai"])

Llm = Annotated[LLMClient | None, Depends(get_llm_client)]


@router.post(
    "/budget-questions",
    response_model=QuestionsResponse,
    summary="Follow-up questions about upcoming events, before suggesting a budget",
    description="For each event: a suggested category, plus up to 3 follow-up questions. The "
    "client also asks how much the user plans to spend; send everything back as `event_plans` "
    "to POST /ai/budget-recommendation.",
)
def budget_questions(
    data: QuestionsRequest, user: CurrentUser, db: DbSession, llm: Llm
) -> QuestionsResponse:
    return ai_questions.generate_questions(db, user, data, llm)


@router.post(
    "/budget-recommendation",
    response_model=Recommendation,
    summary="Suggest how to split a month's funds across categories",
    description="Recurring payments and event budgets are covered first; the rest is split by "
    "the AI, or by "
    "rules when the AI is unavailable or its answer fails validation (`source`). Nothing is "
    "saved: review the suggestion, then save it with PUT /budgets/{month}.",
)
def budget_recommendation(
    data: RecommendationRequest,
    user: CurrentUser,
    db: DbSession,
    today: Annotated[dt.date, Depends(get_today)],
    llm: Llm,
) -> Recommendation:
    return service.recommend(db, user, data, llm, today)
