from api.schemas import ProbeResponse
from domain import Direction, Grid, Position, Probe


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
