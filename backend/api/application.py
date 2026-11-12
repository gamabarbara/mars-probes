from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from api.error_handlers import register_error_handlers
from api.router import api_router
from persistence.database import Database
from probe_service import ProbeService


def create_app(database_path: Path) -> FastAPI:
    database = Database(database_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        database.initialize()
        yield

    app = FastAPI(title="Mars Probes API", lifespan=lifespan)
    app.state.probe_service = ProbeService(database)
    register_error_handlers(app)
    app.include_router(api_router)
    return app
