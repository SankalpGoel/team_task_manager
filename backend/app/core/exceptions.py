from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base application error. Carries a stable code + human message."""

    status_code: int = 500
    code: str = "server_error"

    def __init__(
        self,
        message: str = "Internal server error",
        *,
        status_code: Optional[int] = None,
        code: Optional[str] = None,
        fields: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.fields = fields or {}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"

    def __init__(self, message: str = "Not found"):
        super().__init__(message)


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"

    def __init__(self, message: str = "Forbidden"):
        super().__init__(message)


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"

    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message)


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"

    def __init__(self, message: str = "Conflict", fields: Optional[dict[str, Any]] = None):
        super().__init__(message, fields=fields)


class ValidationError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "validation_error"

    def __init__(self, message: str = "Invalid input", fields: Optional[dict[str, Any]] = None):
        super().__init__(message, fields=fields)


class RateLimitError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"

    def __init__(self, message: str = "Too many requests"):
        super().__init__(message)


class GoneError(AppError):
    status_code = status.HTTP_410_GONE
    code = "gone"

    def __init__(self, message: str = "Gone"):
        super().__init__(message)


def _error_body(code: str, message: str, fields: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    return {"detail": {"code": code, "message": message, "fields": fields or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message, exc.fields),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # If detail is already in our shape, pass through
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail and "message" in detail:
            return JSONResponse(status_code=exc.status_code, content={"detail": detail})
        # Map common statuses to stable codes
        code_map = {
            400: "bad_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            409: "conflict",
            410: "gone",
            422: "unprocessable_entity",
            429: "rate_limited",
            500: "server_error",
        }
        code = code_map.get(exc.status_code, "error")
        message = str(detail) if detail is not None else code
        return JSONResponse(status_code=exc.status_code, content=_error_body(code, message))

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        field_errors: dict[str, str] = {}
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", []) if p not in ("body", "query", "path"))
            if loc:
                field_errors[loc] = err.get("msg", "invalid")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body("validation_error", "Invalid request", field_errors),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # Keep details out of the response in production
        return JSONResponse(
            status_code=500,
            content=_error_body("server_error", "Internal server error"),
        )
