"""Static saldo effect of a fiscal catalog shock at ×1 (makroskop-48o).

The change in the public balance before any behaviour, in pct. of 2030 GDP, positive when it
strengthens the balance. A proposal's Finance Ministry figure (umiddelbar provenuvirkning, same sign)
divided by this number is the scale of that shock in the package. Formulas follow the revenue
equations in MAKRO's GovRevenues.gms; only shocks a published preset needs have one.
"""

from typing import Callable, Protocol

import catalog

YEAR = "2030"


class Reference(Protocol):
    def value(self, symbol: str, *keys: str) -> float: ...


class GdxReference:
    """Reads single records from the solver reference (_reference.gdx)."""

    def __init__(self, container) -> None:
        self.container = container

    def value(self, symbol: str, *keys: str) -> float:
        records = self.container[symbol].records
        mask = None
        for position, key in enumerate(keys):
            column = records.iloc[:, position].astype(str) == key
            mask = column if mask is None else (mask & column)
        selected = records if mask is None else records[mask]
        if len(selected) != 1:
            raise KeyError(f"{symbol}{keys}: {len(selected)} records")
        row = selected.iloc[0]
        return float(row["level"] if "level" in selected.columns else row["value"])


def _run(shock: str) -> catalog.ShockRun:
    return next(r for r in catalog.SHOCK_RUNS if r.shock == shock)


def _relative_change(ref: Reference, shock: str, rate: str) -> float:
    """(t_new − t_ref) / t_ref for a rate instrument shocked by the catalog's factor and delta."""
    run = _run(shock)
    t = ref.value(rate, YEAR)
    return (t * run.factor + run.delta) / t - 1


def _pct_of_gdp(ref: Reference, amount: float) -> float:
    return amount / ref.value("vBNP", YEAR) * 100


def _rate_tax(shock: str, rate: str, revenue: str) -> Callable[[Reference], float]:
    """vtX = tX · base (GovRevenues.gms), so the static revenue is vtX · Δt/t."""
    return lambda ref: _pct_of_gdp(ref, ref.value(revenue, "tot", YEAR) * _relative_change(ref, shock, rate))


def _beskaeftigelsesfradrag(ref: Reference) -> float:
    """vBeskFradrag = tBeskFradrag · vWHh is deducted from vSkatteplInd (GovRevenues.gms:462,499),
    so it is worth the kommune- and kirkeskat on it (:298, :433)."""
    fradrag = ref.value("vBeskFradrag", "tot", YEAR) * _relative_change(ref, "Beskaeftigelsesfradrag", "tBeskFradrag")
    worth = (ref.value("tKommune", YEAR) * ref.value("ftKommune", "tot", YEAR)
             + ref.value("tKirke", YEAR) * ref.value("ftKirke", YEAR) * ref.value("rtKirke", YEAR))
    return _pct_of_gdp(ref, -fradrag * worth)


def _spending(shock: str, *inputs: tuple[str, ...]) -> Callable[[Reference], float]:
    """A factor on public inputs costs (factor − 1) of their nominal value."""
    def formula(ref: Reference) -> float:
        cost = sum(ref.value(symbol, *keys, YEAR) for symbol, *keys in inputs)
        return _pct_of_gdp(ref, -(_run(shock).factor - 1) * cost)
    return formula


STATIC_SALDO: dict[str, Callable[[Reference], float]] = {
    "Bundskat": _rate_tax("Bundskat", "tBund", "vtBund"),
    "Topskat": _rate_tax("Topskat", "tTop", "vtTop"),
    "AM_bidrag": _rate_tax("AM_bidrag", "tAMbidrag", "vtHhAM"),
    "Beskaeftigelsesfradrag": _beskaeftigelsesfradrag,
    "Offentligt_forbrug": _spending("Offentligt_forbrug", ("vR", "off"), ("vE", "off"), ("vLoensum", "off"),
                                    ("vI_s", "iTot", "off")),
    "Offentlig_varekoeb": _spending("Offentlig_varekoeb", ("vR", "off")),
    "Offentlig_Beskaeftigelse": _spending("Offentlig_Beskaeftigelse", ("vLoensum", "off")),
}


def all_static(ref: Reference) -> dict[str, float]:
    return {shock: formula(ref) for shock, formula in STATIC_SALDO.items()}
