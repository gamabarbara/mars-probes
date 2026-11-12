from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from domain import OutOfBoundsError
from persistence.database import DatabaseBusyError
from probe_service import IdempotencyConflictError, ProbeNotFoundError


class ErrorResponse(BaseModel):
    code: str
    message: str


class OutOfBoundsResponse(ErrorResponse):
    step: int


class IdempotencyConflictResponse(ErrorResponse):
    code: Literal["IDEMPOTENCY_CONFLICT"] = "IDEMPOTENCY_CONFLICT"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(
        _: Request, error: RequestValidationError
    ) -> JSONResponse:
        if any(issue["type"] == "json_invalid" for issue in error.errors()):
            body = ErrorResponse(
                code="INVALID_JSON",
                message="The request body contains invalid JSON.",
            )
            return JSONResponse(status_code=400, content=body.model_dump())

        body = ErrorResponse(
            code="INVALID_INPUT",
            message="Check the data you entered and try again.",
        )
        return JSONResponse(status_code=422, content=body.model_dump())

    @app.exception_handler(ProbeNotFoundError)
    async def probe_not_found(_: Request, __: ProbeNotFoundError) -> JSONResponse:
        body = ErrorResponse(code="PROBE_NOT_FOUND", message="Probe not found.")
        return JSONResponse(status_code=404, content=body.model_dump())

    @app.exception_handler(OutOfBoundsError)
    async def out_of_bounds(_: Request, error: OutOfBoundsError) -> JSONResponse:
        body = OutOfBoundsResponse(
            code="OUT_OF_BOUNDS",
            message=f"The command at step {error.step} would move the probe outside the grid.",
            step=error.step,
        )
        return JSONResponse(status_code=409, content=body.model_dump())

    @app.exception_handler(IdempotencyConflictError)
    async def idempotency_conflict(
        _: Request, __: IdempotencyConflictError
    ) -> JSONResponse:
        body = IdempotencyConflictResponse(
            message="This move key was already used with different commands.",
        )
        return JSONResponse(status_code=409, content=body.model_dump())

    @app.exception_handler(DatabaseBusyError)
    async def database_busy(_: Request, __: DatabaseBusyError) -> JSONResponse:
        body = ErrorResponse(
            code="DATABASE_BUSY",
            message="The database is busy. Try again in a moment.",
        )
        return JSONResponse(status_code=503, content=body.model_dump())
