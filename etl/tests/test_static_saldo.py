"""Static saldo effects at ×1 (makroskop-48o): hand calculations from reference-like values."""

import pytest

import static_saldo as ss


class FakeReference:
    def __init__(self, values: dict[tuple[str, ...], float]) -> None:
        self.values = values

    def value(self, symbol: str, *keys: str) -> float:
        return self.values[(symbol, *keys)]


REF = FakeReference({
    ("vBNP", "2030"): 2747.2,
    ("tBund", "2030"): 0.1201, ("vtBund", "tot", "2030"): 175.49,
    ("tTop", "2030"): 0.15, ("vtTop", "tot", "2030"): 22.75,
    ("tAMbidrag", "2030"): 0.08, ("vtHhAM", "tot", "2030"): 110.0,
    ("tBeskFradrag", "2030"): 0.0744, ("vBeskFradrag", "tot", "2030"): 113.25,
    ("tKommune", "2030"): 0.2497, ("ftKommune", "tot", "2030"): 0.98,
    ("tKirke", "2030"): 0.0087, ("ftKirke", "2030"): 1.0, ("rtKirke", "2030"): 0.697,
    ("vR", "off", "2030"): 233.1, ("vE", "off", "2030"): 12.22,
    ("vLoensum", "off", "2030"): 419.26, ("vI_s", "iTot", "off", "2030"): 103.11,
})


def test_a_rate_tax_is_its_revenue_times_the_relative_rate_change() -> None:
    assert ss.STATIC_SALDO["Bundskat"](REF) == pytest.approx(175.49 * 0.01 / 0.1201 / 2747.2 * 100)
    assert ss.STATIC_SALDO["Topskat"](REF) == pytest.approx(22.75 * 0.01 / 0.15 / 2747.2 * 100)


def test_a_higher_fradrag_costs_its_kommune_and_kirke_value() -> None:
    value = 0.2497 * 0.98 + 0.0087 * 1.0 * 0.697
    expected = -113.25 * 0.01 / 0.0744 * value / 2747.2 * 100
    assert ss.STATIC_SALDO["Beskaeftigelsesfradrag"](REF) == pytest.approx(expected)
    assert expected < 0


def test_more_public_consumption_costs_one_pct_of_its_inputs() -> None:
    expected = -0.01 * (233.1 + 12.22 + 419.26 + 103.11) / 2747.2 * 100
    assert ss.STATIC_SALDO["Offentligt_forbrug"](REF) == pytest.approx(expected)
    assert ss.STATIC_SALDO["Offentlig_Beskaeftigelse"](REF) == pytest.approx(-0.01 * 419.26 / 2747.2 * 100)


def test_every_formula_is_a_catalogued_shock_and_nonfiscal_shocks_have_none() -> None:
    import catalog
    names = {r.shock for r in catalog.SHOCK_RUNS}
    assert set(ss.STATIC_SALDO) <= names
    assert "Rente" not in ss.STATIC_SALDO
    assert set(ss.all_static(REF)) == set(ss.STATIC_SALDO)
