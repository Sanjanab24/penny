"""Phase 6 follow-up: AI questions about events, and event budgets set aside first.

The model is replaced with a fake, so these tests never call Gemini. Today is 2026-10-19.
"""

import json
from decimal import Decimal
from typing import Any

import pytest

from app.main import app
from app.services.llm import LLMError, get_llm_client
from tests.helpers import Api, _create_category, _default_id
from tests.test_phase6 import FakeLLM, _add_recurring, _ai_reply, _amounts, _total

MONTH = "2026-11"


@pytest.fixture()
def use_llm(client: Any):  # noqa: ANN201 - returns a setter
    def _set(fake: FakeLLM | None) -> FakeLLM | None:
        app.dependency_overrides[get_llm_client] = lambda: fake
        return fake

    return _set


def _questions(api: Api, events: list[str], funds: str = "20000", user: str = "user_a") -> Any:
    body = {"month": MONTH, "available_funds": funds, "upcoming_events": events}
    return api("post", "/ai/budget-questions", user=user, json=body)


def _recommend(api: Api, funds: str, plans: list[dict[str, Any]], user: str = "user_a") -> Any:
    body = {"month": MONTH, "available_funds": funds, "event_plans": plans}
    return api("post", "/ai/budget-recommendation", user=user, json=body)


def _questions_reply(*events: dict[str, Any]) -> str:
    return json.dumps({"events": list(events)})


# --- Questions -----------------------------------------------------------------------------


def test_ai_questions_are_returned_per_event(api: Api, use_llm: Any) -> None:
    fake = use_llm(
        FakeLLM(
            _questions_reply(
                {
                    "event": "Birthday party",
                    "category": "Food",
                    "questions": [
                        {"text": "How many guests are you inviting?", "kind": "number"},
                        {
                            "text": "Where will you celebrate?",
                            "kind": "choice",
                            "options": ["At home", "Restaurant", "Banquet hall"],
                        },
                    ],
                },
                {
                    "event": "Goa trip",
                    "category": "Transportation",
                    "questions": [{"text": "How many days?", "kind": "number"}],
                },
            )
        )
    )
    result = _questions(api, ["Birthday party", "Goa trip"]).json()
    assert result["source"] == "ai"
    birthday, trip = result["events"]
    assert birthday["event"] == "Birthday party"
    assert birthday["suggested_category_id"] == _default_id(api, "Food")
    assert [q["kind"] for q in birthday["questions"]] == ["number", "choice"]
    assert birthday["questions"][1]["options"] == ["At home", "Restaurant", "Banquet hall"]
    assert birthday["questions"][0]["id"] == "e0q0"
    assert trip["suggested_category_id"] == _default_id(api, "Transportation")

    system, user = fake.calls[0]
    assert "Do NOT ask how much" in system
    assert json.loads(user)["events"] == ["Birthday party", "Goa trip"]


def test_user_wording_and_custom_categories_are_kept(api: Api, use_llm: Any) -> None:
    gifts = _create_category(api, "Gifts")
    use_llm(
        FakeLLM(
            _questions_reply(
                {"event": "Something else entirely", "category": "gifts", "questions": []}
            )
        )
    )
    event = _questions(api, ["Mom's anniversary gift"]).json()["events"][0]
    assert event["event"] == "Mom's anniversary gift"
    assert event["suggested_category_id"] == gifts["id"]


def test_unknown_category_falls_back_to_keywords(api: Api, use_llm: Any) -> None:
    use_llm(FakeLLM(_questions_reply({"event": "Birthday", "category": "Parties", "questions": []})))
    event = _questions(api, ["Birthday dinner"]).json()["events"][0]
    assert event["suggested_category_id"] == _default_id(api, "Food")


def test_choice_without_options_becomes_text(api: Api, use_llm: Any) -> None:
    use_llm(
        FakeLLM(
            _questions_reply(
                {
                    "event": "Party",
                    "category": "Food",
                    "questions": [{"text": "What kind of party?", "kind": "choice", "options": ["x"]}],
                }
            )
        )
    )
    question = _questions(api, ["Party"]).json()["events"][0]["questions"][0]
    assert (question["kind"], question["options"]) == ("text", [])


