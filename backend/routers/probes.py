from fastapi import APIRouter

from probe_schemas import LaunchRequest, ProbeResponse
from probe_service import launch_probe
from repository import ProbeRepository


def create_probe_router(repository: ProbeRepository) -> APIRouter:
    router = APIRouter(prefix="/probes")

    @router.post("", status_code=201)
    def launch(request: LaunchRequest) -> ProbeResponse:
        probe = launch_probe(
            repository, max_x=request.x, max_y=request.y, direction=request.direction
        )
        return ProbeResponse.model_validate(probe)

    return router
