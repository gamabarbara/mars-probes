from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request

from api.error_handlers import (
    ErrorResponse,
    IdempotencyConflictResponse,
    OutOfBoundsResponse,
)
from api.schemas import (
    CommandsRequest,
    LaunchRequest,
    ProbeDetailResponse,
    ProbeListQuery,
    ProbeListResponse,
    ProbeResponse,
)
from domain import Probe
from persistence.database import Database
from probe_service import get_probe, launch_probe, list_probes, move_probe


async def get_database(request: Request) -> Database:
    return request.app.state.database


DatabaseDependency = Annotated[Database, Depends(get_database)]

INVALID_INPUT = {"model": ErrorResponse, "description": "Invalid request input"}
PROBE_NOT_FOUND = {"model": ErrorResponse, "description": "Probe not found"}

read_router = APIRouter(responses={422: INVALID_INPUT})
write_router = APIRouter(
    responses={
        400: {"model": ErrorResponse, "description": "Malformed JSON"},
        422: INVALID_INPUT,
        503: {"model": ErrorResponse, "description": "Database write timed out"},
    }
)


@read_router.get("", response_model=ProbeListResponse)
def list_all(
    query: Annotated[ProbeListQuery, Query()], database: DatabaseDependency
) -> dict[str, list[Probe]]:
    probes = list_probes(
        database,
        limit=query.limit,
        offset=query.offset,
        sort_by=query.sort_by,
        descending=query.order == "desc",
    )
    return {"probes": probes}


@read_router.get(
    "/{id}", response_model=ProbeDetailResponse, responses={404: PROBE_NOT_FOUND}
)
def get_by_id(id: str, database: DatabaseDependency) -> Probe:
    return get_probe(database, probe_id=id)


@write_router.post("", status_code=201, response_model=ProbeResponse)
def launch(request: LaunchRequest, database: DatabaseDependency) -> Probe:
    return launch_probe(
        database, max_x=request.x, max_y=request.y, direction=request.direction
    )


@write_router.post(
    "/{id}/commands",
    response_model=ProbeResponse,
    responses={
        404: PROBE_NOT_FOUND,
        409: {
            "model": OutOfBoundsResponse | IdempotencyConflictResponse,
            "description": "Command exceeds grid bounds or move key conflicts",
        },
    },
)
def execute_commands(
    id: str,
    request: CommandsRequest,
    database: DatabaseDependency,
    idempotency_key: Annotated[UUID | None, Header(alias="Idempotency-Key")] = None,
) -> Probe:
    return move_probe(
        database,
        probe_id=id,
        commands=request.commands,
        idempotency_key=str(idempotency_key) if idempotency_key is not None else None,
    )
