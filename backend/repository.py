import sqlite3
from pathlib import Path

from sqlalchemy import URL, create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from database_models import Base, ProbeRecord
from domain import Probe

WRITE_TIMEOUT_SECONDS = 2.0
PRIMARY_RESULT_CODE_MASK = 0xFF


class DatabaseBusyError(Exception):
    pass


class ProbeRepository:
    def __init__(self, database_path: Path) -> None:
        self.engine = create_engine(
            URL.create("sqlite+pysqlite", database=str(database_path)),
            connect_args={"timeout": WRITE_TIMEOUT_SECONDS, "autocommit": False},
            poolclass=NullPool,
        )

    def initialize(self) -> None:
        Base.metadata.create_all(self.engine)

    def insert(self, probe: Probe) -> None:
        record = ProbeRecord(
            id=probe.id,
            x=probe.position.x,
            y=probe.position.y,
            direction=probe.direction.value,
            max_x=probe.grid.max_x,
            max_y=probe.grid.max_y,
        )
        try:
            with Session(self.engine) as session, session.begin():
                session.add(record)
        except OperationalError as error:
            cause = error.orig
            if (
                isinstance(cause, sqlite3.OperationalError)
                and cause.sqlite_errorcode & PRIMARY_RESULT_CODE_MASK
                == sqlite3.SQLITE_BUSY
            ):
                raise DatabaseBusyError from error
            raise
