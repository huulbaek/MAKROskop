"""DREAM's first-period rule (makroskop-f67): equations the model only defines after the first period of a
run (`$(tx1[t])`, e.g. firms' discount rate rVirkDisk) are not solved in the shock year, and their variables
stay at the reference. Which they are is read from the conditions in raw.gms, the equation listing in the zip:
the dump alone cannot tell them from equations restricted to forecast years (`tforecast[t]`), since its
first period and its last data year are the same year."""

from pathlib import Path

import numpy as np
import pytest

import freesolver as fs

DICT_TXT = """CNS written by GAMS Convert
Equations 1 to 12
  e1  E_qC(2022)
  e2  E_qC(2023)
  e3  E_qC(2030)
  e4  E_rVirkDisk_sp(tje,2023)
  e5  E_rVirkDisk_sp(tje,2030)
  e6  E_rVirkDiskPrem_spTot(spTot,2023)
  e7  E_rVirkDiskPrem_spTot(spTot,2030)
  e8  E_uIOy_NoM(a,2022)
  e9  E_uIOy_NoM(b,2023)
  e10  E_uIOy_NoM(b,2030)
  e11  E_fhL(2023)
  e12  E_fhL(2030)
Variables 1 to 18
  x1  qC(2022)
  x2  qC(2023)
  x3  qC(2030)
  x4  rVirkDisk(tje,2022)
  x5  rVirkDisk(tje,2023)
  x6  rVirkDisk(tje,2030)
  x7  rVirkDiskPrem(spTot,2023)
  x8  rVirkDiskPrem(spTot,2030)
  x9  rVirkDiskPrem(tje,2022)
  x10  rVirkDiskPrem(tje,2023)
  x11  rVirkDiskPrem(tje,2030)
  x12  uIOy(a,2022)
  x13  uIOy(b,2023)
  x14  uIOy(b,2030)
  x15  rRenteECB(2030)
  x16  fhL(2022)
  x17  fhL(2023)
  x18  fhL(2030)
"""
# fixed: rVirkDisk and fhL in the dump's first year (x4, x16), the exogenous sector premia (x9-x11), the ECB rate (x15)
IS_FIXED = np.array([name in (4, 9, 10, 11, 15, 16) for name in range(1, 19)])

# the equation listing as gamY expands it: the block's condition, then the equation's own
RAW_GMS = """EQUATION E_qC[t];
E_qC[t]$((tx0[t]))..  (qC[t] + res_qC[t])  =E=  1;
EQUATION E_rVirkDisk_sp[sp,t];
E_rVirkDisk_sp[sp,t]$((tx0[t]) and (tx1[t] and sp[sp]))..  rVirkDisk[sp,t]  =E=  rRenteECB[t] + rVirkDiskPrem[sp,t];
EQUATION E_rVirkDiskPrem_spTot[sptot,t];
E_rVirkDiskPrem_spTot[sptot,t]$((tx0[t]) and (tx1[t]))..  rVirkDiskPrem[spTot,t]  =E=  rVirkDiskPrem['tje',t];
EQUATION E_uIOy_NoM[d,t];
E_uIOy_NoM[d,t]$((tx0[t]) and (d1IOy[d,t]))..  uIOy[d,t]  =E=  1;
EQUATION E_fhL[t];
E_fhL[t]$((tx0[t]) and (tforecast[t]))..  hL[sTot,t]  =E=  sum(s, hL[s,t]);
MODEL M_base / E_qC, E_rVirkDisk_sp, E_rVirkDiskPrem_spTot, E_uIOy_NoM, E_fhL /;
"""


def convert_dir(tmp_path: Path, text: str = DICT_TXT) -> Path:
    (tmp_path / "dict.txt").write_text(text, encoding="utf-8")
    (tmp_path / "raw.gms").write_text(RAW_GMS, encoding="utf-8")
    return tmp_path


def test_equations_the_model_restricts_to_after_the_first_period_are_held(tmp_path: Path) -> None:
    equations, variables = fs.first_period_instances(convert_dir(tmp_path), IS_FIXED, from_year=2030)
    assert equations.tolist() == [4, 6]
    # each with the variable it defines: rVirkDiskPrem, not its prefix rVirkDisk, for the second
    assert variables.tolist() == [5, 7]


def test_equations_restricted_to_forecast_years_are_solved_in_the_first_period(tmp_path: Path) -> None:
    # E_fhL is missing in the dump's first year too, but for a calendar reason (tforecast): DREAM's shock
    # runs solve it in the shock year, and so do we
    equations, variables = fs.first_period_instances(convert_dir(tmp_path), IS_FIXED, from_year=2030)
    assert 11 not in equations.tolist() and 17 not in variables.tolist()


def test_the_listing_names_the_first_period_equations(tmp_path: Path) -> None:
    assert fs.first_period_equations(convert_dir(tmp_path)) == {"E_rVirkDisk_sp", "E_rVirkDiskPrem_spTot"}


def test_a_dump_without_its_equation_listing_is_refused(tmp_path: Path) -> None:
    (tmp_path / "dict.txt").write_text(DICT_TXT, encoding="utf-8")
    with pytest.raises(SystemExit, match="raw.gms"):
        fs.first_period_instances(tmp_path, IS_FIXED, from_year=2030)


def test_the_rule_follows_the_first_year_of_the_window(tmp_path: Path) -> None:
    equations, variables = fs.first_period_instances(convert_dir(tmp_path), IS_FIXED, from_year=2023)
    assert (equations.tolist(), variables.tolist()) == ([3, 5], [4, 6])