@pytest.mark.parametrize(
    "reply",
    [
        "Here are some questions!",
        _questions_reply(),  # wrong number of events
        _questions_reply({"event": "Party", "questions": [{"text": "?", "kind": "number"}]}),
        _questions_reply(
            {"event": "Party", "questions": [{"text": f"Question {i}?", "kind": "text"} for i in range(4)]}
        ),
    ],
)
def test_bad_questions_fall_back(api: Api, use_llm: Any, reply: str) -> None:
    use_llm(FakeLLM(reply))
    result = _questions(api, ["Birthday party"]).json()
    assert result["source"] == "fallback"
    assert result["events"][0]["questions"] == []
    assert result["events"][0]["suggested_category_id"] == _default_id(api, "Food")


@pytest.mark.parametrize(
    ("event", "category"),
    [
        ("Trip to Goa", "Transportation"),
        ("Sister's birthday", "Food"),
        ("Diwali gifts", "Shopping"),
        ("Car repair", "Bills"),
        ("Something unusual", "Other"),
    ],
)
def test_fallback_guesses_category(api: Api, use_llm: Any, event: str, category: str) -> None:
    use_llm(FakeLLM(LLMError("down")))
    result = _questions(api, [event]).json()
    assert result["source"] == "fallback"
    assert result["events"][0]["suggested_category_id"] == _default_id(api, category)


@pytest.mark.parametrize(
    "events", [[], ["x"] * 11, ["  "]], ids=["none", "too many", "blank"]
)
def test_questions_validation(api: Api, use_llm: Any, events: list[str]) -> None:
    use_llm(None)
    assert _questions(api, events).status_code == 422


# --- Event budgets in the recommendation ---------------------------------------------------


def test_event_budget_is_set_aside_first(api: Api, use_llm: Any) -> None:
    _add_recurring(api, "Netflix", "649", "Subscriptions")
    food = _default_id(api, "Food")
    fake = use_llm(FakeLLM(_ai_reply(("Food", 3000), ("Shopping", 2000), ("Other", 1351))))

    plans = [
        {
            "event": "Birthday party",
            "budget": "5000",
            "category_id": food,
            "answers": [
                {"question": "How many guests?", "answer": "12"},
                {"question": "Where?", "answer": "Restaurant"},
            ],
        }
    ]
    result = _recommend(api, "12000", plans).json()
    assert result["source"] == "ai"
    assert result["reserved_total"] == "5000.00"
    # The AI only split 12,000 - 649 recurring - 5,000 reserved = 6,351.
    context = json.loads(fake.calls[0][1])
    assert context["amount_to_allocate"] == "6351.00"
    assert context["reserved_for_events"] == {
        "total": "5000.00",
        "by_category": [{"category": "Food", "amount": "5000.00"}],
    }
    assert context["event_plans"] == [
        {
            "event": "Birthday party",
            "budget": "5000.00",
            "budget_reserved": True,
            "answers": [
                {"question": "How many guests?", "answer": "12"},
                {"question": "Where?", "answer": "Restaurant"},
            ],
        }
    ]
    by_name = {a["name"]: a for a in result["allocations"]}
    assert by_name["Food"]["amount"] == "8000.00"  # 5,000 birthday + 3,000 AI
    assert by_name["Food"]["reserved"] == "5000.00"
    assert "Birthday party (₹5,000.00)" in by_name["Food"]["reason"]
    assert _total(result) == Decimal("12000")


def test_event_answers_without_budget_go_to_the_ai(api: Api, use_llm: Any) -> None:
    fake = use_llm(FakeLLM(_ai_reply(("Transportation", 6000), ("Food", 4000))))
    plans = [{"event": "Goa trip", "answers": [{"question": "How many days?", "answer": "3"}]}]
    result = _recommend(api, "10000", plans).json()
    assert result["source"] == "ai"
    assert result["reserved_total"] == "0.00"
    plan = json.loads(fake.calls[0][1])["event_plans"][0]
    assert plan == {
        "event": "Goa trip",
        "budget": None,
        "budget_reserved": False,
        "answers": [{"question": "How many days?", "answer": "3"}],
    }


