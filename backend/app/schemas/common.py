from typing import Any, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    """Shape of every error response; referenced in OpenAPI docs."""

    error: ErrorBody


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams(BaseModel):
    model_config = ConfigDict(frozen=True)

    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(50, ge=1, le=200),
) -> PageParams:
    """FastAPI dependency for list endpoints."""
    return PageParams(page=page, page_size=page_size)