def test_the_dumps_own_first_year_needs_nothing_dropped(tmp_path: Path) -> None:
    equations, variables = fs.first_period_instances(convert_dir(tmp_path), IS_FIXED, from_year=2022)
    assert (equations.tolist(), variables.tolist()) == ([], [])


def test_an_equation_without_its_variable_is_an_error(tmp_path: Path) -> None:
    # dropping an equation without holding a variable would leave the window with a free column too many
    text = DICT_TXT.replace("  x8  rVirkDiskPrem(spTot,2030)\n", "  x8  somethingElse(2030)\n")
    with pytest.raises(SystemExit, match="E_rVirkDiskPrem_spTot"):
        fs.first_period_instances(convert_dir(tmp_path, text), IS_FIXED, from_year=2030)


class _FakeSystem:
    def __init__(self, is_fixed: np.ndarray, n_eq: int) -> None:
        self.levels = np.zeros(len(is_fixed))
        self.is_fixed = is_fixed
        self.n_eq = n_eq
        self.free_ids = np.where(~is_fixed)[0]


def test_the_window_leaves_the_first_period_conditions_out_of_the_shock_year(tmp_path: Path) -> None:
    window = fs.Window(_FakeSystem(IS_FIXED, n_eq=12), convert_dir(tmp_path), from_year=2030)
    # of the five 2030 equations E_qC, E_uIOy_NoM and E_fhL are solved, for qC, uIOy and fhL
    assert sorted(window.eq_sel.tolist()) == [2, 9, 11]
    assert sorted(window.window_vars.tolist()) == [2, 13, 17]


def test_a_tx1_condition_the_reader_cannot_place_is_refused(tmp_path: Path) -> None:
    # e.g. an equation head wrapped over two lines: missing it silently would solve that equation in the
    # shock year again
    wrapped = RAW_GMS.replace("E_rVirkDisk_sp[sp,t]$((tx0[t]) and (tx1[t] and sp[sp])))..",
                              "E_rVirkDisk_sp[sp,t]$((tx0[t]) and\n   (tx1[t] and sp[sp])))..")
    wrapped = wrapped.replace("E_rVirkDisk_sp[sp,t]$((tx0[t]) and (tx1[t] and sp[sp]))..",
                              "E_rVirkDisk_sp[sp,t]$((tx0[t]) and\n   (tx1[t] and sp[sp]))..")
    assert wrapped != RAW_GMS
    (tmp_path / "raw.gms").write_text(wrapped, encoding="utf-8")
    with pytest.raises(SystemExit, match="tx1"):
        fs.first_period_equations(tmp_path)


def test_equation_names_match_whatever_their_case(tmp_path: Path) -> None:
    text = DICT_TXT.replace("E_rVirkDisk_sp(", "E_rvirkdisk_sp(")
    equations, variables = fs.first_period_instances(convert_dir(tmp_path, text), IS_FIXED, from_year=2030)
    assert (equations.tolist(), variables.tolist()) == ([4, 6], [5, 7])


def test_the_longest_matching_variable_name_owns_the_equation(tmp_path: Path) -> None:
    # gamY names an equation E_<variable>[_<tag>]: with variables rX and rX_sp, E_rX_sp_tot defines rX_sp
    (tmp_path / "dict.txt").write_text(
        "CNS written by GAMS Convert\nEquations 1 to 2\n  e1  E_qC(2022)\n  e2  E_rX_sp_tot(2030)\n"
        "Variables 1 to 3\n  x1  qC(2022)\n  x2  rX(2030)\n  x3  rX_sp(2030)\n", encoding="utf-8")
    (tmp_path / "raw.gms").write_text("E_qC[t]$((tx0[t]))..  qC[t]  =E=  1;\n"
                                      "E_rX_sp_tot[t]$((tx0[t]) and (tx1[t]))..  rX_sp[t]  =E=  rX[t];\n", encoding="utf-8")
    equations, variables = fs.first_period_instances(tmp_path, np.zeros(3, dtype=bool), from_year=2030)
    assert (equations.tolist(), variables.tolist()) == ([1], [2])


def test_a_window_that_starts_before_the_reference_holds_cannot_be_built(tmp_path: Path) -> None:
    # every command that builds a Window (newton, oracle, solve-export) is covered, not only solve-export
    system = _FakeSystem(IS_FIXED, n_eq=12)
    system.reference = {"file": "baseline.gdx", "sha256": "ab" * 32, "valid_from": 2031}
    with pytest.raises(SystemExit, match="2031"):
        fs.Window(system, convert_dir(tmp_path), from_year=2030)


SEPTEMBER_DUMP = "da9b8e59d651"  # the zip of 2026-10-29, checked against DREAM's 11 shock files (makroskop-f67)


def _cached_dump_is(fingerprint: str) -> bool:
    listing = fs.DEFAULT_CONVERT_DIR / "raw.gms"
    return listing.exists() and (fs.CACHE_DIR / "system.npz").exists() and fs.model_fingerprint(fs.DEFAULT_CONVERT_DIR) == fingerprint


@pytest.mark.skipif(not _cached_dump_is(SEPTEMBER_DUMP), reason="needs the cached dump of 2026-10-29")
def test_the_september_dump_has_the_39_instances_dreams_files_hold() -> None:
    # DREAM's Rente_ufin.gdx keeps exactly these 39 variables at baseline in 2030
    assert len(fs.first_period_equations(fs.DEFAULT_CONVERT_DIR)) == 11
    is_fixed = np.load(fs.CACHE_DIR / "system.npz")["is_fixed"]
    equations, variables = fs.first_period_instances(fs.DEFAULT_CONVERT_DIR, is_fixed, from_year=2030)
    assert (len(equations), len(variables)) == (39, 39)