def test_event_budget_without_category_uses_keyword_guess(api: Api, use_llm: Any) -> None:
    use_llm(None)
    result = _recommend(api, "10000", [{"event": "Trip to Goa", "budget": "4000"}]).json()
    by_name = {a["name"]: a for a in result["allocations"]}
    assert by_name["Transportation"]["reserved"] == "4000.00"
    assert _total(result) == Decimal("10000")
    assert "set aside for the event budgets" in result["summary"]


def test_fallback_keeps_event_budgets(api: Api, use_llm: Any) -> None:
    use_llm(FakeLLM(LLMError("timeout")))
    food = _default_id(api, "Food")
    result = _recommend(api, "10000", [{"event": "Birthday", "budget": "2500", "category_id": food}]).json()
    assert result["source"] == "fallback"
    by_name = {a["name"]: a for a in result["allocations"]}
    # 2,500 reserved + Food's 15% of the remaining 7,500 under the 50/30/20 split.
    assert by_name["Food"]["amount"] == "3625.00"
    assert _total(result) == Decimal("10000")


def test_event_budgets_can_use_up_everything(api: Api, use_llm: Any) -> None:
    fake = use_llm(FakeLLM(_ai_reply()))
    food = _default_id(api, "Food")
    result = _recommend(api, "3000", [{"event": "Wedding", "budget": "3000", "category_id": food}]).json()
    assert _amounts(result) == {"Food": "3000.00"}
    assert fake.calls == []


def test_event_budgets_above_funds_are_rejected(api: Api, use_llm: Any) -> None:
    use_llm(None)
    _add_recurring(api, "Rent", "8000", "Bills")
    food = _default_id(api, "Food")
    res = _recommend(api, "10000", [{"event": "Party", "budget": "2500", "category_id": food}])
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "funds_below_commitments"


def test_event_budget_category_must_be_the_users(api: Api, use_llm: Any) -> None:
    use_llm(None)
    secret = _create_category(api, "Secret", user="user_b")
    res = _recommend(api, "10000", [{"event": "Party", "budget": "100", "category_id": secret["id"]}])
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_category"


@pytest.mark.parametrize(
    "plan",
    [
        {"event": "Party", "budget": "-1"},
        {"event": "", "budget": "100"},
        {"event": "Party", "answers": [{"question": "q", "answer": "a"}] * 4},
        {"event": "Party", "answers": [{"question": "q", "answer": "x" * 301}]},
    ],
)
def test_event_plan_validation(api: Api, use_llm: Any, plan: dict[str, Any]) -> None:
    use_llm(None)
    res = _recommend(api, "10000", [plan])
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_requires_auth(client: Any) -> None:
    body = {"month": MONTH, "available_funds": "1", "upcoming_events": ["x"]}
    assert client.post("/api/v1/ai/budget-questions", json=body).status_code == 401


def test_try_another_sends_the_previous_suggestion(api: Api, use_llm: Any) -> None:
    food, shopping = _default_id(api, "Food"), _default_id(api, "Shopping")
    fake = use_llm(FakeLLM(_ai_reply(("Food", 4000), ("Shopping", 6000))))
    body = {
        "month": MONTH,
        "available_funds": "10000",
        "previous_suggestion": [
            {"category_id": food, "amount": "6000"},
            {"category_id": shopping, "amount": "4000"},
            {"category_id": 999999, "amount": "1"},  # unknown ids are ignored
        ],
    }
    result = api("post", "/ai/budget-recommendation", json=body).json()
    assert result["source"] == "ai"
    system, user = fake.calls[0]
    assert "asked for another plan" in system
    assert json.loads(user)["previous_suggestion"] == [
        {"category": "Food", "amount": "6000.00"},
        {"category": "Shopping", "amount": "4000.00"},
    ]


def test_first_suggestion_has_no_previous(api: Api, use_llm: Any) -> None:
    fake = use_llm(FakeLLM(_ai_reply(("Food", 1000))))
    _recommend(api, "1000", [])
    assert json.loads(fake.calls[0][1])["previous_suggestion"] == []
