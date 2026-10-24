"""Savings: the month's budget minus what was spent. Today is 2026-10-19 (conftest)."""

from typing import Any

from tests.helpers import Api, _create_expense


def _budget(api: Api, month: str, total: str, user: str = "user_a") -> None:
    body = {"total_amount": total, "allocations": []}
    assert api("put", f"/budgets/{month}", user=user, json=body).status_code == 200


def _savings(api: Api, query: str = "", user: str = "user_a") -> dict[str, Any]:
    res = api("get", f"/analytics/savings{query}", user=user)
    assert res.status_code == 200, res.json()
    return res.json()


def test_no_data(api: Api) -> None:
    result = _savings(api)
    assert [p["month"] for p in result["points"]] == [
        "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]
    assert all(p["saved"] is None for p in result["points"])
    assert result["last_month"]["month"] == "2026-09"
    assert result["months_counted"] == 0
    assert result["total_saved"] == "0.00"
    assert result["average_saved"] is None and result["average_rate"] is None


def test_saved_last_month(api: Api) -> None:
    _budget(api, "2026-09", "6000")
    _create_expense(api, amount="5000.00", date="2026-09-10")
    _create_expense(api, amount="34.00", date="2026-09-30")
    _create_expense(api, amount="999.00", date="2026-10-01")  # other month

    last = _savings(api)["last_month"]
    assert last == {
        "month": "2026-09",
        "status": "complete",
        "budget": "6000.00",
        "spent": "5034.00",
        "saved": "966.00",
        "savings_rate": "16.1",
    }


def test_overspending_is_negative(api: Api) -> None:
    _budget(api, "2026-09", "1000")
    _create_expense(api, amount="1250.00", date="2026-09-10")
    last = _savings(api)["last_month"]
    assert (last["saved"], last["savings_rate"]) == ("-250.00", "-25.0")


def test_month_without_budget_has_no_savings_figure(api: Api) -> None:
    _create_expense(api, amount="500.00", date="2026-09-10")
    last = _savings(api)["last_month"]
    assert last["budget"] is None and last["saved"] is None and last["savings_rate"] is None
    assert last["spent"] == "500.00"


def test_zero_budget(api: Api) -> None:
    _budget(api, "2026-09", "0")
    last = _savings(api)["last_month"]
    assert (last["saved"], last["savings_rate"]) == ("0.00", None)


def test_totals_count_complete_months_only(api: Api) -> None:
    _budget(api, "2026-08", "10000")
    _create_expense(api, amount="7000.00", date="2026-08-05")  # saved 3000
    _budget(api, "2026-09", "10000")
    _create_expense(api, amount="11000.00", date="2026-09-05")  # overspent 1000
    _budget(api, "2026-10", "10000")  # current month: in progress, not counted
    _create_expense(api, amount="100.00", date="2026-10-05")

    result = _savings(api)
    by_month = {p["month"]: p for p in result["points"]}
    assert by_month["2026-10"]["status"] == "in_progress"
    assert by_month["2026-10"]["saved"] == "9900.00"
    assert by_month["2026-07"]["saved"] is None
    assert result["months_counted"] == 2
    assert result["total_saved"] == "2000.00"
    assert result["average_saved"] == "1000.00"
    assert result["average_rate"] == "10.0"


def test_future_months_and_window(api: Api) -> None:
    _budget(api, "2026-11", "8000")
    result = _savings(api, "?months=3&end=2026-11")
    assert [(p["month"], p["status"]) for p in result["points"]] == [
        ("2026-09", "complete"),
        ("2026-10", "in_progress"),
        ("2026-11", "future"),
    ]
    assert result["points"][-1]["saved"] == "8000.00"
    assert result["months_counted"] == 0  # September had no budget


def test_last_month_outside_the_window(api: Api) -> None:
    _budget(api, "2026-09", "500")
    _create_expense(api, amount="100.00", date="2026-09-03")
    result = _savings(api, "?months=2&end=2027-01")
    assert [p["month"] for p in result["points"]] == ["2026-12", "2027-01"]
    assert result["last_month"]["saved"] == "400.00"


def test_savings_are_private(api: Api) -> None:
    _budget(api, "2026-09", "6000", user="user_a")
    _create_expense(api, amount="100.00", date="2026-09-03", user="user_a")
    other = _savings(api, user="user_b")
    assert other["last_month"]["budget"] is None
    assert other["last_month"]["spent"] == "0.00"


def test_validation_and_auth(api: Api, client: Any) -> None:
    assert api("get", "/analytics/savings?months=0").status_code == 422
    assert api("get", "/analytics/savings?end=2026-13").status_code == 422
    assert client.get("/api/v1/analytics/savings").status_code == 401
