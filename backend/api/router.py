from fastapi import APIRouter

from api.error_handlers import (
    ErrorResponse,
    IdempotencyConflictResponse,
    OutOfBoundsResponse,
)
from api.probes import (
    create_probe_commands_router,
    create_probe_detail_router,
    create_probe_launch_router,
    create_probe_query_router,
)
from persistence.database import Database


def create_api_router(database: Database) -> APIRouter:
    router = APIRouter()
    probe_prefix = "/probes"
    invalid_input = {"model": ErrorResponse, "description": "Invalid request input"}
    probe_not_found = {"model": ErrorResponse, "description": "Probe not found"}
    write_responses: dict[int | str, dict[str, object]] = {
        400: {"model": ErrorResponse, "description": "Malformed JSON"},
        422: invalid_input,
        503: {"model": ErrorResponse, "description": "Database write timed out"},
    }
    router.include_router(
        create_probe_query_router(database),
        prefix=probe_prefix,
        responses={422: invalid_input},
    )
    router.include_router(
        create_probe_detail_router(database),
        prefix=probe_prefix,
        responses={404: probe_not_found, 422: invalid_input},
    )
    router.include_router(
        create_probe_launch_router(database),
        prefix=probe_prefix,
        responses=write_responses,
    )
    router.include_router(
        create_probe_commands_router(database),
        prefix=probe_prefix,
        responses={
            **write_responses,
            404: probe_not_found,
            409: {
                "model": OutOfBoundsResponse | IdempotencyConflictResponse,
                "description": "Command exceeds grid bounds or move key conflicts",
            },
        },
    )
    return router
