"""Linear sum vs joint solve (makroskop-48o)."""

import pytest

import proposals_check as pc


def test_gap_is_the_largest_deviation_relative_to_the_joint_peak() -> None:
    joint = [0.0, 1.0, 2.0, -1.0]
    linear = [0.0, 1.1, 1.9, -1.0]
    assert pc.relative_gap(joint, linear) == pytest.approx(0.1 / 2.0)


def test_gap_ignores_missing_years_and_an_all_zero_series() -> None:
    assert pc.relative_gap([None, 1.0], [5.0, 1.0]) == 0.0
    assert pc.relative_gap([0.0, 0.0], [0.0, 0.0]) == 0.0


def test_linear_sum_scales_each_scenario() -> None:
    columns = {"Topskat": [1.0, 2.0], "Offentligt_forbrug": [0.5, None]}
    assert pc.linear_sum({"Topskat": -2.0, "Offentligt_forbrug": 1.0}, columns) == [-1.5, None]


def test_package_scales_come_from_the_query() -> None:
    assert pc.scales("Topskat=-2&Offentligt_forbrug=0.5") == {"Topskat": -2.0, "Offentligt_forbrug": 0.5}


def test_a_stale_joint_solve_is_refused() -> None:
    with pytest.raises(SystemExit, match="stale"):
        pc.check_stamp("x", {**GOOD_STAMP, "package": "Topskat=-1"}, SPEC)


GOOD_STAMP = {"package": "Topskat=-2", "closure": "none", "from_year": "2030", "shock_years": "2030-2129"}
SPEC = {"package": "Topskat=-2", "query": "Topskat=-2&variant=_ufin"}


def test_a_current_unfinanced_2030_solve_passes() -> None:
    pc.check_stamp("x", GOOD_STAMP, SPEC)


@pytest.mark.parametrize("field, value", [
    ("closure", "tax-reaction"), ("closure", ""), ("from_year", "2029"), ("from_year", ""),
    ("shock_years", "2030-2030"), ("shock_years", ""),
])
def test_a_joint_solve_of_another_design_is_refused(field: str, value: str) -> None:
    with pytest.raises(SystemExit, match=field):
        pc.check_stamp("x", {**GOOD_STAMP, field: value}, SPEC)
