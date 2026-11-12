from contextlib import closing
from pathlib import Path
from sqlite3 import connect

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database_models import ProbeRecord
from domain import Direction, Grid, Probe
from repository import ProbeRepository


def test_repository_preserves_legacy_database(tmp_path: Path) -> None:
    database = tmp_path / "probes.sqlite3"
    schema = Path(__file__).with_name("fixtures") / "legacy_schema.sql"
    with closing(connect(database)) as connection:
        connection.executescript(schema.read_text())
        connection.execute(
            "INSERT INTO probes VALUES (?, ?, ?, ?, ?, ?)",
            ("existing", 5, 6, 2, 3, "WEST"),
        )
        connection.commit()

    repository = ProbeRepository(database)
    repository.initialize()
    repository.initialize()
    repository.insert(Probe.at_origin("new", Grid(4, 4), Direction.NORTH))

    with closing(connect(database)) as connection:
        assert connection.execute(
            "SELECT * FROM probes WHERE id = ?", ("existing",)
        ).fetchone() == ("existing", 5, 6, 2, 3, "WEST")
        assert connection.execute(
            "SELECT x, y, direction FROM probes WHERE id = ?", ("new",)
        ).fetchone() == (0, 0, "NORTH")


@pytest.mark.parametrize(
    "fields",
    [
        {"max_x": -1},
        {"max_y": 101},
        {"x": -1},
        {"x": 6},
        {"y": -1},
        {"y": 6},
        {"direction": "INVALID"},
        {"x": 0.5},
    ],
)
def test_database_enforces_constraints(
    tmp_path: Path, fields: dict[str, object]
) -> None:
    repository = ProbeRepository(tmp_path / "probes.sqlite3")
    repository.initialize()
    values = {
        "id": "invalid",
        "max_x": 5,
        "max_y": 5,
        "x": 0,
        "y": 0,
        "direction": "NORTH",
        **fields,
    }
    with (
        pytest.raises(IntegrityError),
        Session(repository.engine) as session,
        session.begin(),
    ):
        session.add(ProbeRecord(**values))

    with Session(repository.engine) as session:
        assert session.get(ProbeRecord, "invalid") is None


def test_failed_insert_rolls_back_and_repository_remains_usable(tmp_path: Path) -> None:
    repository = ProbeRepository(tmp_path / "probes.sqlite3")
    repository.initialize()
    probe = Probe.at_origin("first", Grid(5, 5), Direction.EAST)
    repository.insert(probe)

    with pytest.raises(IntegrityError):
        repository.insert(probe)
    repository.insert(Probe.at_origin("second", Grid(2, 2), Direction.SOUTH))

    with Session(repository.engine) as session:
        first = session.get(ProbeRecord, "first")
        assert first is not None
        assert (first.x, first.y, first.direction) == (0, 0, "EAST")
        assert session.get(ProbeRecord, "second") is not None
