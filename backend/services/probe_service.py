from threading import Lock
from typing import Literal
from uuid import uuid4

from domain import Direction, Grid, Probe, ProbeSortField
from persistence.database import Database, DatabaseBusyError
from persistence.repository import ProbeRepository

MOVE_LOCK_TIMEOUT_SECONDS = 2.0


class ProbeNotFoundError(Exception):
    pass


class ProbeService:
    def __init__(self, database: Database) -> None:
        self._database = database
        self._move_lock = Lock()

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

    def move_probe(self, *, probe_id: str, commands: str) -> Probe:
        if not self._move_lock.acquire(timeout=MOVE_LOCK_TIMEOUT_SECONDS):
            raise DatabaseBusyError

        try:
            with self._database.transaction() as session:
                repository = ProbeRepository(session)
                probe = repository.get(probe_id)
                if probe is None:
                    raise ProbeNotFoundError(probe_id)

                moved_probe = probe.execute(commands)
                repository.update_state(moved_probe)
            return moved_probe
        finally:
            self._move_lock.release()
