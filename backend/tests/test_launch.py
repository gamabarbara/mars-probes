from contextlib import closing
from pathlib import Path
from sqlite3 import connect
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from main import create_app
from persistence import database as database_module


def test_launch_assigns_unique_ids_and_persists_grid(tmp_path: Path) -> None:
    database = tmp_path / "probes.sqlite3"
    with TestClient(create_app(database)) as client:
        first = client.post("/probes", json={"x": 0, "y": 100, "direction": "EAST"})
        second = client.post("/probes", json={"x": 5, "y": 5, "direction": "NORTH"})

    assert first.status_code == second.status_code == 201
    first_id, second_id = first.json()["id"], second.json()["id"]
    assert first_id != second_id
    assert UUID(first_id).version == UUID(second_id).version == 4
    assert first.json() == {"id": first_id, "x": 0, "y": 0, "direction": "EAST"}

    with TestClient(create_app(database)), closing(connect(database)) as connection:
        saved = connection.execute(
            "SELECT x, y, direction, max_x, max_y FROM probes WHERE id = ?", (first_id,)
        ).fetchone()
    assert saved == (0, 0, "EAST", 0, 100)


@pytest.mark.parametrize(
    "fields",
    [
        {"x": -1},
        {"y": 101},
        {"x": "5"},
        {"y": 2.5},
        {"x": True},
        {"direction": "north"},
    ],
)
def test_launch_rejects_invalid_input(
    tmp_path: Path, fields: dict[str, object]
) -> None:
    database = tmp_path / "probes.sqlite3"
    with TestClient(create_app(database)) as client:
        response = client.post(
            "/probes", json={"x": 5, "y": 5, "direction": "NORTH", **fields}
        )
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"
    with closing(connect(database)) as connection:
        assert connection.execute("SELECT COUNT(*) FROM probes").fetchone() == (0,)


def test_launch_rejects_missing_direction(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.post("/probes", json={"x": 5, "y": 5})
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"


def test_launch_reports_locked_database(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database = tmp_path / "probes.sqlite3"
    monkeypatch.setattr(database_module, "WRITE_TIMEOUT_SECONDS", 0)

    with (
        TestClient(create_app(database)) as client,
        closing(connect(database)) as writer,
    ):
        writer.execute("BEGIN IMMEDIATE")
        response = client.post("/probes", json={"x": 5, "y": 5, "direction": "NORTH"})
        assert response.status_code == 503
        assert response.json()["code"] == "DATABASE_BUSY"
        assert writer.execute("SELECT COUNT(*) FROM probes").fetchone() == (0,)


def test_launch_rejects_malformed_json(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.post(
            "/probes", content="{", headers={"Content-Type": "application/json"}
        )
    assert response.status_code == 400
    assert response.json() == {
        "code": "INVALID_JSON",
        "message": "O JSON enviado é inválido.",
    }


def test_launch_documents_body_and_grid_bounds(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        schema = client.get("/openapi.json").json()

    body = schema["paths"]["/probes"]["post"]["requestBody"]
    assert body["required"] is True
    assert body["content"]["application/json"]["schema"]["$ref"].endswith(
        "/LaunchRequest"
    )
    fields = schema["components"]["schemas"]["LaunchRequest"]["properties"]
    for axis in ("x", "y"):
        assert (fields[axis]["minimum"], fields[axis]["maximum"]) == (0, 100)

    responses = schema["paths"]["/probes"]["post"]["responses"]
    for status in ("400", "422", "503"):
        assert responses[status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ErrorResponse"
        }
