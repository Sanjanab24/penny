"""Phase 3: monthly budgets, allocations and spent/remaining math."""

from decimal import Decimal
from typing import Any

import pytest

from app.services.budgets import month_bounds, percent
from tests.helpers import Api, _create_category, _create_expense, _default_id

MONTH = "2026-10"


def _put(api: Api, total: str, allocations: dict[int, str], month: str = MONTH, user="user_a"):
    body = {
        "total_amount": total,
        "allocations": [{"category_id": c, "amount": a} for c, a in allocations.items()],
    }
    return api("put", f"/budgets/{month}", user=user, json=body)


def _usage(summary: dict[str, Any], category_id: int) -> dict[str, Any]:
    return next(c for c in summary["categories"] if c["category_id"] == category_id)


# --- Pure helpers ------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("month", "last_day"),
    [("2026-01", 31), ("2026-02", 28), ("2028-02", 29), ("2026-04", 30), ("2026-12", 31)],
)
def test_month_bounds_handles_short_months(month: str, last_day: int) -> None:
    first, last = month_bounds(month)
    assert first.day == 1 and last.day == last_day
    assert first.month == last.month


def test_percent_rounds_and_handles_zero() -> None:
    assert percent(Decimal("911"), Decimal("1500")) == Decimal("60.7")
    assert percent(Decimal("1"), Decimal("3")) == Decimal("33.3")
    assert percent(Decimal("2"), Decimal("3")) == Decimal("66.7")
    assert percent(Decimal("150"), Decimal("100")) == Decimal("150.0")
    assert percent(Decimal("5"), Decimal("0")) is None


# --- GET ---------------------------------------------------------------------------------


def test_month_without_budget_or_expenses(api: Api) -> None:
    res = api("get", f"/budgets/{MONTH}")
    assert res.status_code == 200
    assert res.json() == {
        "month": MONTH,
        "has_budget": False,
        "total_amount": "0.00",
        "allocated_total": "0.00",
        "recurring_total": "0.00",
        "unallocated": "0.00",
        "spent_total": "0.00",
        "remaining": "0.00",
        "percent_used": None,
        "categories": [],
    }


def test_month_without_budget_still_reports_spending(api: Api) -> None:
    food = _default_id(api, "Food")
    _create_expense(api, amount="250.00", category_id=food)
    summary = api("get", f"/budgets/{MONTH}").json()
    assert summary["has_budget"] is False
    assert summary["spent_total"] == "250.00"
    assert summary["remaining"] == "-250.00"
    usage = _usage(summary, food)
    assert usage["allocated"] == "0.00"
    assert usage["percent_used"] is None
    assert usage["over_budget"] is True


@pytest.mark.parametrize("month", ["2026-13", "2026-00", "2026-1", "oct-2026", "2026-10-01"])
def test_invalid_month_rejected(api: Api, month: str) -> None:
    assert api("get", f"/budgets/{month}").status_code in (404, 422)


# --- Budget math -------------------------------------------------------------------------


def test_spent_remaining_and_percent_per_category(api: Api) -> None:
    food, transport, shopping, groceries = (
        _default_id(api, n) for n in ("Food", "Transportation", "Shopping", "Groceries")
    )
    res = _put(
        api, "5000.00", {food: "1500", transport: "700", shopping: "800", groceries: "500"}
    )
    assert res.status_code == 200, res.json()

    for amount in ("500.00", "411.00"):
        _create_expense(api, amount=amount, category_id=food, date="2026-10-05")
    _create_expense(api, amount="357.00", category_id=transport, date="2026-10-31")
    _create_expense(api, amount="289.00", category_id=groceries, date="2026-10-01")

    summary = api("get", f"/budgets/{MONTH}").json()
    assert summary["has_budget"] is True
    assert summary["total_amount"] == "5000.00"
    assert summary["allocated_total"] == "3500.00"
    assert summary["unallocated"] == "1500.00"
    assert summary["spent_total"] == "1557.00"
    assert summary["remaining"] == "3443.00"
    assert summary["percent_used"] == "31.1"

    food_usage = _usage(summary, food)
    assert food_usage["name"] == "Food"
    assert (food_usage["allocated"], food_usage["spent"], food_usage["remaining"]) == (
        "1500.00",
        "911.00",
        "589.00",
    )
    assert food_usage["percent_used"] == "60.7"
    assert food_usage["over_budget"] is False
    assert _usage(summary, transport)["percent_used"] == "51.0"
    assert _usage(summary, shopping)["spent"] == "0.00"
    assert _usage(summary, shopping)["percent_used"] == "0.0"
    assert _usage(summary, groceries)["remaining"] == "211.00"
    # Ordered by allocation, largest first.
    assert [c["category_id"] for c in summary["categories"]] == [
        food,
        shopping,
        transport,
        groceries,
    ]


