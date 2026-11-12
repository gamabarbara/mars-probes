import pytest

from domain import Grid


def test_grid_rejects_limits_outside_domain() -> None:
    with pytest.raises(ValueError):
        Grid(max_x=101, max_y=0)
