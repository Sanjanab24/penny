"""Phase 5: analytics summary, trends and month comparison. Today is 2026-10-19 (conftest)."""

from typing import Any

import pytest

from app.services.analytics import shift_month
from tests.helpers import Api, _create_category, _create_expense, _default_id


def _spend(api: Api, name: str, amount: str, date: str, user: str = "user_a") -> None:
    _create_expense(api, user=user, amount=amount, date=date, category_id=_default_id(api, name, user))


@pytest.mark.parametrize(
    ("month", "delta", "expected"),
    [("2026-01", -1, "2025-12"), ("2026-12", 1, "2027-01"), ("2026-10", -12, "2025-10")],
)
def test_shift_month(month: str, delta: int, expected: str) -> None:
    assert shift_month(month, delta) == expected


# --- Summary -----------------------------------------------------------------------------


def test_summary_empty_month(api: Api) -> None:
    assert api("get", "/analytics/summary?month=2026-10").json() == {
        "month": "2026-10",
        "total": "0.00",
        "expense_count": 0,
        "daily_average": "0.00",
        "categories": [],
    }


def test_summary_breakdown(api: Api) -> None:
    _spend(api, "Food", "600.00", "2026-10-02")
    _spend(api, "Food", "300.00", "2026-10-10")
    _spend(api, "Bills", "100.00", "2026-10-15")
    _spend(api, "Food", "999.00", "2026-09-30")  # other month, excluded

    summary = api("get", "/analytics/summary?month=2026-10").json()
    assert summary["total"] == "1000.00"
    assert summary["expense_count"] == 3
    # Current month: averaged over the 19 days so far.
    assert summary["daily_average"] == "52.63"
    rows = [(c["name"], c["amount"], c["percent"], c["expense_count"]) for c in summary["categories"]]
    assert rows == [("Food", "900.00", "90.0", 2), ("Bills", "100.00", "10.0", 1)]


def test_summary_defaults_to_current_month(api: Api) -> None:
    _spend(api, "Food", "50.00", "2026-10-01")
    assert api("get", "/analytics/summary").json()["month"] == "2026-10"


def test_summary_past_month_averages_over_whole_month(api: Api) -> None:
    _spend(api, "Food", "300.00", "2026-09-10")
    assert api("get", "/analytics/summary?month=2026-09").json()["daily_average"] == "10.00"


def test_summary_includes_custom_categories(api: Api) -> None:
    pets = _create_category(api, "Pets")
    _create_expense(api, amount="75.00", date="2026-10-03", category_id=pets["id"])
    rows = api("get", "/analytics/summary").json()["categories"]
    assert rows[0]["name"] == "Pets" and rows[0]["color"] == pets["color"]


# --- Trends ------------------------------------------------------------------------------


def test_trends_zero_fill_and_budget(api: Api) -> None:
    _spend(api, "Food", "100.00", "2026-05-31")  # before the window
    _spend(api, "Food", "200.00", "2026-06-01")
    _spend(api, "Bills", "50.00", "2026-06-30")
    _spend(api, "Food", "300.00", "2026-08-15")
    _spend(api, "Food", "400.00", "2026-10-19")
    api("put", "/budgets/2026-08", json={"total_amount": "1000", "allocations": []})

    trends = api("get", "/analytics/trends?months=5").json()
    assert [(p["month"], p["total"], p["budget"]) for p in trends["points"]] == [
        ("2026-06", "250.00", None),
        ("2026-07", "0.00", None),
        ("2026-08", "300.00", "1000.00"),
        ("2026-09", "0.00", None),
        ("2026-10", "400.00", None),
    ]
    assert trends["average"] == "190.00"


def test_trends_default_is_six_months_and_crosses_year(api: Api) -> None:
    trends = api("get", "/analytics/trends?end=2026-02").json()
    assert [p["month"] for p in trends["points"]] == [
        "2025-09",
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
    ]


@pytest.mark.parametrize("query", ["months=0", "months=25", "end=2026-13", "end=oct"])
def test_trends_validation(api: Api, query: str) -> None:
    assert api("get", f"/analytics/trends?{query}").status_code == 422


# --- Compare -----------------------------------------------------------------------------


def test_compare_with_previous_month(api: Api) -> None:
    _spend(api, "Food", "500.00", "2026-10-05")
    _spend(api, "Shopping", "200.00", "2026-10-06")
    _spend(api, "Food", "400.00", "2026-09-05")
    _spend(api, "Bills", "100.00", "2026-09-30")

    result = api("get", "/analytics/compare?month=2026-10").json()
    assert result["previous_month"] == "2026-09"
    assert (result["total"], result["previous_total"], result["change"]) == ("700.00", "500.00", "200.00")
    assert result["change_percent"] == "40.0"
    rows = {c["name"]: (c["current"], c["previous"], c["change"]) for c in result["categories"]}
    assert rows == {
        "Food": ("500.00", "400.00", "100.00"),
        "Shopping": ("200.00", "0.00", "200.00"),
        "Bills": ("0.00", "100.00", "-100.00"),
    }
    # Ordered by this month's spending.
    assert [c["name"] for c in result["categories"]] == ["Food", "Shopping", "Bills"]


def test_compare_without_previous_spending(api: Api) -> None:
    _spend(api, "Food", "500.00", "2026-01-05")
    result = api("get", "/analytics/compare?month=2026-01").json()
    assert result["previous_month"] == "2025-12"
    assert result["change_percent"] is None


def test_compare_decrease(api: Api) -> None:
    _spend(api, "Food", "250.00", "2026-10-05")
    _spend(api, "Food", "1000.00", "2026-09-05")
    assert api("get", "/analytics/compare").json()["change_percent"] == "-75.0"


# --- Isolation ---------------------------------------------------------------------------


def test_analytics_are_private(api: Api) -> None:
    _spend(api, "Food", "500.00", "2026-10-05", user="user_a")
    for path in ("/analytics/summary", "/analytics/trends", "/analytics/compare"):
        body: dict[str, Any] = api("get", path, user="user_b").json()
        totals = [body.get("total"), *(p["total"] for p in body.get("points", []))]
        assert all(t in (None, "0.00") for t in totals), path


def test_requires_auth(client: Any) -> None:
    for path in ("/analytics/summary", "/analytics/trends", "/analytics/compare"):
        assert client.get(f"/api/v1{path}").status_code == 401
