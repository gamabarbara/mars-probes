from dataclasses import dataclass, replace
from enum import StrEnum
from typing import Self

MAX_GRID_COORDINATE = 100


class Direction(StrEnum):
    NORTH = "NORTH"
    EAST = "EAST"
    SOUTH = "SOUTH"
    WEST = "WEST"


DIRECTION_OFFSETS = {
    Direction.NORTH: (0, 1),
    Direction.EAST: (1, 0),
    Direction.SOUTH: (0, -1),
    Direction.WEST: (-1, 0),
}
TURN_ORDER = tuple(DIRECTION_OFFSETS)


class OutOfBoundsError(Exception):
    def __init__(self, step: int) -> None:
        super().__init__(f"Command at step {step} would leave the grid.")
        self.step = step


class ProbeSortField(StrEnum):
    ID = "id"
    X = "x"
    Y = "y"
    DIRECTION = "direction"


@dataclass(frozen=True)
class Position:
    x: int
    y: int


@dataclass(frozen=True)
class Grid:
    max_x: int
    max_y: int

    def __post_init__(self) -> None:
        if not (
            0 <= self.max_x <= MAX_GRID_COORDINATE
            and 0 <= self.max_y <= MAX_GRID_COORDINATE
        ):
            raise ValueError(
                f"Grid limits must be between 0 and {MAX_GRID_COORDINATE}."
            )

    def contains(self, position: Position) -> bool:
        return 0 <= position.x <= self.max_x and 0 <= position.y <= self.max_y


@dataclass(frozen=True)
class Probe:
    id: str
    position: Position
    direction: Direction
    grid: Grid

    @classmethod
    def at_origin(cls, probe_id: str, grid: Grid, direction: Direction) -> Self:
        return cls(id=probe_id, position=Position(0, 0), direction=direction, grid=grid)

    def execute(self, commands: str) -> Self:
        position, direction = self.position, self.direction
        for step, command in enumerate(commands, start=1):
            match command:
                case "L" | "R":
                    turn = -1 if command == "L" else 1
                    next_index = (TURN_ORDER.index(direction) + turn) % len(TURN_ORDER)
                    direction = TURN_ORDER[next_index]
                case "M":
                    dx, dy = DIRECTION_OFFSETS[direction]
                    position = Position(position.x + dx, position.y + dy)
                    if not self.grid.contains(position):
                        raise OutOfBoundsError(step)
                case _:
                    raise ValueError(f"Invalid command at step {step}.")

        return replace(self, position=position, direction=direction)
