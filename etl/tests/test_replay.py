"""Replaying another solver's run (makroskop-f67): solve-export --replay <DREAM's shock file> sets every
exogenous variable the file moved against the reference to the file's value and solves. The result must
then equal the file itself - the exact check of our solver against DREAM's published solutions."""

import numpy as np
import pytest

import freesolver as fs

NAMES = ["rRenteECB(2029)", "rRenteECB(2030)", "rRenteECB(2031)", "uDeltag(30,2030)", "vBNP(2030)",
         "tBund(2030)", "pM(tje,2030)", "nvSaldo(2029)"]
LEVELS = np.array([0.02, 0.02, 0.02, 1.0, 100.0, 0.12, 1.0, 50.0])
IS_FIXED = np.array([True, True, True, True, False, True, True, False])
VAR_YEAR = np.array([2029, 2030, 2031, 2030, 2030, 2030, 2030, 2029])


def test_replay_takes_every_exogenous_value_the_file_moved_from_the_window_on() -> None:
    point = {"rrenteecb(2029)": 0.02, "rrenteecb(2030)": 0.03, "rrenteecb(2031)": 0.03, "udeltag(30,2030)": 0.99,
             "vbnp(2030)": 99.0, "tbund(2030)": 0.12, "nvsaldo(2029)": 60.0}
    symbols = {"rrenteecb", "udeltag", "vbnp", "tbund", "nvsaldo"}  # pM is not in the file: left alone
    shock_vars, targets = fs.replay_targets(NAMES, LEVELS, IS_FIXED, VAR_YEAR, point, symbols, from_year=2030)
    # the instrument, and the parameter an exo/endo swap freed in the other solver; not the endogenous
    # vBNP, the unmoved tBund, or the endogenous reporting variable the file recomputed for 2029
    assert shock_vars.tolist() == [1, 2, 3]
    assert targets.tolist() == [0.03, 0.03, 0.99]


def test_replay_reads_a_dropped_record_as_zero() -> None:
    point = {"rrenteecb(2030)": 0.03}
    shock_vars, targets = fs.replay_targets(["rRenteECB(2030)", "tBund(2030)"], np.array([0.02, 0.12]),
                                            np.array([True, True]), np.array([2030, 2030]), point,
                                            {"rrenteecb", "tbund"}, from_year=2030)
    assert shock_vars.tolist() == [0, 1] and targets.tolist() == [0.03, 0.0]


def test_replay_refuses_a_file_that_changed_history() -> None:
    # an exogenous value before the window differs: the file's run started earlier, or from another baseline
    point = {"rrenteecb(2029)": 0.025, "rrenteecb(2030)": 0.03}
    with pytest.raises(SystemExit, match=r"rRenteECB\(2029\)"):
        fs.replay_targets(NAMES[:2], LEVELS[:2], IS_FIXED[:2], VAR_YEAR[:2], point, {"rrenteecb"}, from_year=2030)


def test_replay_needs_something_to_replay() -> None:
    point = {"rrenteecb(2029)": 0.02, "rrenteecb(2030)": 0.02}
    with pytest.raises(SystemExit, match="moves no exogenous"):
        fs.replay_targets(NAMES[:2], LEVELS[:2], IS_FIXED[:2], VAR_YEAR[:2], point, {"rrenteecb"}, from_year=2030)


def test_replay_refuses_an_undefined_value() -> None:
    point = {"rrenteecb(2030)": float("nan")}
    with pytest.raises(SystemExit, match=r"rRenteECB\(2030\)"):
        fs.replay_targets(["rRenteECB(2030)"], np.array([0.02]), np.array([True]), np.array([2030]), point,
                          {"rrenteecb"}, from_year=2030)
