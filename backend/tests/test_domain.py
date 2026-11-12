import pytest

from domain import Direction, Grid, OutOfBoundsError, Position, Probe


def test_grid_rejects_limits_outside_domain() -> None:
    with pytest.raises(ValueError):
        Grid(max_x=101, max_y=0)


@pytest.mark.parametrize(
    ("start", "left", "right"),
    [
        (Direction.NORTH, Direction.WEST, Direction.EAST),
        (Direction.EAST, Direction.NORTH, Direction.SOUTH),
        (Direction.SOUTH, Direction.EAST, Direction.WEST),
        (Direction.WEST, Direction.SOUTH, Direction.NORTH),
    ],
)
def test_turns_keep_the_position(
    start: Direction, left: Direction, right: Direction
) -> None:
    probe = Probe.at_origin("probe", Grid(0, 0), start)
    assert probe.execute("L") == Probe("probe", probe.position, left, probe.grid)
    assert probe.execute("R") == Probe("probe", probe.position, right, probe.grid)
    for commands in ("LLLL", "RRRR", "LR"):
        assert probe.execute(commands) == probe


@pytest.mark.parametrize(
    ("direction", "edge"),
    [
        (Direction.NORTH, Position(1, 2)),
        (Direction.EAST, Position(2, 1)),
        (Direction.SOUTH, Position(1, 0)),
        (Direction.WEST, Position(0, 1)),
    ],
)
def test_can_reach_but_not_cross_each_edge(
    direction: Direction, edge: Position
) -> None:
    start = Position(1, 1)
    probe = Probe("probe", start, direction, Grid(2, 2))
    assert probe.execute("M").position == edge
    with pytest.raises(OutOfBoundsError) as error:
        probe.execute("MM")
    assert error.value.step == 2
    assert probe.position == start


def test_cannot_advance_in_a_single_cell_grid() -> None:
    probe = Probe.at_origin("probe", Grid(0, 0), Direction.NORTH)
    with pytest.raises(OutOfBoundsError) as error:
        probe.execute("M")
    assert error.value.step == 1
