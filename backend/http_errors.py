from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from repository import DatabaseBusyError


class ErrorResponse(BaseModel):
    code: str
    message: str


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(
        _: Request, error: RequestValidationError
    ) -> JSONResponse:
        if any(issue["type"] == "json_invalid" for issue in error.errors()):
            body = ErrorResponse(
                code="INVALID_JSON",
                message="O JSON enviado é inválido.",
            )
            return JSONResponse(status_code=400, content=body.model_dump())

        body = ErrorResponse(
            code="INVALID_INPUT",
            message="Revise os dados enviados e tente novamente.",
        )
        return JSONResponse(status_code=422, content=body.model_dump())

    @app.exception_handler(DatabaseBusyError)
    async def database_busy(_: Request, __: DatabaseBusyError) -> JSONResponse:
        body = ErrorResponse(
            code="DATABASE_BUSY",
            message="O banco está ocupado. Tente novamente em instantes.",
        )
        return JSONResponse(status_code=503, content=body.model_dump())
