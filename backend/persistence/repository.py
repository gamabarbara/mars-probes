from sqlalchemy import select, update
from sqlalchemy.orm import Session

from domain import Direction, Grid, Position, Probe, ProbeSortField
from persistence.models import ProbeRecord

PROBE_SORT_COLUMNS = {
    ProbeSortField.ID: ProbeRecord.id,
    ProbeSortField.X: ProbeRecord.x,
    ProbeSortField.Y: ProbeRecord.y,
    ProbeSortField.DIRECTION: ProbeRecord.direction,
}


def _to_probe(record: ProbeRecord) -> Probe:
    return Probe(
        id=record.id,
        position=Position(x=record.x, y=record.y),
        direction=Direction(record.direction),
        grid=Grid(max_x=record.max_x, max_y=record.max_y),
    )


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

        query = query.limit(limit)
        if offset > 0:
            query = query.offset(offset)

        records = self.session.scalars(query)
        return [_to_probe(record) for record in records]

    def get(self, probe_id: str) -> Probe | None:
        record = self.session.get(ProbeRecord, probe_id)
        return _to_probe(record) if record is not None else None

    def update_state(self, probe: Probe) -> None:
        self.session.execute(
            update(ProbeRecord)
            .where(ProbeRecord.id == probe.id)
            .values(
                x=probe.position.x, y=probe.position.y, direction=probe.direction.value
            )
        )

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
