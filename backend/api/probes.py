from fastapi import APIRouter

from api.schemas import LaunchRequest, ProbeResponse
from persistence.database import Database
from probe_service import launch_probe


def create_probe_router(database: Database) -> APIRouter:
    router = APIRouter(prefix="/probes")

    @router.post("", status_code=201)
    def launch(request: LaunchRequest) -> ProbeResponse:
        probe = launch_probe(
            database, max_x=request.x, max_y=request.y, direction=request.direction
        )
        return ProbeResponse.model_validate(probe)

    return router
