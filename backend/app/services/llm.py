"""LLM access for AI features, kept behind a tiny interface so the provider can change.

Only the backend talks to the model. Callers get the raw text of a JSON reply and must
validate it themselves; any failure here raises `LLMError`, which callers turn into the
rule-based fallback.
"""

from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import get_settings

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class LLMError(Exception):
    """The model could not be reached or gave no usable answer."""


class LLMClient(Protocol):
    def complete_json(self, system: str, user: str) -> str: ...


class GeminiClient:
    def __init__(self, api_key: str, model: str, timeout: float) -> None:
        self._url = _GEMINI_URL.format(model=model)
        self._headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
        self._timeout = timeout

    def complete_json(self, system: str, user: str) -> str:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                # Budget maths wants consistency, not creativity.
                "temperature": 0.2,
                "maxOutputTokens": 2048,
            },
        }
        try:
            res = httpx.post(self._url, headers=self._headers, json=body, timeout=self._timeout)
        except httpx.HTTPError as exc:
            raise LLMError(f"Gemini request failed: {exc.__class__.__name__}") from exc
        if res.status_code != 200:
            # The body can echo request details, so only the status is surfaced.
            raise LLMError(f"Gemini returned HTTP {res.status_code}")

        data = res.json()
        candidates = data.get("candidates") or []
        if not candidates:
            reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
            raise LLMError(f"Gemini gave no answer ({reason})")
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(part.get("text", "") for part in parts).strip()
        if not text:
            raise LLMError(f"Gemini answer was empty ({candidates[0].get('finishReason')})")
        return text


@lru_cache
def _gemini_singleton() -> GeminiClient:
    settings = get_settings()
    return GeminiClient(settings.gemini_api_key, settings.gemini_model, settings.ai_timeout_seconds)


def get_llm_client() -> LLMClient | None:
    """FastAPI dependency. None means AI is switched off or has no key: use the fallback."""
    settings = get_settings()
    if settings.ai_provider != "gemini" or not settings.gemini_api_key:
        return None
    return _gemini_singleton()
