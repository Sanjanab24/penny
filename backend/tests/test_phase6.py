"""Phase 6: AI budget recommendation, validation and rule-based fallback.

The model is replaced with a fake, so these tests never call Gemini.
Today is 2026-10-19 (conftest); recommendations are requested for November 2026.
"""

import json
from decimal import Decimal
from typing import Any

import httpx
import pytest

from app.core.config import Settings
from app.main import app
from app.services import llm as llm_module
from app.services.ai_budget import format_inr
from app.services.llm import GeminiClient, LLMError, get_llm_client
from tests.helpers import Api, _create_category, _create_expense, _default_id

MONTH = "2026-11"


class FakeLLM:
    """Returns a canned reply (or raises) and records what it was sent."""

    def __init__(self, reply: str | Exception) -> None:
        self.reply = reply
        self.calls: list[tuple[str, str]] = []

    def complete_json(self, system: str, user: str) -> str:
        self.calls.append((system, user))
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


@pytest.fixture()
def use_llm(client: Any):  # noqa: ANN201 - returns a setter
    """use_llm(FakeLLM(...)) or use_llm(None) for 'AI not configured'. Cleared with `client`."""

    def _set(fake: FakeLLM | None) -> FakeLLM | None:
        app.dependency_overrides[get_llm_client] = lambda: fake
        return fake

    return _set


def _recommend(api: Api, funds: str, events: list[str] | None = None, user: str = "user_a") -> Any:
    body = {"month": MONTH, "available_funds": funds, "upcoming_events": events or []}
    return api("post", "/ai/budget-recommendation", user=user, json=body)


def _amounts(result: dict[str, Any]) -> dict[str, str]:
    return {a["name"]: a["amount"] for a in result["allocations"]}


def _total(result: dict[str, Any]) -> Decimal:
    return sum((Decimal(a["amount"]) for a in result["allocations"]), Decimal(0))


def _add_recurring(api: Api, name: str, amount: str, category: str) -> None:
    body = {
        "description": name,
        "amount": amount,
        "day_of_month": 25,
        "category_id": _default_id(api, category),
    }
    assert api("post", "/recurring", json=body).status_code == 201


def _ai_reply(*allocations: tuple[str, float], summary: str = "Plan.") -> str:
    return json.dumps(
        {
            "allocations": [{"category": c, "amount": a, "reason": f"{c} reason"} for c, a in allocations],
            "summary": summary,
        }
    )


# --- Helpers -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("amount", "expected"),
    [
        ("0", "₹0.00"),
        ("999", "₹999.00"),
        ("1000", "₹1,000.00"),
        ("123456.5", "₹1,23,456.50"),
        ("12345678.9", "₹1,23,45,678.90"),
        ("-1500", "-₹1,500.00"),
    ],
)
def test_format_inr(amount: str, expected: str) -> None:
    assert format_inr(Decimal(amount)) == expected


# --- Fallback ------------------------------------------------------------------------------


def test_no_ai_and_no_history_uses_50_30_20(api: Api, use_llm: Any) -> None:
    use_llm(None)
    result = _recommend(api, "10000").json()
    assert result["source"] == "fallback"
    assert result["fallback_reason"] == "AI suggestions aren't set up on the server"
    assert _amounts(result) == {
        "Groceries": "2000.00",
        "Other": "2000.00",
        "Bills": "1500.00",
        "Food": "1500.00",
        "Transportation": "1500.00",
        "Shopping": "1000.00",
        "Subscriptions": "500.00",
    }
    assert _total(result) == Decimal("10000")
    assert "50/30/20" in result["summary"]


def test_fallback_splits_exactly_with_awkward_amounts(api: Api, use_llm: Any) -> None:
    use_llm(None)
    result = _recommend(api, "10000.01").json()
    assert _total(result) == Decimal("10000.01")


def test_recurring_is_covered_first(api: Api, use_llm: Any) -> None:
    use_llm(None)
    _add_recurring(api, "Rent", "15000", "Bills")
    _add_recurring(api, "Netflix", "649", "Subscriptions")
    result = _recommend(api, "50000").json()
    assert result["recurring_total"] == "15649.00"
    assert _total(result) == Decimal("50000")
    by_name = {a["name"]: a for a in result["allocations"]}
    # Bills = 15000 rent + 15% of the remaining 34,351.
    assert by_name["Bills"]["recurring"] == "15000.00"
    assert Decimal(by_name["Bills"]["amount"]) == Decimal("15000") + Decimal("5152.65")
    assert "Rent" in by_name["Bills"]["reason"]
    assert "Netflix" in by_name["Subscriptions"]["reason"]


