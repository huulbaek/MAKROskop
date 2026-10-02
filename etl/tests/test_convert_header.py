"""The CONVERT dump header is the source of the variable count (it changes with the model version)."""

from pathlib import Path

import pytest

import freesolver as fs

HEADER = """CNS written by GAMS Convert at 09/07/26 11:47:34

Equation counts
    Total        E        G        L        N        X        C        B
  2203990  2203990        0        0        0        0        0        0

Variable counts
                 x        b        i      s1s      s2s       sc       si
    Total     cont   binary  integer     sos1     sos2    scont     sint
  5849541  5849541        0        0        0        0        0        0
FX3645551

Nonzero counts
    Total    const       NL
 20550000  6900000 13650000

Equations 1 to 2203990
  e1  E_vBVT2hL_s(tje,2022)
"""


def test_variable_count_comes_from_the_dict_header(tmp_path: Path) -> None:
    (tmp_path / "dict.txt").write_text(HEADER, encoding="utf-8")
    assert fs.convert_variable_count(tmp_path) == 5_849_541


def test_missing_header_is_an_error(tmp_path: Path) -> None:
    (tmp_path / "dict.txt").write_text("Equations 1 to 3\n  e1  E_x(2022)\n", encoding="utf-8")
    with pytest.raises(ValueError):
        fs.convert_variable_count(tmp_path)
