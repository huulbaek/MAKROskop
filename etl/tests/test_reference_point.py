"""Solving from another solution file's point instead of the dump's own (makroskop-f67).

DREAM's baseline.gdx solves the calibration zip's equations from 2030 on, so MAKROskop can start
every scenario from DREAM's official grundforløb: `freesolver.py reference --gdx baseline.gdx`
replaces the cached levels, and every exported GDX is stamped with the point it started from.
"""

from pathlib import Path

import numpy as np
import pytest

import extract
import freesolver as fs

NAMES = ["vBNP(2029)", "vBNP(2030)", "tBund(2030)", "res_qC(cTot,2030)", "uK(iM,tje,2030)"]
DUMP = np.array([100.0, 101.0, 0.12, 0.0, 2.0])


def test_every_variable_takes_the_files_value_and_a_dropped_record_is_zero() -> None:
    # GAMS leaves a free variable at level 0 out of the GDX: res_qC exists in the file without that record
    point = {"vbnp(2029)": 110.0, "vbnp(2030)": 111.0, "tbund(2030)": 0.13, "uk(im,tje,2030)": 2.5}
    x, report = fs.reference_point(NAMES, DUMP, point, {"vbnp", "tbund", "res_qc", "uk"})
    assert x.tolist() == [110.0, 111.0, 0.13, 0.0, 2.5]
    assert (report["matched"], report["zero"], report["zero_but_nonzero_in_dump"]) == (4, 1, 0)


def test_a_dropped_record_counts_when_the_dump_had_a_value_there() -> None:
    x, report = fs.reference_point(["uPensIndbOP(15,2030)"], np.array([0.4]), {}, {"upensindbop"})
    assert x.tolist() == [0.0]
    assert report["zero_but_nonzero_in_dump"] == 1


def test_a_symbol_the_file_does_not_hold_is_an_error() -> None:
    # e.g. an older dump's jrUdlAktRenter, which baseline.gdx replaced by jvUdlAktRenter: no value to take
    with pytest.raises(SystemExit, match="jrUdlAktRenter"):
        fs.reference_point(["vBNP(2030)", "jrUdlAktRenter(Obl,2030)"], np.array([1.0, 2.0]),
                           {"vbnp(2030)": 5.0}, {"vbnp"})


def test_names_match_whatever_their_case() -> None:
    x, _report = fs.reference_point(["nPop(aTot,2030)"], np.array([1.0]), {"npop(atot,2030)": 6.0}, {"npop"})
    assert x.tolist() == [6.0]


def test_an_undefined_value_in_the_file_is_an_error() -> None:
    with pytest.raises(SystemExit, match=r"vBNP\(2030\)"):
        fs.reference_point(["vBNP(2030)"], np.array([1.0]), {"vbnp(2030)": float("nan")}, {"vbnp"})


def test_the_reference_holds_from_the_year_after_the_last_violated_equation() -> None:
    # baseline.gdx is calibrated to newer data in its first years, where the dump's equations do not hold
    eq_year = np.array([2023, 2025, 2026, 2030, 2129, 0])
    residual = np.array([0.5, -2e-3, 1e-9, 0.0, 1e-12, 0.0])
    assert fs.reference_valid_from(eq_year, residual, tol=1e-6) == 2026


def test_a_reference_that_misses_in_the_last_year_holds_nowhere() -> None:
    assert fs.reference_valid_from(np.array([2030, 2129]), np.array([0.0, 1e-2]), tol=1e-6) is None


def test_a_reference_that_holds_everywhere_is_valid_from_the_first_year() -> None:
    assert fs.reference_valid_from(np.array([2022, 2030, 0]), np.array([1e-9, 0.0, 0.0]), tol=1e-6) == 2022


REFERENCE = {"file": "baseline.gdx", "sha256": "0123456789abcdef" * 4, "valid_from": 2026}


def test_a_window_that_starts_before_the_reference_holds_is_refused() -> None:
    fs.require_window_on_reference(REFERENCE, 2030)
    fs.require_window_on_reference(REFERENCE, 2026)
    fs.require_window_on_reference(None, 2023)  # the dump's own point holds in every year
    with pytest.raises(SystemExit, match="2026"):
        fs.require_window_on_reference(REFERENCE, 2025)


def test_the_stamp_names_the_point_a_run_started_from() -> None:
    assert fs.reference_stamp(None) == "calibration point"
    assert fs.reference_stamp(REFERENCE) == "baseline.gdx 0123456789ab"


def test_dict_variable_names_come_in_x_order(tmp_path: Path) -> None:
    (tmp_path / "dict.txt").write_text(
        "CNS written by GAMS Convert\nEquations 1 to 1\n  e1  E_a(2030)\nVariables 1 to 3\n"
        "  x1  vBNP(2030)\n  x2  tLukning\n  x3  uK(iM,tje,2030)\n", encoding="utf-8")
    assert fs.dict_variable_names(tmp_path, 3) == ["vBNP(2030)", "tLukning", "uK(iM,tje,2030)"]
    with pytest.raises(SystemExit, match="3 variables"):
        fs.dict_variable_names(tmp_path, 4)


