"""solve-export --package: a /pakke/ query solved as one run (makroskop-48o)."""

from pathlib import Path

import numpy as np
import pytest

import freesolver as fs

DICT_TXT = """CNS written by GAMS Convert
Equations 1 to 1
  e1  E_a(2030)
Variables 1 to 6
  x1  tBund(2030)
  x2  tTop(2030)
  x3  qR(off,2030)
  x4  qE(off,2030)
  x5  hL(off,2030)
  x6  qI_s(bygningsinv,off,2030)
"""
LEVELS = np.array([0.12, 0.15, 200.0, 10.0, 400.0, 100.0])


class FakeSystem:
    def __init__(self) -> None:
        self.levels = LEVELS.copy()
        self.is_fixed = np.ones(len(LEVELS), dtype=bool)

    def swap(self, fix_ids, free_ids) -> None:
        raise AssertionError("no swap expected")


def convert_dir(tmp_path: Path) -> Path:
    (tmp_path / "dict.txt").write_text(DICT_TXT, encoding="utf-8")
    return tmp_path


def test_members_come_from_the_catalog_in_query_order() -> None:
    members = fs.package_members("Topskat=-0.8&Bundskat=0.5")
    assert [(m.name, m.solver_shock, m.delta, m.scale) for m in members] == [
        ("Topskat", "tTop", 0.01, -0.8), ("Bundskat", "tBund", 0.01, 0.5)]


@pytest.mark.parametrize("query", ["", "Momsx=1", "Bundskat=abc", "Bundskat=0", "Bundskat=1&Bundskat=2",
                                   "Bundskat=1&variant=_ufin"])
def test_bad_queries_are_refused(query: str) -> None:
    with pytest.raises(SystemExit):
        fs.package_members(query)


def test_targets_scale_each_member_by_its_weight(tmp_path: Path) -> None:
    members = fs.package_members("Bundskat=-2&Topskat=0.5")
    ids, targets = fs.package_targets(convert_dir(tmp_path), FakeSystem(), members, (2030, 2030), "permanent")
    got = dict(zip(ids.tolist(), targets.tolist()))
    assert got[0] == pytest.approx(0.12 - 0.02)
    assert got[1] == pytest.approx(0.15 + 0.005)


def test_overlapping_members_add_their_increments(tmp_path: Path) -> None:
    members = fs.package_members("Offentligt_forbrug=1&Offentlig_varekoeb=-0.5")
    ids, targets = fs.package_targets(convert_dir(tmp_path), FakeSystem(), members, (2030, 2030), "permanent")
    got = dict(zip(ids.tolist(), targets.tolist()))
    assert got[2] == pytest.approx(200.0 * (1 + 0.01 - 0.005))  # qR(off): both members
    assert got[4] == pytest.approx(400.0 * 1.01)                 # hL(off): Offentligt_forbrug only
    assert len(ids) == len(set(ids.tolist()))


def test_a_swap_member_may_not_overlap_another(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    members = [fs.PackageMember("A", "tBund", 1.0, 0.01, "uDeltag", 1.0),
               fs.PackageMember("B", "tBund", 1.0, 0.01, "", 1.0)]
    monkeypatch.setattr(fs, "find_swap_pairs", lambda d, matched, endo: [(v, v + 100, y) for v, y in matched])

    class SwapSystem(FakeSystem):
        def swap(self, fix_ids, free_ids) -> None:
            pass

    with pytest.raises(SystemExit, match="overlap"):
        fs.package_targets(convert_dir(tmp_path), SwapSystem(), members, (2030, 2030), "permanent")
