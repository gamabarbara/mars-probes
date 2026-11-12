from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from sqlite3 import connect
from threading import Barrier
from uuid import uuid4

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


@pytest.mark.parametrize("same_key", [False, True])
def test_concurrent_moves_on_same_probe(tmp_path: Path, same_key: bool) -> None:
    ready = Barrier(2, timeout=5)
    headers = {"Idempotency-Key": str(uuid4())} if same_key else {}
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        probe = launch(client, x=0, y=2)

        def advance() -> Response:
            ready.wait()
            return client.post(
                f"/probes/{probe['id']}/commands",
                json={"commands": "M"},
                headers=headers,
            )

        with ThreadPoolExecutor(max_workers=2) as workers:
            first, second = workers.submit(advance), workers.submit(advance)
            responses = [first.result(), second.result()]

        assert [response.status_code for response in responses] == [200, 200]
        expected_y = 1 if same_key else 2
        assert sorted(response.json()["y"] for response in responses) == [1, expected_y]
        assert client.get("/probes").json() == {"probes": [{**probe, "y": expected_y}]}


def test_move_replays_original_result_after_restart_and_later_move(
    tmp_path: Path,
) -> None:
    database = tmp_path / "probes.sqlite3"
    key = "550e8400-e29b-41d4-a716-446655440000"
    headers = {"Idempotency-Key": key}
    retry_headers = {"Idempotency-Key": key.upper()}
    with TestClient(create_app(database)) as client:
        probe = launch(client)
        url = f"/probes/{probe['id']}/commands"
        first = client.post(url, json={"commands": "M"}, headers=headers)
        assert first.status_code == 200
        assert first.json() == {**probe, "y": 1}

    with TestClient(create_app(database)) as client:
        retry = client.post(url, json={"commands": "M"}, headers=retry_headers)
        assert retry.status_code == 200
        assert retry.json() == first.json()
        assert client.get("/probes").json() == {"probes": [first.json()]}

        later = client.post(
            url, json={"commands": "MR"}, headers={"Idempotency-Key": str(uuid4())}
        )
        assert later.status_code == 200
        assert later.json() == {**probe, "y": 2, "direction": "EAST"}
        replay = client.post(url, json={"commands": "M"}, headers=headers)
        assert replay.status_code == 200
        assert replay.json() == first.json()

        conflict = client.post(url, json={"commands": "R"}, headers=headers)
        assert conflict.status_code == 409
        assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"
        assert client.get("/probes").json() == {"probes": [later.json()]}


def test_move_only_records_confirmed_commands(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        probe = launch(client, x=0)
        url = f"/probes/{probe['id']}/commands"
        invalid = client.post(
            url, json={"commands": "M"}, headers={"Idempotency-Key": "invalid"}
        )
        assert invalid.status_code == 422
        assert invalid.json()["code"] == "INVALID_INPUT"
        headers = {"Idempotency-Key": str(uuid4())}
        rejected = client.post(url, json={"commands": "RM"}, headers=headers)
        assert rejected.status_code == 409
        assert rejected.json()["code"] == "OUT_OF_BOUNDS"
        confirmed = client.post(url, json={"commands": "M"}, headers=headers)
        assert confirmed.status_code == 200
        assert confirmed.json() == {**probe, "y": 1}


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
    key = next(p for p in move["parameters"] if p["in"] == "header")
    assert key["name"] == "Idempotency-Key"
    assert key["required"] is False
    assert {"type": "string", "format": "uuid"} in key["schema"]["anyOf"]
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
        ("422", "ErrorResponse"),
        ("503", "ErrorResponse"),
    ):
        assert move["responses"][status]["content"]["application/json"]["schema"] == {
            "$ref": f"#/components/schemas/{model}"
        }
    conflict_schema = move["responses"]["409"]["content"]["application/json"]["schema"]
    assert {option["$ref"] for option in conflict_schema["anyOf"]} == {
        "#/components/schemas/OutOfBoundsResponse",
        "#/components/schemas/IdempotencyConflictResponse",
    }
    error_fields = schema["components"]["schemas"]["OutOfBoundsResponse"]["properties"]
    assert error_fields["code"]["const"] == "OUT_OF_BOUNDS"
    assert error_fields["step"]["type"] == "integer"
    idempotency_fields = schema["components"]["schemas"]["IdempotencyConflictResponse"][
        "properties"
    ]
    assert idempotency_fields["code"]["const"] == "IDEMPOTENCY_CONFLICT"
    assert set(schema["paths"]["/probes"]["post"]["responses"]) == {
        "201",
        "400",
        "422",
        "503",
    }
