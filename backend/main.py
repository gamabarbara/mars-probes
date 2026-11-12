import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from http_errors import ErrorResponse, register_error_handlers
from repository import ProbeRepository
from routers.probes import create_probe_router


def create_app(database_path: Path) -> FastAPI:
    repository = ProbeRepository(database_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        repository.initialize()
        yield

    app = FastAPI(title="Mars Probes API", lifespan=lifespan)
    register_error_handlers(app)
    app.include_router(
        create_probe_router(repository),
        responses={
            400: {"model": ErrorResponse, "description": "Malformed JSON"},
            422: {"model": ErrorResponse, "description": "Invalid request input"},
            503: {"model": ErrorResponse, "description": "Database write timed out"},
        },
    )
    return app


app = create_app(Path(os.environ.get("DATABASE_PATH", "probes.sqlite3")))
