"""dream_comparison: DREAM's shock GDX files next to ours — scale from the instrument, units, guards."""

import hashlib

import pytest

import dream_comparison as dc


DREAM_REF = dc.RefLevels(employment_thousands=3000.0, export_share=0.8, consumption_share=0.5)
OURS_REF = dc.RefLevels(employment_thousands=2900.0, export_share=0.75, consumption_share=0.45)


def test_convert_to_dream_units() -> None:
    # employment: pct of 3,000 thousand persons -> thousand persons, then x shock-size factor 2
    assert dc.convert("nL", 0.1, 2.0, DREAM_REF) == 6.0
    # exports and consumption: pct -> pct-points of GDP via the 2030 shares
    assert dc.convert("qX", 1.0, 2.0, DREAM_REF) == 1.6
    assert dc.convert("qC", 1.0, 2.0, DREAM_REF) == 1.0
    # GDP, investment, wages and house prices stay in pct; the balance is already pct.-points of GDP
    assert dc.convert("qBNP", 0.5, 2.0, DREAM_REF) == 1.0
    assert dc.convert("qI", 0.5, 2.0, DREAM_REF) == 1.0
    assert dc.convert("vhW", -0.3, 2.0, DREAM_REF) == -0.6
    assert dc.convert("pBolig", -0.3, 2.0, DREAM_REF) == -0.6
    assert dc.convert("saldo2bnp", -0.25, 2.0, DREAM_REF) == -0.5


def test_unknown_series_is_an_error() -> None:
    with pytest.raises(KeyError):
        dc.convert("pOlie", 1.0, 1.0, DREAM_REF)


def test_instrument_change_relative_and_absolute() -> None:
    shock = {("off",): 101.0}
    base = {("off",): 100.0}
    assert dc.instrument_change(shock, base, "rel") == pytest.approx(0.01)
    assert dc.instrument_change(shock, base, "abs") == pytest.approx(1.0)


def test_instrument_change_requires_uniform_cells() -> None:
    # every shocked cell must move by the same relative amount (DREAM's uniform factor); an
    # endogenous aggregate cell that moved differently is a wrong selector, not a shock size
    shock = {("a",): 1.01, ("b",): 2.02, ("tot",): 3.05}
    base = {("a",): 1.0, ("b",): 2.0, ("tot",): 3.0}
    with pytest.raises(ValueError, match="not uniform"):
        dc.instrument_change(shock, base, "rel")
    del shock[("tot",)], base[("tot",)]
    assert dc.instrument_change(shock, base, "rel") == pytest.approx(0.01)


def test_instrument_change_skips_zero_base_cells_and_needs_at_least_one() -> None:
    shock = {("0",): 0.0, ("40",): 50.5}
    base = {("0",): 0.0, ("40",): 50.0}
    assert dc.instrument_change(shock, base, "rel") == pytest.approx(0.01)
    with pytest.raises(ValueError, match="no shocked cells"):
        dc.instrument_change({("0",): 0.0}, {("0",): 0.0}, "rel")


def test_shock_scale_is_dream_over_ours() -> None:
    assert dc.shock_scale(0.0150449, 0.01) == pytest.approx(1.50449)
    assert dc.shock_scale(0.01, 0.01) == 1.0


def test_size_note_same_size_and_scaled() -> None:
    same = dc.size_note(1.0, "rRenteECB", 0.01, 0.01, "abs")
    assert same.startswith("Samme stød i begge modeller")
    scaled = dc.size_note(11.427, "qR[off]", 0.1142735, 0.01, "rel")
    assert "+11,43 pct." in scaled and "11,43 ×" in scaled and "+1,00 pct." in scaled


def test_build_row_scales_ours_and_converts_both_sides() -> None:
    horizon = [2030, 2031, 2032]
    dream = {2030: 0.2, 2031: 0.3}  # pct deviations, 2032 missing
    ours = {2030: 0.1, 2031: 0.15, 2032: 0.12}
    row = dc.build_row("nL", dream, ours, scale=2.0, dream_ref=DREAM_REF, ours_ref=OURS_REF,
                       horizon=horizon, columns=[2030, 2032])
    assert row["series"] == "nL"
    assert row["dreamPct"] == [0.2, 0.3, None]
    assert row["oursPct"] == [0.2, 0.3, 0.24]  # ours x scale, in pct
    # DREAM units use each side's own 2030 reference level: 0.2 % of 3,000 k vs 0.1 % x 2 of 2,900 k
    assert row["dream"] == {"2030": 6.0, "2032": None}
    assert row["ours"] == {"2030": 5.8, "2032": 6.96}


def test_build_row_without_our_run_leaves_ours_null() -> None:
    row = dc.build_row("qBNP", {2030: -0.001}, None, scale=None, dream_ref=DREAM_REF, ours_ref=OURS_REF,
                       horizon=[2030], columns=[2030])
    assert row["oursPct"] is None and row["ours"] is None
    assert str(row["dream"]["2030"]) == "0.0"  # never "-0.0"


def test_preshock_guard_rejects_an_anticipated_dream_run() -> None:
    dc.check_preshock({"qBNP": {2029: 0.0, 2030: 0.5}}, "Rente_ufin.gdx")  # fine: 2029 at the baseline
    with pytest.raises(SystemExit, match="2029"):
        dc.check_preshock({"qBNP": {2029: 1e-6, 2030: 0.5}}, "Rente_ufin.gdx")


def test_baseline_marker_must_equal_the_model_baseline(tmp_path) -> None:
    model = tmp_path / "baseline.gdx"
    model.write_bytes(b"baseline bytes")
    assert dc.check_baseline_marker(tmp_path / "missing.gdx", model) == "absent"
    marker = tmp_path / "marker.gdx"
    marker.write_bytes(b"baseline bytes")
    assert dc.check_baseline_marker(marker, model) == "verified"
    marker.write_bytes(b"other bytes")
    with pytest.raises(SystemExit, match="sha256"):
        dc.check_baseline_marker(marker, model)


def test_sha256_matches_hashlib(tmp_path) -> None:
    f = tmp_path / "x.gdx"
    f.write_bytes(b"abc")
    assert dc.sha256(f) == hashlib.sha256(b"abc").hexdigest()


def test_every_catalog_shock_in_the_comparison_has_an_instrument_or_is_marked_unsized() -> None:
    for shock_id, _note in dc.SHOCKS:
        assert shock_id in dc.INSTRUMENTS, shock_id
