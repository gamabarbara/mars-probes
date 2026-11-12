from typing import Literal
from uuid import UUID, uuid4

from domain import Direction, Grid, Probe, ProbeSortField
from persistence.database import Database
from persistence.repository import ProbeRepository


class ProbeNotFoundError(Exception):
    pass


class IdempotencyConflictError(Exception):
    pass


class ProbeService:
    def __init__(self, database: Database) -> None:
        self._database = database

    def get_probe(self, *, probe_id: str) -> Probe:
        with self._database.read_session() as session:
            probe = ProbeRepository(session).get(probe_id)
            if probe is None:
                raise ProbeNotFoundError(probe_id)
            return probe

    def list_probes(
        self,
        *,
        limit: int,
        offset: int,
        sort_by: ProbeSortField,
        order: Literal["asc", "desc"],
    ) -> list[Probe]:
        with self._database.read_session() as session:
            return ProbeRepository(session).list_probes(
                limit=limit, offset=offset, sort_by=sort_by, descending=order == "desc"
            )

    def launch_probe(self, *, max_x: int, max_y: int, direction: Direction) -> Probe:
        grid = Grid(max_x=max_x, max_y=max_y)
        probe = Probe.at_origin(probe_id=str(uuid4()), grid=grid, direction=direction)
        with self._database.transaction() as session:
            ProbeRepository(session).insert(probe)
        return probe

    def move_probe(
        self,
        *,
        probe_id: str,
        commands: str,
        idempotency_key: UUID | str | None = None,
    ) -> Probe:
        key = str(idempotency_key) if idempotency_key is not None else None
        with self._database.transaction() as session:
            repository = ProbeRepository(session)
            probe = repository.get(probe_id)
            if probe is None:
                raise ProbeNotFoundError(probe_id)
            if key is not None:
                confirmed = repository.get_confirmed_move(probe, key)
                if confirmed is not None:
                    confirmed_commands, result = confirmed
                    if commands != confirmed_commands:
                        raise IdempotencyConflictError
                    return result
            moved_probe = probe.execute(commands)
            repository.update_state(moved_probe)
            if key is not None:
                repository.record_confirmed_move(moved_probe, key, commands)
        return moved_probe
