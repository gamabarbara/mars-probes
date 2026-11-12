import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import URL, create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from persistence.models import Base

WRITE_TIMEOUT_SECONDS = 2.0
PRIMARY_RESULT_CODE_MASK = 0xFF


class DatabaseBusyError(Exception):
    pass


class Database:
    def __init__(self, database_path: Path) -> None:
        self.engine = create_engine(
            URL.create("sqlite+pysqlite", database=str(database_path)),
            connect_args={
                "timeout": WRITE_TIMEOUT_SECONDS,
                "autocommit": sqlite3.LEGACY_TRANSACTION_CONTROL,
            },
            poolclass=NullPool,
        )

    def initialize(self) -> None:
        Base.metadata.create_all(self.engine)

    @contextmanager
    def read_session(self) -> Iterator[Session]:
        with Session(self.engine) as session:
            yield session

    @contextmanager
    def transaction(self) -> Iterator[Session]:
        try:
            with Session(self.engine) as session, session.begin():
                session.connection().exec_driver_sql("BEGIN IMMEDIATE")
                yield session
        except OperationalError as error:
            cause = error.orig
            if (
                isinstance(cause, sqlite3.OperationalError)
                and cause.sqlite_errorcode & PRIMARY_RESULT_CODE_MASK
                == sqlite3.SQLITE_BUSY
            ):
                raise DatabaseBusyError from error
            raise
