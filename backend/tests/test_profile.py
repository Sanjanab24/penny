"""Onboarding profile (age, occupation) and its use in the AI context."""

import json
from typing import Any

import pytest

from app.main import app
from app.services.llm import get_llm_client
from tests.helpers import Api
from tests.test_phase6 import FakeLLM, _ai_reply


def test_new_user_is_not_onboarded(api: Api) -> None:
    assert api("get", "/me/profile").json() == {"age": None, "occupation": None, "onboarded": False}


def test_save_profile(api: Api) -> None:
    res = api("put", "/me/profile", json={"age": 21, "occupation": "student_undergraduate"})
    assert res.status_code == 200
    assert res.json() == {"age": 21, "occupation": "student_undergraduate", "onboarded": True}
    assert api("get", "/me/profile").json()["occupation"] == "student_undergraduate"


def test_skip_marks_onboarded_without_data(api: Api) -> None:
    assert api("put", "/me/profile", json={}).json() == {
        "age": None,
        "occupation": None,
        "onboarded": True,
    }


def test_profile_can_be_edited_and_cleared(api: Api) -> None:
    api("put", "/me/profile", json={"age": 24, "occupation": "student_postgraduate"})
    edited = api("put", "/me/profile", json={"age": 25, "occupation": "working_professional"})
    assert edited.json()["occupation"] == "working_professional"
    cleared = api("put", "/me/profile", json={}).json()
    assert cleared == {"age": None, "occupation": None, "onboarded": True}


@pytest.mark.parametrize(
    "body",
    [{"age": 12}, {"age": 101}, {"age": "old"}, {"occupation": "astronaut"}],
)
def test_profile_validation(api: Api, body: dict[str, Any]) -> None:
    res = api("put", "/me/profile", json=body)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_profiles_are_private(api: Api) -> None:
    api("put", "/me/profile", json={"age": 30, "occupation": "self_employed"}, user="user_a")
    assert api("get", "/me/profile", user="user_b").json()["onboarded"] is False


def test_profile_reaches_the_ai(api: Api, client: Any) -> None:
    fake = FakeLLM(_ai_reply(("Food", 1000)))
    app.dependency_overrides[get_llm_client] = lambda: fake
    api("put", "/me/profile", json={"age": 20, "occupation": "student_undergraduate"})
    api("post", "/ai/budget-recommendation", json={"month": "2026-11", "available_funds": "1000"})
    system, user = fake.calls[0]
    assert json.loads(user)["profile"] == {"age": 20, "occupation": "undergraduate student"}
    assert '"profile"' in system


def test_no_profile_sends_null(api: Api, client: Any) -> None:
    fake = FakeLLM(_ai_reply(("Food", 1000)))
    app.dependency_overrides[get_llm_client] = lambda: fake
    api("post", "/ai/budget-recommendation", json={"month": "2026-11", "available_funds": "1000"})
    assert json.loads(fake.calls[0][1])["profile"] is None


def test_requires_auth(client: Any) -> None:
    assert client.get("/api/v1/me/profile").status_code == 401
