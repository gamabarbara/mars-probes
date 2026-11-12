from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.i18n import error_message
from domain import OutOfBoundsError
from persistence.database import DatabaseBusyError
from services.probe_service import ProbeNotFoundError


class ErrorResponse(BaseModel):
    code: str
    message: str


class OutOfBoundsResponse(ErrorResponse):
    code: Literal["OUT_OF_BOUNDS"]
    step: int


VALIDATION_RESPONSES = {422: {"model": ErrorResponse}}
WRITE_ERROR_RESPONSES = {
    **VALIDATION_RESPONSES,
    400: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}
PROBE_NOT_FOUND_RESPONSES = {404: {"model": ErrorResponse}}
COMMAND_ERROR_RESPONSES = {
    **PROBE_NOT_FOUND_RESPONSES,
    409: {"model": OutOfBoundsResponse},
}


def error_response(status_code: int, code: str) -> JSONResponse:
    body = ErrorResponse(code=code, message=error_message(code))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(
        _: Request, error: RequestValidationError
    ) -> JSONResponse:
        if any(issue["type"] == "json_invalid" for issue in error.errors()):
            return error_response(400, "INVALID_JSON")

        return error_response(422, "INVALID_INPUT")

    @app.exception_handler(ProbeNotFoundError)
    async def probe_not_found(_: Request, __: ProbeNotFoundError) -> JSONResponse:
        return error_response(404, "PROBE_NOT_FOUND")

    @app.exception_handler(OutOfBoundsError)
    async def out_of_bounds(_: Request, error: OutOfBoundsError) -> JSONResponse:
        code = "OUT_OF_BOUNDS"
        body = OutOfBoundsResponse(
            code=code,
            message=error_message(code, step=error.step),
            step=error.step,
        )
        return JSONResponse(status_code=409, content=body.model_dump())

    @app.exception_handler(DatabaseBusyError)
    async def database_busy(_: Request, __: DatabaseBusyError) -> JSONResponse:
        return error_response(503, "DATABASE_BUSY")
