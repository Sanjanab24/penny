"""Request helpers shared by the API tests. `api` is the fixture from conftest."""

from collections.abc import Callable
from typing import Any

Api = Callable[..., Any]


def _default_id(api: Api, name: str, user: str = "user_a") -> int:
    return next(c["id"] for c in api("get", "/categories", user=user).json() if c["name"] == name)


def _create_category(api: Api, name: str = "Pets", user: str = "user_a") -> dict:
    res = api(
        "post", "/categories", user=user, json={"name": name, "color": "#AABBCC", "icon": "dog"}
    )
    assert res.status_code == 201, res.json()
    return res.json()


def _create_expense(api: Api, user: str = "user_a", **fields: Any) -> dict:
    body = {"amount": "10.00", "date": "2026-10-01", "description": "", **fields}
    body.setdefault("category_id", _default_id(api, "Food", user))
    res = api("post", "/expenses", user=user, json=body)
    assert res.status_code == 201, res.json()
    return res.json()
