"""Exponent bundle members, 'name^exponent' (makroskop-ba1.5): until 2026-10-09 DREAM's KapitalProd raised
uK to a per-sector power, uK[k,sp] * (1 + 0.01*profile)**(eKEL[sp]-1) (standard_shocks.gms). The check of
these exponents against DREAM's own file went with that file (makroskop-big): it is uK x 1.01 now."""

from pathlib import Path

import numpy as np
import pytest

import freesolver as fs

DICT_TXT = """CNS written by GAMS Convert
Equations 1 to 1
  e1  E_a(2030)
Variables 1 to 7
  x1  uK(iM,tje,2030)
  x2  uK(iM,soe,2030)
  x3  uK(iB,tje,2030)
  x4  uK(iB,bol,2030)
  x5  uK(iM,tje,2031)
  x6  uK(iM,tje,2029)
  x7  tBund(2030)
"""
LEVELS = np.array([2.0, 3.0, 5.0, 7.0, 2.5, 1.5, 0.12])
TABLES = {"eKEL": {("tje",): 0.81, ("soe",): 1.0}, "eKELB": {("tje",): 0.55}}
SPEC = "uK(iM,*,*)^eKEL,uK(iB,*,*)^eKELB"


class FakeSystem:
    def __init__(self) -> None:
        self.levels = LEVELS.copy()
        self.is_fixed = np.ones(len(LEVELS), dtype=bool)


@pytest.fixture
def convert_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    (tmp_path / "dict.txt").write_text(DICT_TXT, encoding="utf-8")
    monkeypatch.setattr(fs, "parameter_table", lambda name: TABLES[name])
    return tmp_path


def test_exponent_members_carry_the_elasticity_minus_one(convert_dir: Path) -> None:
    _, scale, exponent = fs.bundle_instances(convert_dir, SPEC, (2030, 2030), LEVELS)
    assert scale == {}
    assert exponent[0] == pytest.approx(0.81 - 1)   # uK(iM,tje): eKEL[tje]
    assert exponent[1] == 0.0                       # uK(iM,soe): eKEL = 1 leaves it alone
    assert exponent[2] == pytest.approx(0.55 - 1)   # uK(iB,tje): eKELB[tje]


def test_a_sector_missing_from_the_gdx_has_elasticity_zero(convert_dir: Path) -> None:
    # GDX files leave zeros out: eKELB['bol'] = 0 (housing's Leontief nest), so DREAM's file has uK(iB,bol) x 1.01**-1
    _, _, exponent = fs.bundle_instances(convert_dir, SPEC, (2030, 2030), LEVELS)
    assert exponent[3] == -1.0


def test_an_unknown_exponent_is_an_error(convert_dir: Path) -> None:
    with pytest.raises(SystemExit, match="unknown bundle exponent"):
        fs.bundle_instances(convert_dir, "uK^nope", (2030, 2030), LEVELS)


def test_single_shock_raises_the_factor_to_the_exponent(convert_dir: Path) -> None:
    ids, targets = fs.single_shock_targets(convert_dir, FakeSystem(), SPEC, (2030, 2030),
                                           1.01, 0.0, "permanent", "")
    got = dict(zip(ids.tolist(), targets.tolist()))
    assert got == pytest.approx({0: 2.0 * 1.01 ** -0.19, 1: 3.0, 2: 5.0 * 1.01 ** -0.45, 3: 7.0 / 1.01})


def test_the_profile_scales_the_gain_inside_the_power(convert_dir: Path) -> None:
    # DREAM: (1 + 0.01 * profile[t]) ** (eKEL - 1), profile ar = 0.9 in the second year
    ids, targets = fs.single_shock_targets(convert_dir, FakeSystem(), "uK(iM,tje,*)^eKEL", (2030, 2031),
                                           1.01, 0.0, "ar", "")
    got = dict(zip(ids.tolist(), targets.tolist()))
    assert got == pytest.approx({0: 2.0 * 1.01 ** -0.19, 4: 2.5 * 1.009 ** -0.19})


def test_a_package_scale_multiplies_the_gain_inside_the_power(convert_dir: Path) -> None:
    members = [fs.PackageMember("KapitalProd", SPEC, 1.01, 0.0, "", 2.0)]
    ids, targets = fs.package_targets(convert_dir, FakeSystem(), members, (2030, 2030), "permanent")
    got = dict(zip(ids.tolist(), targets.tolist()))
    assert got[0] == pytest.approx(2.0 * 1.02 ** -0.19)
    assert got[3] == pytest.approx(7.0 / 1.02)


def test_a_gain_of_minus_100_pct_or_more_is_refused(convert_dir: Path) -> None:
    members = [fs.PackageMember("KapitalProd", SPEC, 1.01, 0.0, "", -100.0)]
    with pytest.raises(SystemExit, match="-100 pct"):
        fs.package_targets(convert_dir, FakeSystem(), members, (2030, 2030), "permanent")


def test_linear_members_keep_the_linear_rule(convert_dir: Path) -> None:
    ids, targets = fs.single_shock_targets(convert_dir, FakeSystem(), "tBund", (2030, 2030),
                                           1.0, 0.01, "permanent", "")
    assert dict(zip(ids.tolist(), targets.tolist())) == {6: 0.12 + 0.01}


def _has_parameter_gdx() -> bool:
    try:
        fs.parameter_gdx()
    except SystemExit:
        return False
    return True


@pytest.mark.skipif(not _has_parameter_gdx(), reason="no baseline.gdx with the model's parameters")
def test_the_elasticities_are_read_by_sector_and_a_zero_nest_is_absent() -> None:
    """The real loader behind 'name^exponent' (stubbed above): what elasticity_exponents assumes of it."""
    machines, buildings = fs.parameter_table("eKEL"), fs.parameter_table("eKELB")
    for table in (machines, buildings):
        assert ("tje",) in table  # keyed by a one-element sector tuple
        assert ("bol",) not in table  # housing's Leontief nest: GAMS drops the zero, callers read it as 0
        assert all(value > 0 for value in table.values())