def test_gdx_point_reads_every_variable_and_parameter_by_its_full_name(tmp_path: Path) -> None:
    import gams.transfer as gt
    import gamspy_base
    import pandas as pd

    container = gt.Container(system_directory=gamspy_base.directory)
    gt.Variable(container, "vBNP", "free", domain=["t"],
                records=pd.DataFrame({"t": ["2029", "2030"], "level": [110.0, 111.0]}))
    gt.Variable(container, "uK", "free", domain=["k", "s", "t"],
                records=pd.DataFrame({"k": ["iM"], "s": ["tje"], "t": ["2030"], "level": [2.5]}))
    gt.Variable(container, "tLukning", "free", records=pd.DataFrame({"level": [0.5]}))
    gt.Parameter(container, "eKEL", domain=["s"], records=pd.DataFrame({"s": ["tje"], "value": [0.81]}))
    gt.Variable(container, "res_qC", "free", domain=["c", "t"])  # declared, every record dropped
    path = tmp_path / "point.gdx"
    container.write(str(path))

    point, symbols = fs.gdx_point(path)
    assert point == {"vbnp(2029)": 110.0, "vbnp(2030)": 111.0, "uk(im,tje,2030)": 2.5, "tlukning": 0.5,
                     "ekel(tje)": 0.81}
    assert symbols == {"vbnp", "uk", "tlukning", "ekel", "res_qc"}


def test_scenarios_solved_from_another_point_than_the_reference_file_are_refused() -> None:
    # extract.py measures every scenario against _reference.gdx: all of them must have started there
    baseline = "baseline.gdx 0123456789ab"
    stamps = {"Rente_ufin.gdx": {"reference": baseline}, "Moms_perm.gdx": {"reference": baseline}}
    assert extract.reference_errors({"reference": baseline}, stamps) == []
    stamps["Bundskat_ufin.gdx"] = {"reference": "calibration point"}
    assert extract.reference_errors({"reference": baseline}, stamps) == [
        "Bundskat_ufin.gdx: solved from 'calibration point', but _reference.gdx is 'baseline.gdx 0123456789ab'"]


def test_files_stamped_before_the_reference_field_existed_started_from_the_calibration_point() -> None:
    assert extract.reference_errors({}, {"Rente_ufin.gdx": {}}) == []
    assert extract.reference_errors({"reference": "baseline.gdx 0123456789ab"}, {"Rente_ufin.gdx": {}}) == [
        "Rente_ufin.gdx: solved from 'calibration point', but _reference.gdx is 'baseline.gdx 0123456789ab'"]


def test_a_checkpoint_is_resumed_only_if_it_belongs_to_this_run() -> None:
    # x = [instrument, exogenous, endogenous]; the run ramps the instrument from 1.0 to 2.0
    x = np.array([1.0, 5.0, 7.0])
    is_fixed = np.array([True, True, False])
    shock_vars, base, deltas = np.array([0]), np.array([1.0]), np.array([1.0])
    good = np.array([1.5, 5.0, 7.3])  # half of the shock in place, the exogenous data untouched
    assert fs.checkpoint_matches(good, 0.5, x, shock_vars, base, deltas, is_fixed)
    # another shock size, another reference (exogenous data differ), another dump (length)
    assert not fs.checkpoint_matches(np.array([1.8, 5.0, 7.3]), 0.5, x, shock_vars, base, deltas, is_fixed)
    assert not fs.checkpoint_matches(np.array([1.5, 5.2, 7.3]), 0.5, x, shock_vars, base, deltas, is_fixed)
    assert not fs.checkpoint_matches(np.array([1.5, 5.0]), 0.5, x, shock_vars, base, deltas, is_fixed)


def test_the_reference_file_must_be_the_baseline_in_the_makro_checkout() -> None:
    # baseline.json and the model commit come from the checkout's baseline.gdx: the scenarios must have started there
    sha = "10f0acbded1290ebc05629b3a88eedc7075c78f59e0fd8868ab619aad036b08e"
    assert extract.reference_baseline_errors({"reference": "baseline.gdx 10f0acbded12"}, sha) == []
    assert extract.reference_baseline_errors({"reference": "calibration point"}, sha) == []
    assert extract.reference_baseline_errors({}, sha) == []
    assert extract.reference_baseline_errors({"reference": "baseline.gdx 59ef347e2cc0"}, sha) == [
        "_reference.gdx was taken from 'baseline.gdx 59ef347e2cc0', but the MAKRO checkout's baseline.gdx is 10f0acbded12"]


def test_scenarios_must_agree_on_the_first_period_rule() -> None:
    held = {"first_period": "39 equations held"}
    assert extract.first_period_errors({"Rente_ufin.gdx": held, "Moms_perm.gdx": held}) == []
    assert extract.first_period_errors({"Rente_ufin.gdx": {}, "Moms_perm.gdx": {}}) == []  # all from before the rule
    assert extract.first_period_errors({"Rente_ufin.gdx": held, "Moms_perm.gdx": held, "Bundskat_ufin.gdx": {}}) == [
        "Bundskat_ufin.gdx: first period 'not stamped', the other scenarios '39 equations held'"]
