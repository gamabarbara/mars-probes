from contextlib import closing
from pathlib import Path
from sqlite3 import connect

import pytest
from fastapi.testclient import TestClient

from api.probes import get_database
from main import create_app
from persistence import database as database_module


def test_lists_no_probes_before_first_launch(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.get("/probes")

    assert response.status_code == 200
    assert response.json() == {"probes": []}


def test_database_dependency_can_be_overridden(tmp_path: Path) -> None:
    app = create_app(tmp_path / "probes.sqlite3")
    replacement = database_module.Database(tmp_path / "replacement.sqlite3")
    replacement.initialize()
    app.dependency_overrides[get_database] = lambda: replacement

    with TestClient(app) as client:
        launched = client.post("/probes", json={"x": 2, "y": 4, "direction": "EAST"})
        assert launched.status_code == 201
        assert client.get("/probes").json() == {"probes": [launched.json()]}

        del app.dependency_overrides[get_database]
        assert client.get("/probes").json() == {"probes": []}


def test_lists_launched_probes_after_reopening_database(tmp_path: Path) -> None:
    path = tmp_path / "probes.sqlite3"
    with TestClient(create_app(path)) as client:
        east = client.post("/probes", json={"x": 2, "y": 4, "direction": "EAST"})
        north = client.post("/probes", json={"x": 5, "y": 3, "direction": "NORTH"})
        assert east.status_code == north.status_code == 201
        before_restart = client.get("/probes")

    with TestClient(create_app(path)) as client:
        after_restart = client.get("/probes")

    expected = [
        {"id": east.json()["id"], "x": 0, "y": 0, "direction": "EAST"},
        {"id": north.json()["id"], "x": 0, "y": 0, "direction": "NORTH"},
    ]
    for response in (before_restart, after_restart):
        assert response.status_code == 200
        assert response.json().keys() == {"probes"}
        assert response.json()["probes"] == sorted(
            expected, key=lambda probe: probe["id"]
        )


def test_lists_committed_position_while_another_connection_writes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "probes.sqlite3"
    monkeypatch.setattr(database_module, "WRITE_TIMEOUT_SECONDS", 0)

    with TestClient(create_app(path)) as client, closing(connect(path)) as writer:
        writer.execute(
            "INSERT INTO probes (id, x, y, direction, max_x, max_y) VALUES (?, ?, ?, ?, ?, ?)",
            ("existing", 2, 3, "WEST", 5, 6),
        )
        writer.commit()
        writer.execute("BEGIN IMMEDIATE")
        writer.execute("UPDATE probes SET x = 1 WHERE id = ?", ("existing",))
        response = client.get("/probes")

    assert response.status_code == 200
    assert response.json() == {
        "probes": [{"id": "existing", "x": 2, "y": 3, "direction": "WEST"}]
    }


@pytest.mark.parametrize(
    ("params", "expected_ids"),
    [
        ({"limit": 2}, ["a", "b"]),
        ({"limit": 2, "offset": 2}, ["c"]),
        ({"limit": 2, "offset": 3}, []),
        ({"offset": 1, "order": "desc"}, ["b", "a"]),
        ({"sort_by": "x", "order": "desc", "limit": 1, "offset": 1}, ["c"]),
        ({"sort_by": "y"}, ["b", "c", "a"]),
        ({"sort_by": "direction"}, ["c", "a", "b"]),
    ],
)
def test_list_applies_pagination_and_order(
    tmp_path: Path, params: dict[str, str | int], expected_ids: list[str]
) -> None:
    path = tmp_path / "probes.sqlite3"
    with TestClient(create_app(path)) as client, closing(connect(path)) as writer:
        writer.executemany(
            "INSERT INTO probes (id, x, y, direction, max_x, max_y) VALUES (?, ?, ?, ?, ?, ?)",
            [
                ("c", 3, 1, "EAST", 5, 5),
                ("b", 0, 0, "WEST", 5, 5),
                ("a", 3, 2, "NORTH", 5, 5),
            ],
        )
        writer.commit()
        response = client.get("/probes", params=params)

    assert response.status_code == 200
    assert [probe["id"] for probe in response.json()["probes"]] == expected_ids


@pytest.mark.parametrize(
    "query",
    [
        "limit=0",
        "limit=101",
        "offset=-1",
        "offset=9223372036854775808",
        "sort_by=max_x",
        "order=up",
    ],
)
def test_list_rejects_invalid_query_parameters(tmp_path: Path, query: str) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.get(f"/probes?{query}")

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"


def test_list_documents_query_parameters_and_responses(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        schema = client.get("/openapi.json").json()

    operation = schema["paths"]["/probes"]["get"]
    assert {parameter["name"] for parameter in operation["parameters"]} == {
        "limit",
        "offset",
        "sort_by",
        "order",
    }
    responses = operation["responses"]
    assert responses.keys() == {"200", "422"}
    assert responses["422"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse"
    }
    assert responses["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProbeListResponse"
    }
    list_schema = schema["components"]["schemas"]["ProbeListResponse"]
    assert list_schema["properties"]["probes"]["items"] == {
        "$ref": "#/components/schemas/ProbeResponse"
    }