def test_funds_below_recurring_is_rejected(api: Api, use_llm: Any) -> None:
    use_llm(None)
    _add_recurring(api, "Rent", "15000", "Bills")
    res = _recommend(api, "10000")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "funds_below_recurring"


def test_funds_equal_to_recurring(api: Api, use_llm: Any) -> None:
    fake = use_llm(FakeLLM(_ai_reply()))
    _add_recurring(api, "Rent", "15000", "Bills")
    result = _recommend(api, "15000").json()
    assert result["source"] == "fallback"
    assert _amounts(result) == {"Bills": "15000.00"}
    assert fake.calls == []  # nothing left to plan, so the AI isn't asked


def _charged_recurring(api: Api, name: str, amount: str, category: str) -> None:
    """A recurring payment whose October charge (on the 5th) was already recorded."""
    body = {
        "description": name,
        "amount": amount,
        "day_of_month": 5,
        "category_id": _default_id(api, category),
        "charge_current_month": True,
    }
    assert api("post", "/recurring", json=body).status_code == 201


def test_current_month_so_far_drives_the_split(api: Api, use_llm: Any) -> None:
    """Regression: with spending only in the current month, history must not be empty."""
    use_llm(None)
    for name, amount in (("Food", "900"), ("Transportation", "600"), ("Shopping", "450"), ("Groceries", "50")):
        _create_expense(api, amount=amount, date="2026-10-03", category_id=_default_id(api, name))

    result = api(
        "post", "/ai/budget-recommendation", json={"month": "2026-10", "available_funds": "10000"}
    ).json()
    assert result["based_on"] == "your spending in October so far"
    # Same proportions as the spending: groceries, the smallest spend, gets the least.
    assert _amounts(result) == {
        "Food": "4500.00",
        "Transportation": "3000.00",
        "Shopping": "2250.00",
        "Groceries": "250.00",
    }
    assert "50/30/20" not in result["summary"]


def test_fallback_history_weights_the_current_month_and_skips_recurring(
    api: Api, use_llm: Any
) -> None:
    use_llm(None)
    food, shopping = _default_id(api, "Food"), _default_id(api, "Shopping")
    _create_expense(api, amount="3100", date="2026-09-05", category_id=food)
    _create_expense(api, amount="620", date="2026-09-20", category_id=shopping)
    # 19 of October's 31 days have passed (conftest), so this is a 3100/month pace.
    _create_expense(api, amount="1900", date="2026-10-05", category_id=food)
    # Netflix's October charge is a recurring expense and must not count as Subscriptions habit.
    _charged_recurring(api, "Netflix", "649", "Subscriptions")

    result = _recommend(api, "10649").json()
    amounts = {name: Decimal(value) for name, value in _amounts(result).items()}
    # Averages: Food 3100, Shopping 620 x 31/50 = 384.40.
    assert abs(amounts["Food"] - Decimal("10000") * 3100 / Decimal("3484.40")) <= Decimal("0.01")
    assert abs(amounts["Shopping"] - Decimal("10000") * Decimal("384.40") / Decimal("3484.40")) <= Decimal("0.01")
    assert amounts["Subscriptions"] == Decimal("649.00")  # recurring only, nothing extra
    assert _total(result) == Decimal("10649")
    assert result["based_on"] == "your spending over the last 2 months (including this month so far)"
    assert result["based_on"] in result["summary"]


def test_no_history_has_no_basis(api: Api, use_llm: Any) -> None:
    use_llm(None)
    assert _recommend(api, "1000").json()["based_on"] is None


def test_fallback_mentions_unhandled_events(api: Api, use_llm: Any) -> None:
    use_llm(None)
    result = _recommend(api, "5000", ["Trip to Goa, 3 days, 4 people"]).json()
    assert "Events without a budget weren't factored in" in result["summary"]


# --- AI path -------------------------------------------------------------------------------


def test_ai_suggestion_is_used_when_valid(api: Api, use_llm: Any) -> None:
    _add_recurring(api, "Netflix", "649", "Subscriptions")
    fake = use_llm(FakeLLM(_ai_reply(("Food", 6000), ("Transportation", 3000), ("Other", 1000))))
    result = _recommend(api, "10649", ["Trip to Goa, 3 days, 4 people"]).json()
    assert result["source"] == "ai"
    assert result["fallback_reason"] is None
    assert result["summary"] == "Plan."
    assert _amounts(result) == {
        "Food": "6000.00",
        "Transportation": "3000.00",
        "Other": "1000.00",
        "Subscriptions": "649.00",
    }
    assert len(fake.calls) == 1


