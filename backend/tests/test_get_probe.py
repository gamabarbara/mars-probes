from pathlib import Path

from fastapi.testclient import TestClient

from main import create_app


def test_get_probe_returns_current_state_and_its_grid(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
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


def test_get_probe_reports_an_unknown_id(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
        response = client.get("/probes/unknown")

    assert response.status_code == 404
    assert response.json() == {
        "code": "PROBE_NOT_FOUND",
        "message": "Probe not found.",
    }


def test_get_probe_documents_its_path_parameter_and_responses(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "probes.sqlite3")) as client:
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
