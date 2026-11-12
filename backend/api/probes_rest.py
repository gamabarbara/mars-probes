from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Query

from api.error_handlers import (
    COMMAND_ERROR_RESPONSES,
    PROBE_NOT_FOUND_RESPONSES,
    VALIDATION_RESPONSES,
    WRITE_ERROR_RESPONSES,
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

PROBE_PREFIX = "/probes"
PROBE_TAG = "probes"


def create_probes_router(service: ProbeService) -> APIRouter:
    read_router = APIRouter(
        prefix=PROBE_PREFIX, tags=[PROBE_TAG], responses=VALIDATION_RESPONSES
    )
    write_router = APIRouter(
        prefix=PROBE_PREFIX,
        tags=[PROBE_TAG],
        responses=WRITE_ERROR_RESPONSES,
    )

    @read_router.get("", summary="List probes", response_model=ProbeListResponse)
    def list_all(query: Annotated[ProbeListQuery, Query()]) -> dict[str, list[Probe]]:
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
        responses=PROBE_NOT_FOUND_RESPONSES,
    )
    def get_by_id(id: str) -> Probe:
        return service.get_probe(probe_id=id)

    @write_router.post(
        "",
        summary="Launch a probe",
        status_code=HTTPStatus.CREATED,
        response_model=ProbeResponse,
    )
    def launch(request: LaunchRequest) -> Probe:
        return service.launch_probe(
            max_x=request.x, max_y=request.y, direction=request.direction
        )

    @write_router.post(
        "/{id}/commands",
        summary="Execute probe commands",
        response_model=ProbeResponse,
        responses=COMMAND_ERROR_RESPONSES,
    )
    def execute_commands(id: str, request: CommandsRequest) -> Probe:
        return service.move_probe(probe_id=id, commands=request.commands)

    router = APIRouter()
    router.include_router(read_router)
    router.include_router(write_router)
    return router
