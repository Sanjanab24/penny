"""Phase 2: categories and expenses CRUD, filters, ownership isolation, reassign-on-delete."""

from collections.abc import Callable
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models import Budget, BudgetAllocation, RecurringExpense, User
from tests.helpers import _create_category, _create_expense, _default_id

# --- Categories --------------------------------------------------------------------------


def test_list_categories_defaults_first_with_counts(api: Callable[..., Any]) -> None:
    _create_category(api, "Aardvark care")
    _create_expense(api)
    cats = api("get", "/categories").json()
    assert [c["is_default"] for c in cats] == [True] * 7 + [False]
    assert cats[-1]["name"] == "Aardvark care"
    food = next(c for c in cats if c["name"] == "Food")
    assert food["expense_count"] == 1


def test_create_category_normalises_color(api: Callable[..., Any]) -> None:
    cat = _create_category(api, "  Pets  ")
    assert cat["name"] == "Pets"
    assert cat["color"] == "#aabbcc"
    assert cat["is_default"] is False


@pytest.mark.parametrize("name", ["pets", "PETS", "food", "Food"])
def test_category_name_clash_is_case_insensitive(api: Callable[..., Any], name: str) -> None:
    _create_category(api, "Pets")
    res = api("post", "/categories", json={"name": name, "color": "#000000", "icon": "x"})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "category_name_taken"


def test_custom_categories_are_private(api: Callable[..., Any]) -> None:
    mine = _create_category(api, "Pets", user="user_a")
    # Same name is fine for another user, and neither sees the other's.
    _create_category(api, "Pets", user="user_b")
    b_names = [c["name"] for c in api("get", "/categories", user="user_b").json()]
    assert b_names.count("Pets") == 1
    assert api("patch", f"/categories/{mine['id']}", user="user_b", json={}).status_code == 404
    assert api("delete", f"/categories/{mine['id']}", user="user_b").status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"name": "", "color": "#000000", "icon": "dog"},
        {"name": "x" * 51, "color": "#000000", "icon": "dog"},
        {"name": "Pets", "color": "red", "icon": "dog"},
        {"name": "Pets", "color": "#000000", "icon": "Not An Icon"},
    ],
)
def test_create_category_validation(api: Callable[..., Any], body: dict) -> None:
    assert api("post", "/categories", json=body).status_code == 422


def test_update_category(api: Callable[..., Any]) -> None:
    cat = _create_category(api, "Pets")
    res = api("patch", f"/categories/{cat['id']}", json={"name": "Pet care", "icon": "cat"})
    assert res.status_code == 200
    assert res.json()["name"] == "Pet care"
    assert res.json()["icon"] == "cat"
    assert res.json()["color"] == "#aabbcc"
    # Renaming to its own name in a different case is not a clash.
    assert api("patch", f"/categories/{cat['id']}", json={"name": "PET CARE"}).status_code == 200


def test_rename_to_existing_name_conflicts(api: Callable[..., Any]) -> None:
    cat = _create_category(api, "Pets")
    res = api("patch", f"/categories/{cat['id']}", json={"name": "groceries"})
    assert res.status_code == 409


def test_default_categories_are_read_only(api: Callable[..., Any]) -> None:
    food = _default_id(api, "Food")
    assert api("patch", f"/categories/{food}", json={"name": "Eats"}).status_code == 403
    res = api("delete", f"/categories/{food}")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "default_category_readonly"


def test_delete_unused_category(api: Callable[..., Any]) -> None:
    cat = _create_category(api)
    assert api("delete", f"/categories/{cat['id']}").status_code == 204
    assert all(c["id"] != cat["id"] for c in api("get", "/categories").json())


def test_delete_used_category_requires_reassign(api: Callable[..., Any]) -> None:
    cat = _create_category(api)
    _create_expense(api, category_id=cat["id"])
    res = api("delete", f"/categories/{cat['id']}")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "category_in_use"
    assert res.json()["error"]["details"]["expense_count"] == 1


def test_delete_with_reassign_moves_everything(
    api: Callable[..., Any], db_factory: sessionmaker[Session]
) -> None:
    cat = _create_category(api)
    food = _default_id(api, "Food")
    expense = _create_expense(api, category_id=cat["id"], amount="12.50")
    with db_factory() as db:
        user = db.scalars(select(User)).one()
        db.add(
            RecurringExpense(
                user_id=user.id,
                category_id=cat["id"],
                amount=5,
                description="Vet plan",
                day_of_month=1,
            )
        )
        budget = Budget(user_id=user.id, month="2026-10", total_amount=500)
        budget.allocations = [
            BudgetAllocation(category_id=cat["id"], amount=40),
            BudgetAllocation(category_id=food, amount=100),
        ]
        db.add(budget)
        db.commit()

    res = api("delete", f"/categories/{cat['id']}", params={"reassign_to": food})
    assert res.status_code == 204
    assert api("get", f"/expenses/{expense['id']}").json()["category_id"] == food
    with db_factory() as db:
        assert db.scalars(select(RecurringExpense.category_id)).one() == food
        allocations = db.scalars(select(BudgetAllocation)).all()
        # The two allocations were merged into one for Food.
        assert [(a.category_id, a.amount) for a in allocations] == [(food, 140)]