def test_ai_context_has_aggregates_but_no_descriptions(api: Api, use_llm: Any) -> None:
    pets = _create_category(api, "Pets")
    _create_expense(api, amount="1200", date="2026-10-02", description="Dinner with Priya at Taj")
    _create_expense(api, amount="300", date="2026-09-02", category_id=pets["id"], description="vet")
    _add_recurring(api, "Netflix", "649", "Subscriptions")
    fake = use_llm(FakeLLM(_ai_reply(("Food", 1000))))

    _recommend(api, "1649", ["Trip to Goa"])
    system, user = fake.calls[0]
    context = json.loads(user)

    assert "JSON only" in system
    assert "Do NOT apply generic rules" in system
    assert "Priya" not in user and "vet" not in user and "Netflix" not in user
    assert context["currency"] == "INR"
    assert context["amount_to_allocate"] == "1000.00"
    assert context["recurring_commitments"]["total"] == "649.00"
    assert "Pets" in context["categories"] and "Food" in context["categories"]
    assert context["upcoming_events"] == ["Trip to Goa"]

    history = context["history"]
    assert history["months_with_data"] == ["2026-09", "2026-10"]
    assert history["current_month_days_so_far"] == "19 of 31"
    # September counts as a full month and October as 19/31 of one: 1200 x 31/50 = 744.
    assert history["average_monthly_spend"] == [
        {"category": "Food", "average": "744.00", "share_percent": "80.0"},
        {"category": "Pets", "average": "186.00", "share_percent": "20.0"},
    ]


def test_ai_context_excludes_recurring_charges(api: Api, use_llm: Any) -> None:
    subs = _default_id(api, "Subscriptions")
    _create_expense(api, amount="200", date="2026-10-05", category_id=subs)  # a manual one-off
    _charged_recurring(api, "Netflix", "649", "Subscriptions")  # recorded with recurring_id
    fake = use_llm(FakeLLM(_ai_reply(("Food", 1000))))
    _recommend(api, "1649")
    history = json.loads(fake.calls[0][1])["history"]["average_monthly_spend"]
    # Only the manual 200 counts (projected to a full month: 200 x 31/19).
    assert history == [{"category": "Subscriptions", "average": "326.32", "share_percent": "100.0"}]


def test_ai_can_allocate_to_custom_categories(api: Api, use_llm: Any) -> None:
    _create_category(api, "Pets")
    use_llm(FakeLLM(_ai_reply(("pets", 400), ("Food", 600))))  # matched case-insensitively
    result = _recommend(api, "1000").json()
    assert result["source"] == "ai"
    assert _amounts(result) == {"Food": "600.00", "Pets": "400.00"}


def test_ai_rounding_cent_is_absorbed(api: Api, use_llm: Any) -> None:
    use_llm(FakeLLM(_ai_reply(("Food", 333.33), ("Bills", 333.33), ("Other", 333.33))))
    result = _recommend(api, "1000").json()
    assert result["source"] == "ai"
    assert _total(result) == Decimal("1000")


def test_ai_json_in_code_fence_is_accepted(api: Api, use_llm: Any) -> None:
    use_llm(FakeLLM(f"```json\n{_ai_reply(('Food', 1000))}\n```"))
    assert _recommend(api, "1000").json()["source"] == "ai"


@pytest.mark.parametrize(
    "reply",
    [
        "Sure! Here's a budget plan for you.",
        "{}",
        '{"allocations": "lots", "summary": ""}',
        _ai_reply(("Food", 900)),  # sums to 900, not 1000
        _ai_reply(("Food", 1100), ("Bills", -100)),  # negative amount
        _ai_reply(("Holidays", 1000)),  # not one of the user's categories
        _ai_reply(("Food", 500), ("food", 500)),  # duplicate
        json.dumps({"allocations": [{"category": "Food", "amount": "NaN"}], "summary": ""}),
    ],
)
def test_invalid_ai_answers_fall_back(api: Api, use_llm: Any, reply: str) -> None:
    use_llm(FakeLLM(reply))
    result = _recommend(api, "1000").json()
    assert result["source"] == "fallback"
    assert result["fallback_reason"] == "The AI's answer didn't pass our checks"
    assert _total(result) == Decimal("1000")


