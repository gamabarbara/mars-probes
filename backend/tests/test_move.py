from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from sqlite3 import connect
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from main import create_app
from persistence import database as database_module


def launch(client: TestClient, x: int = 5, y: int = 5) -> dict[str, str | int]:
    response = client.post("/probes", json={"x": x, "y": y, "direction": "NORTH"})
    assert response.status_code == 201
    return response.json()


def test_movement_persists_and_only_changes_the_target_probe(tmp_path: Path) -> None:
    database = tmp_path / "probes.sqlite3"
    with TestClient(create_app(database)) as client:
        target = launch(client)
        other = launch(client, x=0, y=0)
        response = client.post(
            f"/probes/{target['id']}/commands", json={"commands": "MRM"}
        )

    expected = {**target, "x": 1, "y": 1, "direction": "EAST"}
    assert response.status_code == 200
    assert response.json() == expected
    with TestClient(create_app(database)) as client:
        probes = client.get("/probes").json()["probes"]
        assert {probe["id"]: probe for probe in probes} == {
            target["id"]: expected,
            other["id"]: other,
        }


def test_rejected_sequence_preserves_position_and_direction(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        probe = launch(client, x=1)
        response = client.post(
            f"/probes/{probe['id']}/commands", json={"commands": "RMM"}
        )

        assert response.status_code == 409
        assert response.json() == {
            "code": "OUT_OF_BOUNDS",
            "message": "The command at step 3 would move the probe outside the grid.",
            "step": 3,
        }
        assert client.get("/probes").json() == {"probes": [probe]}


def test_move_reports_an_unknown_id(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.post("/probes/unknown/commands", json={"commands": "M"})
    assert response.status_code == 404
    assert response.json() == {
        "code": "PROBE_NOT_FOUND",
        "message": "Probe not found.",
    }


def test_move_rejects_malformed_json(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.post(
            "/probes/unknown/commands",
            content="{",
            headers={"Content-Type": "application/json"},
        )
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_JSON"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"commands": 1},
        {"commands": ""},
        {"commands": "m"},
        {"commands": "M\n"},
        {"commands": "M "},
        {"commands": "R" * 1001},
    ],
)
def test_move_validates_input_before_looking_up_the_probe(
    tmp_path: Path, body: dict[str, str | int]
) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.post("/probes/unknown/commands", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"


def test_invalid_character_takes_precedence_over_leaving_the_grid(
    tmp_path: Path,
) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        probe = launch(client, x=0, y=0)
        response = client.post(
            f"/probes/{probe['id']}/commands", json={"commands": "MX"}
        )
        assert response.status_code == 422
        assert response.json()["code"] == "INVALID_INPUT"
        assert client.get("/probes").json() == {"probes": [probe]}


def test_move_accepts_one_thousand_commands(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        probe = launch(client, x=0, y=0)
        response = client.post(
            f"/probes/{probe['id']}/commands", json={"commands": "R" * 1000}
        )
    assert response.status_code == 200
    assert response.json() == probe


def test_concurrent_moves_both_advance_the_same_probe(tmp_path: Path) -> None:
    ready = Barrier(2, timeout=5)
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        probe = launch(client, x=0, y=2)

        def advance() -> Response:
            ready.wait()
            return client.post(
                f"/probes/{probe['id']}/commands", json={"commands": "M"}
            )

        with ThreadPoolExecutor(max_workers=2) as workers:
            first, second = workers.submit(advance), workers.submit(advance)
            responses = [first.result(), second.result()]

        assert [response.status_code for response in responses] == [200, 200]
        assert sorted(response.json()["y"] for response in responses) == [1, 2]
        assert client.get("/probes").json() == {"probes": [{**probe, "y": 2}]}


def test_move_reports_locked_database_without_changing_the_probe(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database = tmp_path / "probes.sqlite3"
    monkeypatch.setattr(database_module, "WRITE_TIMEOUT_SECONDS", 0)
    with TestClient(create_app(database)) as client:
        probe = launch(client)
        with closing(connect(database)) as writer:
            writer.execute("BEGIN IMMEDIATE")
            response = client.post(
                f"/probes/{probe['id']}/commands", json={"commands": "M"}
            )

        assert response.status_code == 503
        assert response.json()["code"] == "DATABASE_BUSY"
        assert client.get("/probes").json() == {"probes": [probe]}


def test_move_documents_its_request_and_responses(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        schema = client.get("/openapi.json").json()

    move = schema["paths"]["/probes/{id}/commands"]["post"]
    assert move["requestBody"]["required"] is True
    assert move["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/CommandsRequest"
    }
    fields = schema["components"]["schemas"]["CommandsRequest"]["properties"][
        "commands"
    ]
    assert (
        fields["type"],
        fields["minLength"],
        fields["maxLength"],
        fields["pattern"],
    ) == ("string", 1, 1000, "^[MLR]+$")
    assert set(move["responses"]) == {"200", "400", "404", "409", "422", "503"}
    for status, model in (
        ("200", "ProbeResponse"),
        ("400", "ErrorResponse"),
        ("404", "ErrorResponse"),
        ("409", "OutOfBoundsResponse"),
        ("422", "ErrorResponse"),
        ("503", "ErrorResponse"),
    ):
        assert move["responses"][status]["content"]["application/json"]["schema"] == {
            "$ref": f"#/components/schemas/{model}"
        }
    error_fields = schema["components"]["schemas"]["OutOfBoundsResponse"]["properties"]
    assert error_fields["step"]["type"] == "integer"
    assert set(schema["paths"]["/probes"]["post"]["responses"]) == {
        "201",
        "400",
        "422",
        "503",
    }