def test_reassign_target_must_be_valid(api: Callable[..., Any]) -> None:
    cat = _create_category(api)
    _create_expense(api, category_id=cat["id"])
    others = _create_category(api, "Theirs", user="user_b")
    to_self = api("delete", f"/categories/{cat['id']}", params={"reassign_to": cat["id"]})
    assert to_self.status_code == 422
    to_other_user = api("delete", f"/categories/{cat['id']}", params={"reassign_to": others["id"]})
    assert to_other_user.status_code == 422
    assert to_other_user.json()["error"]["code"] == "invalid_category"


# --- Expenses ----------------------------------------------------------------------------


def test_create_and_get_expense(api: Callable[..., Any]) -> None:
    created = _create_expense(api, amount=12.5, description="  Lunch  ")
    assert created["amount"] == "12.50"
    assert created["description"] == "Lunch"
    assert created["recurring_id"] is None
    fetched = api("get", f"/expenses/{created['id']}").json()
    assert fetched == created


@pytest.mark.parametrize(
    "fields",
    [
        {"amount": "0"},
        {"amount": "-5"},
        {"amount": "1.234"},
        {"amount": "10000000000.00"},
        {"date": "not-a-date"},
        {"description": "x" * 256},
    ],
)
def test_create_expense_validation(api: Callable[..., Any], fields: dict) -> None:
    body = {"amount": "10", "date": "2026-10-01", "category_id": _default_id(api, "Food")}
    assert api("post", "/expenses", json={**body, **fields}).status_code == 422


def test_expense_category_must_be_visible(api: Callable[..., Any]) -> None:
    theirs = _create_category(api, "Theirs", user="user_b")
    for category_id in (theirs["id"], 999_999):
        res = api(
            "post",
            "/expenses",
            json={"amount": "5", "date": "2026-10-01", "category_id": category_id},
        )
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "invalid_category"


def test_expenses_are_private(api: Callable[..., Any]) -> None:
    mine = _create_expense(api, user="user_a")
    _create_expense(api, user="user_b")
    path = f"/expenses/{mine['id']}"
    assert api("get", path, user="user_b").status_code == 404
    assert api("patch", path, user="user_b", json={"amount": "1"}).status_code == 404
    assert api("delete", path, user="user_b").status_code == 404
    assert api("get", "/expenses", user="user_b").json()["total"] == 1


def test_update_expense_partial(api: Callable[..., Any]) -> None:
    expense = _create_expense(api, description="Lunch")
    groceries = _default_id(api, "Groceries")
    res = api(
        "patch", f"/expenses/{expense['id']}", json={"amount": "8.40", "category_id": groceries}
    )
    assert res.status_code == 200
    body = res.json()
    assert (body["amount"], body["category_id"], body["description"]) == ("8.40", groceries, "Lunch")
    bad = api("patch", f"/expenses/{expense['id']}", json={"category_id": 999_999})
    assert bad.status_code == 422


def test_delete_expense(api: Callable[..., Any]) -> None:
    expense = _create_expense(api)
    assert api("delete", f"/expenses/{expense['id']}").status_code == 204
    assert api("get", f"/expenses/{expense['id']}").status_code == 404


def test_list_filters_sorting_and_totals(api: Callable[..., Any]) -> None:
    groceries = _default_id(api, "Groceries")
    _create_expense(api, amount="10.10", date="2026-09-30", description="Coffee beans")
    _create_expense(api, amount="20.20", date="2026-10-05", description="Team lunch")
    _create_expense(
        api, amount="30.30", date="2026-10-20", description="Weekly shop", category_id=groceries
    )

    def listing(**params: Any) -> dict:
        res = api("get", "/expenses", params=params)
        assert res.status_code == 200, res.json()
        return res.json()

    everything = listing()
    assert everything["total"] == 3
    assert everything["total_amount"] == "60.60"
    assert [e["date"] for e in everything["items"]] == ["2026-10-20", "2026-10-05", "2026-09-30"]

    october = listing(date_from="2026-10-01", date_to="2026-10-31")
    assert (october["total"], october["total_amount"]) == (2, "50.50")

    assert listing(category_id=groceries)["total"] == 1
    assert listing(q="LUNCH")["items"][0]["description"] == "Team lunch"
    assert listing(q="%")["total"] == 0  # LIKE wildcards are matched literally
    amounts = [e["amount"] for e in listing(sort="amount_asc")["items"]]
    assert amounts == ["10.10", "20.20", "30.30"]


def test_list_pagination(api: Callable[..., Any]) -> None:
    for day in range(1, 6):
        _create_expense(api, date=f"2026-10-0{day}")
    page2 = api("get", "/expenses", params={"page": 2, "page_size": 2}).json()
    assert (page2["total"], page2["page"], page2["page_size"]) == (5, 2, 2)
    assert [e["date"] for e in page2["items"]] == ["2026-10-03", "2026-10-02"]
    # The sum covers every match, not just this page.
    assert page2["total_amount"] == "50.00"


def test_list_rejects_inverted_date_range(api: Callable[..., Any]) -> None:
    res = api("get", "/expenses", params={"date_from": "2026-10-31", "date_to": "2026-10-01"})
    assert res.status_code == 422
