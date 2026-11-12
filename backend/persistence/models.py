from sqlalchemy import CheckConstraint, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from domain import MAX_GRID_COORDINATE, Direction


class Base(DeclarativeBase):
    pass


class ProbeRecord(Base):
    __tablename__ = "probes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    max_x: Mapped[int] = mapped_column()
    max_y: Mapped[int] = mapped_column()
    x: Mapped[int] = mapped_column()
    y: Mapped[int] = mapped_column()
    direction: Mapped[str] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(max_x.between(0, MAX_GRID_COORDINATE)),
        CheckConstraint(max_y.between(0, MAX_GRID_COORDINATE)),
        CheckConstraint(x.between(0, max_x)),
        CheckConstraint(y.between(0, max_y)),
        CheckConstraint(direction.in_([item.value for item in Direction])),
        {"sqlite_strict": True},
    )


class ConfirmedMoveRecord(Base):
    __tablename__ = "confirmed_moves"

    probe_id: Mapped[str] = mapped_column(Text, primary_key=True)
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    commands: Mapped[str] = mapped_column(Text)
    x: Mapped[int] = mapped_column()
    y: Mapped[int] = mapped_column()
    direction: Mapped[str] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(direction.in_([item.value for item in Direction])),
        {"sqlite_strict": True},
    )
