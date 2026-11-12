from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Query

from api.schemas import (
    CommandsRequest,
    LaunchRequest,
    ProbeDetailResponse,
    ProbeListQuery,
    ProbeListResponse,
    ProbeResponse,
)
from persistence.database import Database
from probe_service import get_probe, launch_probe, list_probes, move_probe


def create_probe_query_router(database: Database) -> APIRouter:
    router = APIRouter()

    @router.get("")
    def list_all(query: Annotated[ProbeListQuery, Query()]) -> ProbeListResponse:
        probes = list_probes(
            database,
            limit=query.limit,
            offset=query.offset,
            sort_by=query.sort_by,
            descending=query.order == "desc",
        )
        return ProbeListResponse(
            probes=[ProbeResponse.model_validate(probe) for probe in probes],
        )

    return router


def create_probe_detail_router(database: Database) -> APIRouter:
    router = APIRouter()

    @router.get("/{id}")
    def get_by_id(id: str) -> ProbeDetailResponse:
        probe = get_probe(database, probe_id=id)
        return ProbeDetailResponse.model_validate(probe)

    return router


def create_probe_launch_router(database: Database) -> APIRouter:
    router = APIRouter()

    @router.post("", status_code=201)
    def launch(request: LaunchRequest) -> ProbeResponse:
        probe = launch_probe(
            database, max_x=request.x, max_y=request.y, direction=request.direction
        )
        return ProbeResponse.model_validate(probe)

    return router


def create_probe_commands_router(database: Database) -> APIRouter:
    router = APIRouter()

    @router.post("/{id}/commands")
    def execute_commands(
        id: str,
        request: CommandsRequest,
        idempotency_key: Annotated[UUID | None, Header(alias="Idempotency-Key")] = None,
    ) -> ProbeResponse:
        probe = move_probe(
            database,
            probe_id=id,
            commands=request.commands,
            idempotency_key=str(idempotency_key)
            if idempotency_key is not None
            else None,
        )
        return ProbeResponse.model_validate(probe)

    return router
