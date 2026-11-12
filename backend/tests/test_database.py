from contextlib import closing
from pathlib import Path
from sqlite3 import connect

import pytest
from sqlalchemy.orm import Session

from domain import Direction, Grid, Probe
from persistence import database as database_module
from persistence.database import Database, DatabaseBusyError
from persistence.models import ProbeRecord
from persistence.repository import ProbeRepository


def test_transaction_rolls_back_flushed_changes(tmp_path: Path) -> None:
    database = Database(tmp_path / "probes.sqlite3")
    database.initialize()

    with (
        pytest.raises(ValueError, match="rejected operation"),
        database.transaction() as session,
    ):
        repository = ProbeRepository(session)
        repository.insert(Probe.at_origin("first", Grid(5, 5), Direction.NORTH))
        session.flush()
        assert session.get(ProbeRecord, "first") is not None
        raise ValueError("rejected operation")

    with Session(database.engine) as session:
        assert session.get(ProbeRecord, "first") is None


def test_transaction_reports_busy_database_on_write(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(database_module, "WRITE_TIMEOUT_SECONDS", 0)
    path = tmp_path / "probes.sqlite3"
    database = Database(path)
    database.initialize()

    with closing(connect(path)) as writer:
        writer.execute("UPDATE probes SET x = x")
        with pytest.raises(DatabaseBusyError), database.transaction() as session:
            ProbeRepository(session).insert(
                Probe.at_origin("first", Grid(5, 5), Direction.NORTH)
            )
