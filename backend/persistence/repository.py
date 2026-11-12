from sqlalchemy import select
from sqlalchemy.orm import Session

from domain import Direction, Grid, Position, Probe, ProbeSortField
from persistence.models import ProbeRecord

PROBE_SORT_COLUMNS = {
    ProbeSortField.ID: ProbeRecord.id,
    ProbeSortField.X: ProbeRecord.x,
    ProbeSortField.Y: ProbeRecord.y,
    ProbeSortField.DIRECTION: ProbeRecord.direction,
}


class ProbeRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_probes(
        self,
        *,
        limit: int | None,
        offset: int,
        sort_by: ProbeSortField,
        descending: bool,
    ) -> list[Probe]:
        column = PROBE_SORT_COLUMNS[sort_by]
        order = column.desc() if descending else column.asc()
        query = select(ProbeRecord).order_by(order)

        if sort_by != ProbeSortField.ID:
            query = query.order_by(ProbeRecord.id.asc())

        records = self.session.scalars(query.limit(limit).offset(offset))
        return [
            Probe(
                id=record.id,
                position=Position(x=record.x, y=record.y),
                direction=Direction(record.direction),
                grid=Grid(max_x=record.max_x, max_y=record.max_y),
            )
            for record in records
        ]

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
