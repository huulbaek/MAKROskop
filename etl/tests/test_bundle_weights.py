"""Weighted bundle members, 'name@weight' (makroskop-gnp.6; see freesolver.off_share)."""

from pathlib import Path

import numpy as np
import pytest

import freesolver as fs

DICT_TXT = """CNS written by GAMS Convert
Equations 1 to 1
  e1  E_a(2030)
Variables 1 to 14
  x1  qProd(off,2030)
  x2  qProd(off,2031)
  x3  qProd(tot,2030)
  x4  qProd(tot,2031)
  x5  hL(off,2030)
  x6  hL(off,2031)
  x7  hL(tot,2030)
  x8  hL(tot,2031)
  x9  qProdHh_t(2030)
  x10 qProdHh_t(2031)
  x11 qProdxDK(2030)
  x12 qProdxDK(2031)
  x13 qProd(spTot,2030)
  x14 qProdHh_t(2029)
"""

LEVELS = np.array([
    0.3, 0.3,        # qProd(off)
    0.4, 0.5,        # qProd(tot)
    100.0, 110.0,    # hL(off)
    400.0, 440.0,    # hL(tot)
    0.31, 0.32,      # qProdHh_t
    0.14, 0.14,      # qProdxDK
    0.42, 0.30,
])

SPEC = "qProd(off,*),qProdHh_t@off_share,qProdxDK@off_share"


def write_convert_dir(tmp_path: Path) -> Path:
    (tmp_path / "dict.txt").write_text(DICT_TXT, encoding="utf-8")
    return tmp_path


def test_weighted_members_move_by_the_public_share_of_effective_hours(tmp_path: Path) -> None:
    matched, scale = fs.bundle_instances(write_convert_dir(tmp_path), SPEC, (2030, 2031), LEVELS)
    assert [v for v, _ in matched] == [0, 1, 8, 9, 10, 11]  # qProd(off), qProdHh_t, qProdxDK; not 2029
    share_2030, share_2031 = 0.3 * 100 / (0.4 * 400), 0.3 * 110 / (0.5 * 440)
    assert scale == pytest.approx({8: share_2030, 9: share_2031, 10: share_2030, 11: share_2031})


def test_an_unknown_weight_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="unknown bundle weight"):
        fs.bundle_instances(write_convert_dir(tmp_path), "qProdHh_t@nope", (2030, 2031), LEVELS)
