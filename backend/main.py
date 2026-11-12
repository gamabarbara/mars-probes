import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from api.error_handlers import (
    ErrorResponse,
    OutOfBoundsResponse,
    register_error_handlers,
)
from api.probes import (
    create_probe_commands_router,
    create_probe_launch_router,
    create_probe_query_router,
)
from persistence.database import Database


def create_app(database_path: Path) -> FastAPI:
    database = Database(database_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        database.initialize()
        yield

    app = FastAPI(title="Mars Probes API", lifespan=lifespan)
    register_error_handlers(app)
    probe_prefix = "/probes"
    invalid_input = {"model": ErrorResponse, "description": "Invalid request input"}
    write_responses: dict[int | str, dict[str, object]] = {
        400: {"model": ErrorResponse, "description": "Malformed JSON"},
        422: invalid_input,
        503: {"model": ErrorResponse, "description": "Database write timed out"},
    }
    app.include_router(
        create_probe_query_router(database),
        prefix=probe_prefix,
        responses={422: invalid_input},
    )
    app.include_router(
        create_probe_launch_router(database),
        prefix=probe_prefix,
        responses=write_responses,
    )
    app.include_router(
        create_probe_commands_router(database),
        prefix=probe_prefix,
        responses={
            **write_responses,
            404: {"model": ErrorResponse, "description": "Probe not found"},
            409: {
                "model": OutOfBoundsResponse,
                "description": "Command exceeds grid bounds",
            },
        },
    )
    return app


app = create_app(Path(os.environ.get("DATABASE_PATH", "probes.sqlite3")))
