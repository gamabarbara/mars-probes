from sqlalchemy.orm import Session

from domain import Probe
from persistence.models import ProbeRecord


class ProbeRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def insert(self, probe: Probe) -> None:
        self.session.add(
            ProbeRecord(
                id=probe.id,
                x=probe.position.x,
                y=probe.position.y,
                direction=probe.direction.value,
                max_x=probe.grid.max_x,
                max_y=probe.grid.max_y,
            )
        )
