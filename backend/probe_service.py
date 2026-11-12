from uuid import uuid4

from domain import Direction, Grid, Probe, ProbeSortField
from persistence.database import Database
from persistence.repository import ProbeRepository


class ProbeNotFoundError(Exception):
    pass


class IdempotencyConflictError(Exception):
    pass


def get_probe(database: Database, *, probe_id: str) -> Probe:
    with database.read_session() as session:
        probe = ProbeRepository(session).get(probe_id)
        if probe is None:
            raise ProbeNotFoundError(probe_id)
        return probe


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


def move_probe(
    database: Database,
    *,
    probe_id: str,
    commands: str,
    idempotency_key: str | None = None,
) -> Probe:
    with database.transaction() as session:
        repository = ProbeRepository(session)
        probe = repository.get(probe_id)
        if probe is None:
            raise ProbeNotFoundError(probe_id)
        if idempotency_key is not None:
            confirmed = repository.get_confirmed_move(probe, idempotency_key)
            if confirmed is not None:
                confirmed_commands, result = confirmed
                if commands != confirmed_commands:
                    raise IdempotencyConflictError
                return result
        moved_probe = probe.execute(commands)
        repository.update_state(moved_probe)
        if idempotency_key is not None:
            repository.record_confirmed_move(moved_probe, idempotency_key, commands)
    return moved_probe