def test_ai_errors_fall_back(api: Api, use_llm: Any) -> None:
    use_llm(FakeLLM(LLMError("timeout")))
    result = _recommend(api, "1000").json()
    assert result["source"] == "fallback"
    assert result["fallback_reason"] == "The AI service couldn't be reached"


def test_recommendation_is_never_saved(api: Api, use_llm: Any) -> None:
    use_llm(FakeLLM(_ai_reply(("Food", 1000))))
    _recommend(api, "1000")
    assert api("get", f"/budgets/{MONTH}").json()["has_budget"] is False


# --- Isolation and validation --------------------------------------------------------------


def test_other_users_categories_and_history_are_not_used(api: Api, use_llm: Any) -> None:
    _create_category(api, "Secret", user="user_b")
    _create_expense(api, user="user_b", amount="9999", date="2026-10-01")
    fake = use_llm(FakeLLM(_ai_reply(("Secret", 1000))))

    result = _recommend(api, "1000", user="user_a").json()
    context = json.loads(fake.calls[0][1])
    assert "Secret" not in context["categories"]
    assert context["history"]["average_monthly_spend"] == []
    # Naming B's category is rejected for A.
    assert result["source"] == "fallback"


@pytest.mark.parametrize(
    "body",
    [
        {"month": MONTH, "available_funds": "-1"},
        {"month": "2026-13", "available_funds": "1000"},
        {"month": MONTH, "available_funds": "1000", "upcoming_events": ["x"] * 11},
        {"month": MONTH, "available_funds": "1000", "upcoming_events": ["x" * 301]},
        {"month": MONTH, "available_funds": "1000", "upcoming_events": ["   "]},
    ],
)
def test_request_validation(api: Api, use_llm: Any, body: dict[str, Any]) -> None:
    use_llm(None)
    res = api("post", "/ai/budget-recommendation", json=body)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_requires_auth(client: Any) -> None:
    res = client.post("/api/v1/ai/budget-recommendation", json={"month": MONTH, "available_funds": "1"})
    assert res.status_code == 401


# --- Gemini client -------------------------------------------------------------------------


def _fake_post(response: httpx.Response | Exception, seen: list[dict[str, Any]]):  # noqa: ANN202
    def post(url: str, **kwargs: Any) -> httpx.Response:
        seen.append({"url": url, **kwargs})
        if isinstance(response, Exception):
            raise response
        return response

    return post


def _client() -> GeminiClient:
    return GeminiClient(api_key="test-key", model="gemini-test", timeout=5)


def test_gemini_client_sends_json_request(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[dict[str, Any]] = []
    body = {"candidates": [{"content": {"parts": [{"text": '{"a": '}, {"text": "1}"}]}}]}
    monkeypatch.setattr(llm_module.httpx, "post", _fake_post(httpx.Response(200, json=body), seen))

    assert _client().complete_json("system text", "user text") == '{"a": 1}'
    request = seen[0]
    assert request["url"].endswith("/models/gemini-test:generateContent")
    assert request["headers"]["x-goog-api-key"] == "test-key"
    assert request["json"]["generationConfig"]["responseMimeType"] == "application/json"
    assert request["json"]["systemInstruction"]["parts"][0]["text"] == "system text"
    assert request["timeout"] == 5


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(429, json={"error": {"message": "quota"}}),
        httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}),
        httpx.Response(200, json={"candidates": [{"finishReason": "MAX_TOKENS", "content": {}}]}),
        httpx.ReadTimeout("slow"),
    ],
)
def test_gemini_client_failures_raise_llm_error(
    monkeypatch: pytest.MonkeyPatch, response: httpx.Response | Exception
) -> None:
    monkeypatch.setattr(llm_module.httpx, "post", _fake_post(response, []))
    with pytest.raises(LLMError):
        _client().complete_json("s", "u")


@pytest.mark.parametrize(
    ("settings", "configured"),
    [
        (Settings(ai_provider="gemini", gemini_api_key="k"), True),
        (Settings(ai_provider="gemini", gemini_api_key=""), False),
        (Settings(ai_provider="none", gemini_api_key="k"), False),
    ],
)
def test_llm_client_only_when_configured(
    monkeypatch: pytest.MonkeyPatch, settings: Settings, configured: bool
) -> None:
    monkeypatch.setattr(llm_module, "get_settings", lambda: settings)
    llm_module._gemini_singleton.cache_clear()
    try:
        assert (get_llm_client() is not None) is configured
    finally:
        llm_module._gemini_singleton.cache_clear()
