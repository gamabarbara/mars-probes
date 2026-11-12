import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from api.error_handlers import register_error_handlers
from api.router import create_api_router
from persistence.database import Database


def create_app(database_path: Path) -> FastAPI:
    database = Database(database_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        database.initialize()
        yield

    app = FastAPI(title="Mars Probes API", lifespan=lifespan)
    register_error_handlers(app)
    app.include_router(create_api_router(database))
    return app


app = create_app(Path(os.environ.get("DATABASE_PATH", "probes.sqlite3")))
