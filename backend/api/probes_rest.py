from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from api.error_handlers import (
    ErrorResponse,
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
from probe_service import ProbeService


async def get_probe_service(request: Request) -> ProbeService:
    return request.app.state.probe_service


ProbeServiceDependency = Annotated[ProbeService, Depends(get_probe_service)]

PROBE_PREFIX = "/probes"
PROBE_TAG = "probes"
INVALID_INPUT = {"model": ErrorResponse, "description": "Invalid request input"}
PROBE_NOT_FOUND = {"model": ErrorResponse, "description": "Probe not found"}

read_router = APIRouter(
    prefix=PROBE_PREFIX, tags=[PROBE_TAG], responses={422: INVALID_INPUT}
)
write_router = APIRouter(
    prefix=PROBE_PREFIX,
    tags=[PROBE_TAG],
    responses={
        400: {"model": ErrorResponse, "description": "Malformed JSON"},
        422: INVALID_INPUT,
        503: {"model": ErrorResponse, "description": "Database write timed out"},
    },
)


@read_router.get("", summary="List probes", response_model=ProbeListResponse)
def list_all(
    query: Annotated[ProbeListQuery, Query()], service: ProbeServiceDependency
) -> dict[str, list[Probe]]:
    probes = service.list_probes(
        limit=query.limit,
        offset=query.offset,
        sort_by=query.sort_by,
        order=query.order,
    )
    return {"probes": probes}


@read_router.get(
    "/{id}",
    summary="Get a probe",
    response_model=ProbeDetailResponse,
    responses={404: PROBE_NOT_FOUND},
)
def get_by_id(id: str, service: ProbeServiceDependency) -> Probe:
    return service.get_probe(probe_id=id)


@write_router.post(
    "",
    summary="Launch a probe",
    status_code=HTTPStatus.CREATED,
    response_model=ProbeResponse,
)
def launch(request: LaunchRequest, service: ProbeServiceDependency) -> Probe:
    return service.launch_probe(
        max_x=request.x, max_y=request.y, direction=request.direction
    )


@write_router.post(
    "/{id}/commands",
    summary="Execute probe commands",
    response_model=ProbeResponse,
    responses={
        404: PROBE_NOT_FOUND,
        409: {
            "model": OutOfBoundsResponse,
            "description": "Command exceeds grid bounds",
        },
    },
)
def execute_commands(
    id: str, request: CommandsRequest, service: ProbeServiceDependency
) -> Probe:
    return service.move_probe(probe_id=id, commands=request.commands)