def test_over_budget_category(api: Api) -> None:
    food = _default_id(api, "Food")
    _put(api, "1000", {food: "100"})
    _create_expense(api, amount="150.00", category_id=food)
    usage = _usage(api("get", f"/budgets/{MONTH}").json(), food)
    assert usage["remaining"] == "-50.00"
    assert usage["percent_used"] == "150.0"
    assert usage["over_budget"] is True


def test_months_never_mix(api: Api) -> None:
    food = _default_id(api, "Food")
    _put(api, "1000", {food: "500"})
    _create_expense(api, amount="10.00", category_id=food, date="2026-09-30")
    _create_expense(api, amount="20.00", category_id=food, date="2026-10-01")
    _create_expense(api, amount="30.00", category_id=food, date="2026-10-31")
    _create_expense(api, amount="40.00", category_id=food, date="2026-11-01")
    assert api("get", f"/budgets/{MONTH}").json()["spent_total"] == "50.00"
    # Other months keep their own data and have no budget of their own.
    september = api("get", "/budgets/2026-09").json()
    assert september["spent_total"] == "10.00"
    assert september["has_budget"] is False


def test_zero_total_budget(api: Api) -> None:
    res = _put(api, "0", {})
    assert res.status_code == 200
    summary = res.json()
    assert summary["has_budget"] is True
    assert summary["percent_used"] is None
    assert summary["unallocated"] == "0.00"


def test_custom_category_allocation(api: Api) -> None:
    pets = _create_category(api, "Pets")
    _create_expense(api, amount="40.00", category_id=pets["id"])
    summary = _put(api, "1000", {pets["id"]: "200"}).json()
    usage = _usage(summary, pets["id"])
    assert usage["name"] == "Pets" and usage["is_default"] is False
    assert usage["percent_used"] == "20.0"


# --- PUT validation and replacement ------------------------------------------------------


def test_allocations_cannot_exceed_total(api: Api) -> None:
    food, bills = _default_id(api, "Food"), _default_id(api, "Bills")
    res = _put(api, "1000.00", {food: "600.00", bills: "400.01"})
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "allocations_exceed_total"
    assert error["details"]["over_by"] == "0.01"
    # Nothing was saved.
    assert api("get", f"/budgets/{MONTH}").json()["has_budget"] is False


def test_allocations_may_equal_total(api: Api) -> None:
    food, bills = _default_id(api, "Food"), _default_id(api, "Bills")
    summary = _put(api, "1000.00", {food: "600.00", bills: "400.00"}).json()
    assert summary["unallocated"] == "0.00"


@pytest.mark.parametrize(
    "body",
    [
        {"total_amount": "-1", "allocations": []},
        {"total_amount": "1.234", "allocations": []},
        {"total_amount": "100", "allocations": [{"category_id": 1, "amount": "-5"}]},
        {"allocations": []},
    ],
)
def test_put_validation(api: Api, body: dict[str, Any]) -> None:
    res = api("put", f"/budgets/{MONTH}", json=body)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_duplicate_allocation_rejected(api: Api) -> None:
    food = _default_id(api, "Food")
    body = {
        "total_amount": "1000",
        "allocations": [{"category_id": food, "amount": "1"}, {"category_id": food, "amount": "2"}],
    }
    res = api("put", f"/budgets/{MONTH}", json=body)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "duplicate_allocation"


def test_resave_replaces_allocations(api: Api) -> None:
    food, bills, other = (_default_id(api, n) for n in ("Food", "Bills", "Other"))
    _put(api, "1000", {food: "300", bills: "200"})
    # Same category re-saved, one removed, one added, one set to zero (dropped).
    summary = _put(api, "2000", {food: "500", other: "100", bills: "0"}).json()
    assert summary["total_amount"] == "2000.00"
    assert {c["category_id"]: c["allocated"] for c in summary["categories"]} == {
        food: "500.00",
        other: "100.00",
    }


# --- Isolation ---------------------------------------------------------------------------


def test_budgets_are_private(api: Api) -> None:
    food = _default_id(api, "Food")
    _put(api, "1000", {food: "500"}, user="user_a")
    _create_expense(api, amount="99.00", category_id=food, user="user_a")

    other = api("get", f"/budgets/{MONTH}", user="user_b").json()
    assert other["has_budget"] is False
    assert other["spent_total"] == "0.00"
    assert other["categories"] == []

    # B saving the same month creates B's own budget and leaves A's untouched.
    _put(api, "50", {}, user="user_b")
    assert api("get", f"/budgets/{MONTH}", user="user_a").json()["total_amount"] == "1000.00"


def test_cannot_allocate_to_another_users_category(api: Api) -> None:
    pets = _create_category(api, "Pets", user="user_a")
    res = _put(api, "1000", {pets["id"]: "10"}, user="user_b")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_category"


def test_requires_auth(client: Any) -> None:
    assert client.get(f"/api/v1/budgets/{MONTH}").status_code == 401
