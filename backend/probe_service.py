from uuid import uuid4

from domain import Direction, Grid, Probe
from repository import ProbeRepository


def launch_probe(
    repository: ProbeRepository, *, max_x: int, max_y: int, direction: Direction
) -> Probe:
    grid = Grid(max_x=max_x, max_y=max_y)
    probe = Probe.at_origin(probe_id=str(uuid4()), grid=grid, direction=direction)
    repository.insert(probe)
    return probe
