from dataclasses import dataclass
from enum import StrEnum
from typing import Self

MAX_GRID_COORDINATE = 100


class Direction(StrEnum):
    NORTH = "NORTH"
    EAST = "EAST"
    SOUTH = "SOUTH"
    WEST = "WEST"


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


@dataclass(frozen=True)
class Probe:
    id: str
    position: Position
    direction: Direction
    grid: Grid

    @classmethod
    def at_origin(cls, probe_id: str, grid: Grid, direction: Direction) -> Self:
        return cls(id=probe_id, position=Position(0, 0), direction=direction, grid=grid)
