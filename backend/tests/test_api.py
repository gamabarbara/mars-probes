from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from sqlite3 import connect
from threading import Barrier, Event
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response

from api.schemas import ProbeResponse
from domain import Direction, Grid, Position, Probe
from main import create_app
from persistence import database as database_module
from persistence.repository import ProbeRepository
from services import probe_service


def make_client(database_path: Path) -> TestClient:
    return TestClient(create_app(database_path))


@pytest.fixture
def client(database_path: Path) -> Iterator[TestClient]:
    with make_client(database_path) as test_client:
        yield test_client


def test_launch_assigns_unique_ids_and_persists_grid(database_path: Path) -> None:
    with make_client(database_path) as client:
        first = client.post("/probes", json={"x": 0, "y": 100, "direction": "EAST"})
        second = client.post("/probes", json={"x": 5, "y": 5, "direction": "NORTH"})

    assert first.status_code == second.status_code == 201
    first_id, second_id = first.json()["id"], second.json()["id"]
    assert first_id != second_id
    assert UUID(first_id).version == UUID(second_id).version == 4
    assert first.json() == {"id": first_id, "x": 0, "y": 0, "direction": "EAST"}

    with make_client(database_path), closing(connect(database_path)) as connection:
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
    client: TestClient, database_path: Path, fields: dict[str, object]
) -> None:
    response = client.post(
        "/probes", json={"x": 5, "y": 5, "direction": "NORTH", **fields}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"
    with closing(connect(database_path)) as connection:
        assert connection.execute("SELECT COUNT(*) FROM probes").fetchone() == (0,)


def test_launch_rejects_missing_direction(client: TestClient) -> None:
    response = client.post("/probes", json={"x": 5, "y": 5})
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"


def test_launch_reports_locked_database(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(database_module, "WRITE_TIMEOUT_SECONDS", 0)

    with (
        make_client(database_path) as client,
        closing(connect(database_path)) as writer,
    ):
        writer.execute("BEGIN IMMEDIATE")
        response = client.post("/probes", json={"x": 5, "y": 5, "direction": "NORTH"})
        assert response.status_code == 503
        assert response.json()["code"] == "DATABASE_BUSY"
        assert writer.execute("SELECT COUNT(*) FROM probes").fetchone() == (0,)


def test_launch_rejects_malformed_json(client: TestClient) -> None:
    response = client.post(
        "/probes", content="{", headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 400
    assert response.json() == {
        "code": "INVALID_JSON",
        "message": "The request body contains invalid JSON.",
    }


def test_launch_documents_body_and_grid_bounds(client: TestClient) -> None:
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


def test_get_probe_returns_current_state_and_its_grid(client: TestClient) -> None:
    target = client.post("/probes", json={"x": 3, "y": 5, "direction": "NORTH"})
    other = client.post("/probes", json={"x": 0, "y": 2, "direction": "WEST"})
    assert target.status_code == other.status_code == 201
    probe_id = target.json()["id"]

    move = client.post(f"/probes/{probe_id}/commands", json={"commands": "MRM"})
    assert move.status_code == 200
    response = client.get(f"/probes/{probe_id}")

    assert response.status_code == 200
    assert response.json() == {
        "id": probe_id,
        "x": 1,
        "y": 1,
        "direction": "EAST",
        "max_x": 3,
        "max_y": 5,
    }


def test_get_probe_reports_an_unknown_id(client: TestClient) -> None:
    response = client.get("/probes/unknown")

    assert response.status_code == 404
    assert response.json() == {
        "code": "PROBE_NOT_FOUND",
        "message": "Probe not found.",
    }


def test_get_probe_documents_its_path_parameter_and_responses(
    client: TestClient,
) -> None:
    schema = client.get("/openapi.json").json()

    operation = schema["paths"]["/probes/{id}"]["get"]
    (parameter,) = operation["parameters"]
    assert (parameter["name"], parameter["in"], parameter["required"]) == (
        "id",
        "path",
        True,
    )
    assert parameter["schema"]["type"] == "string"
    assert "requestBody" not in operation
    for status, model in (("200", "ProbeDetailResponse"), ("404", "ErrorResponse")):
        assert operation["responses"][status]["content"]["application/json"][
            "schema"
        ] == {"$ref": f"#/components/schemas/{model}"}


def test_lists_no_probes_before_first_launch(client: TestClient) -> None:
    response = client.get("/probes")

    assert response.status_code == 200
    assert response.json() == {"probes": []}


def test_apps_keep_their_probe_services_isolated(
    client: TestClient, tmp_path: Path
) -> None:
    with make_client(tmp_path / "other.sqlite3") as other:
        launched = client.post("/probes", json={"x": 2, "y": 4, "direction": "EAST"})
        assert launched.status_code == 201
        assert client.get("/probes").json() == {"probes": [launched.json()]}
        assert other.get("/probes").json() == {"probes": []}


def test_lists_launched_probes_after_reopening_database(database_path: Path) -> None:
    with make_client(database_path) as client:
        east = client.post("/probes", json={"x": 2, "y": 4, "direction": "EAST"})
        north = client.post("/probes", json={"x": 5, "y": 3, "direction": "NORTH"})
        assert east.status_code == north.status_code == 201
        before_restart = client.get("/probes")

    with make_client(database_path) as client:
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
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(database_module, "WRITE_TIMEOUT_SECONDS", 0)

    with (
        make_client(database_path) as client,
        closing(connect(database_path)) as writer,
    ):
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


def test_list_defaults_to_twenty_probes(
    client: TestClient, database_path: Path
) -> None:
    ids = [f"probe-{index:02}" for index in range(23)]
    with closing(connect(database_path)) as writer:
        writer.executemany(
            "INSERT INTO probes (id, x, y, direction, max_x, max_y) VALUES (?, 0, 0, 'NORTH', 0, 0)",
            [(probe_id,) for probe_id in ids],
        )
        writer.commit()
        first_page = client.get("/probes")
        next_page = client.get("/probes", params={"offset": 20})

    assert first_page.status_code == next_page.status_code == 200
    assert [probe["id"] for probe in first_page.json()["probes"]] == ids[:20]
    assert [probe["id"] for probe in next_page.json()["probes"]] == ids[20:]


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
    client: TestClient,
    database_path: Path,
    params: dict[str, str | int],
    expected_ids: list[str],
) -> None:
    with closing(connect(database_path)) as writer:
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
def test_list_rejects_invalid_query_parameters(client: TestClient, query: str) -> None:
    response = client.get(f"/probes?{query}")

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"


def test_list_documents_query_parameters_and_responses(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    operation = schema["paths"]["/probes"]["get"]
    assert {parameter["name"] for parameter in operation["parameters"]} == {
        "limit",
        "offset",
        "sort_by",
        "order",
    }
    limit = next(
        parameter
        for parameter in operation["parameters"]
        if parameter["name"] == "limit"
    )
    assert limit["required"] is False
    assert limit["schema"]["default"] == 20
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


def launch(client: TestClient, x: int = 5, y: int = 5) -> dict[str, str | int]:
    response = client.post("/probes", json={"x": x, "y": y, "direction": "NORTH"})
    assert response.status_code == 201
    return response.json()


def test_movement_persists_and_only_changes_the_target_probe(
    database_path: Path,
) -> None:
    with make_client(database_path) as client:
        target = launch(client)
        other = launch(client, x=0, y=0)
        response = client.post(
            f"/probes/{target['id']}/commands", json={"commands": "MRM"}
        )

    expected = {**target, "x": 1, "y": 1, "direction": "EAST"}
    assert response.status_code == 200
    assert response.json() == expected
    with make_client(database_path) as client:
        probes = client.get("/probes").json()["probes"]
        assert {probe["id"]: probe for probe in probes} == {
            target["id"]: expected,
            other["id"]: other,
        }


def test_rejected_sequence_preserves_position_and_direction(client: TestClient) -> None:
    probe = launch(client, x=1)
    response = client.post(f"/probes/{probe['id']}/commands", json={"commands": "RMM"})

    assert response.status_code == 409
    assert response.json() == {
        "code": "OUT_OF_BOUNDS",
        "message": "The command at step 3 would move the probe outside the grid.",
        "step": 3,
    }
    assert client.get("/probes").json() == {"probes": [probe]}


def test_move_reports_an_unknown_id(client: TestClient) -> None:
    response = client.post("/probes/unknown/commands", json={"commands": "M"})
    assert response.status_code == 404
    assert response.json() == {
        "code": "PROBE_NOT_FOUND",
        "message": "Probe not found.",
    }


def test_move_rejects_malformed_json(client: TestClient) -> None:
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
    client: TestClient, body: dict[str, str | int]
) -> None:
    response = client.post("/probes/unknown/commands", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"


def test_invalid_character_takes_precedence_over_leaving_the_grid(
    client: TestClient,
) -> None:
    probe = launch(client, x=0, y=0)
    response = client.post(f"/probes/{probe['id']}/commands", json={"commands": "MX"})
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_INPUT"
    assert client.get("/probes").json() == {"probes": [probe]}


def test_move_accepts_one_thousand_commands(client: TestClient) -> None:
    probe = launch(client, x=0, y=0)
    response = client.post(
        f"/probes/{probe['id']}/commands", json={"commands": "R" * 1000}
    )
    assert response.status_code == 200
    assert response.json() == probe


def test_concurrent_moves_on_same_probe(client: TestClient) -> None:
    ready = Barrier(2, timeout=5)
    probe = launch(client, x=0, y=2)

    def advance() -> Response:
        ready.wait()
        return client.post(
            f"/probes/{probe['id']}/commands",
            json={"commands": "M"},
        )

    with ThreadPoolExecutor(max_workers=2) as workers:
        first, second = workers.submit(advance), workers.submit(advance)
        responses = [first.result(), second.result()]

    assert [response.status_code for response in responses] == [200, 200]
    assert sorted(response.json()["y"] for response in responses) == [1, 2]
    assert client.get("/probes").json() == {"probes": [{**probe, "y": 2}]}


def test_move_reports_timeout_waiting_for_another_move(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    first_read = Event()
    resume = Event()
    original_get = ProbeRepository.get

    def pause_after_first_read(
        repository: ProbeRepository, probe_id: str
    ) -> Probe | None:
        probe = original_get(repository, probe_id)
        if not first_read.is_set():
            first_read.set()
            assert resume.wait(timeout=5)
        return probe

    monkeypatch.setattr(ProbeRepository, "get", pause_after_first_read)
    monkeypatch.setattr(probe_service, "MOVE_LOCK_TIMEOUT_SECONDS", 0)
    with ThreadPoolExecutor(max_workers=1) as worker:
        probe = launch(client, x=0, y=2)
        url = f"/probes/{probe['id']}/commands"
        first = worker.submit(client.post, url, json={"commands": "M"})
        try:
            assert first_read.wait(timeout=5)
            blocked = client.post(url, json={"commands": "M"})
            assert blocked.status_code == 503
            assert blocked.json()["code"] == "DATABASE_BUSY"
        finally:
            resume.set()

        assert first.result(timeout=5).status_code == 200
        assert client.get("/probes").json() == {"probes": [{**probe, "y": 1}]}


def test_move_reports_locked_database_without_changing_the_probe(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(database_module, "WRITE_TIMEOUT_SECONDS", 0)
    with make_client(database_path) as client:
        probe = launch(client)
        url = f"/probes/{probe['id']}/commands"
        with closing(connect(database_path)) as writer:
            writer.execute("BEGIN IMMEDIATE")
            response = client.post(url, json={"commands": "M"})

        assert response.status_code == 503
        assert response.json()["code"] == "DATABASE_BUSY"
        assert client.get("/probes").json() == {"probes": [probe]}
        assert client.post(url, json={"commands": "M"}).status_code == 200


def test_move_documents_its_request_and_responses(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    move = schema["paths"]["/probes/{id}/commands"]["post"]
    assert [(p["in"], p["name"]) for p in move["parameters"]] == [("path", "id")]
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
    assert error_fields["code"]["const"] == "OUT_OF_BOUNDS"
    assert error_fields["step"]["type"] == "integer"
    assert set(schema["paths"]["/probes"]["post"]["responses"]) == {
        "201",
        "400",
        "422",
        "503",
    }


def test_probe_response_serializes_current_position() -> None:
    probe = Probe(
        id="probe-id",
        position=Position(2, 3),
        direction=Direction.WEST,
        grid=Grid(5, 5),
    )
    expected = {"id": "probe-id", "x": 2, "y": 3, "direction": "WEST"}

    assert ProbeResponse.model_validate(probe).model_dump(mode="json") == expected
    assert ProbeResponse.model_validate(expected).model_dump(mode="json") == expected
