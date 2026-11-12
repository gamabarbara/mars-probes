from uuid import uuid4

from domain import Direction, Grid, Probe, ProbeSortField
from persistence.database import Database
from persistence.repository import ProbeRepository


def list_probes(
    database: Database,
    *,
    limit: int | None,
    offset: int,
    sort_by: ProbeSortField,
    descending: bool,
) -> list[Probe]:
    with database.read_session() as session:
        return ProbeRepository(session).list_probes(
            limit=limit, offset=offset, sort_by=sort_by, descending=descending
        )


def launch_probe(
    database: Database, *, max_x: int, max_y: int, direction: Direction
) -> Probe:
    grid = Grid(max_x=max_x, max_y=max_y)
    probe = Probe.at_origin(probe_id=str(uuid4()), grid=grid, direction=direction)
    with database.transaction() as session:
        ProbeRepository(session).insert(probe)
    return probe
