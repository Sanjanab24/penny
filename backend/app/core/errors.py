"""Consistent error envelope for every non-2xx response:

    {"error": {"code": "not_found", "message": "Expense not found", "details": null}}
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# Fallback codes for plain HTTPExceptions raised without an AppError.
_STATUS_CODES: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
    503: "service_unavailable",
}


class AppError(Exception):
    """Raise from services/routes for expected failures with a machine-readable code."""

    def __init__(
        self, status_code: int, code: str, message: str, details: Any | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def _envelope(status_code: int, code: str, message: str, details: Any = None) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "details": details}}
    return JSONResponse(status_code=status_code, content=jsonable_encoder(body))


async def _app_error(_: Request, exc: AppError) -> JSONResponse:
    return _envelope(exc.status_code, exc.code, exc.message, exc.details)


async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _STATUS_CODES.get(exc.status_code, "http_error")
    response = _envelope(exc.status_code, code, str(exc.detail))
    if exc.headers:
        response.headers.update(exc.headers)
    return response


async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"loc": list(err["loc"]), "msg": err["msg"], "type": err["type"]} for err in exc.errors()
    ]
    return _envelope(
        status.HTTP_422_UNPROCESSABLE_CONTENT, "validation_error", "Invalid request", details
    )


async def _unhandled_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return _envelope(500, "internal_error", "An unexpected error occurred")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, _http_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_error)
