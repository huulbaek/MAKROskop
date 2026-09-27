"""Explainers per variant (makroskop-gnp.8): the financed (_perm) run gets its own text, because the
lukkeskat hands revenue back to (or takes it from) households and can flip the signs the _ufin text
describes. The lukkeskat's size in that text is the slot {lukning}, filled from the solve."""

import json
import re
from pathlib import Path

import pytest

import catalog

DATA = Path(__file__).parents[2] / "app/static/data"
HAS_DATA = (DATA / "meta.json").exists()


def test_every_explained_shock_has_a_financed_text() -> None:
    missing = [r.shock for r in catalog.SHOCK_RUNS if r.explainer_da and not r.explainer_perm_da]
    assert missing == []


def test_the_definition_carries_the_variants_own_text() -> None:
    run = next(r for r in catalog.SHOCK_RUNS if r.shock == "Bundskat")
    ufin = catalog.shock_definition("Bundskat", "_ufin", 2129, lukning_share=-0.551)
    perm = catalog.shock_definition("Bundskat", "_perm", 2129, lukning_share=-0.551)
    assert ufin["explainerDa"] == run.explainer_da
    assert ufin["lukningShare"] is None
    assert perm["explainerDa"] == run.explainer_perm_da.replace("{lukning}", "ca. 0,55 pct.")
    assert perm["lukningShare"] == -0.551


def test_the_text_follows_the_closure_not_the_suffix(monkeypatch: pytest.MonkeyPatch) -> None:
    # a financed temporary variant must get the financed text too
    monkeypatch.setitem(catalog.VARIATION_CLOSURES, "_midl", "tax-reaction")
    definition = catalog.shock_definition("Bundskat", "_midl", 2129, lukning_share=-0.551)
    assert "lukkeskatten" in definition["explainerDa"]


def test_a_financed_text_needs_the_solved_size() -> None:
    with pytest.raises(ValueError, match="no solved size"):
        catalog.shock_definition("Bundskat", "_perm", 2129)


@pytest.mark.parametrize(("share", "expected"), [
    (-0.551, "ca. 0,55 pct."), (0.247, "ca. 0,25 pct."), (-2.203, "ca. 2,2 pct."), (0.0049, "under 0,01 pct."),
])
def test_lukning_size(share: float, expected: str) -> None:
    assert catalog.lukning_size_da(share) == expected


# Figures of BNP a financed text may type by hand because they are not the lukkeskat's size.
_OTHER_BNP_FIGURES = {"Rente": {"ca. 2–3"}, "Overforsel_privat": {"godt 0,3", "ca. 0,05"}}


def test_financed_texts_take_the_lukkeskat_size_from_the_solve() -> None:
    typed = {}
    for run in catalog.SHOCK_RUNS:
        figures = set(re.findall(r"((?:ca\.|godt|knap|under) [\d,–]+) pct\. af BNP", run.explainer_perm_da or ""))
        if extra := figures - _OTHER_BNP_FIGURES.get(run.shock, set()):
            typed[run.shock] = extra
    assert typed == {}


# Phrases that commit a financed text to a direction for the lukkeskat.
_HANDS_BACK = ("giver gevinsten tilbage", "gives tilbage", "giver dem tilbage", "lukkeskatten sænker")
_TAKES = ("lukkeskatten hæver", "lukkeskatten henter", "finansieres med højere skat", "betales af husholdningerne",
          "henter pengene tilbage", "henter det tilbage")


def _financed_runs():
    for run in catalog.SHOCK_RUNS:
        path = DATA / "shocks" / f"{run.shock}_perm.json"
        if run.explainer_perm_da and path.exists():
            yield run, json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.skipif(not HAS_DATA, reason="no extracted data")
def test_financed_texts_follow_the_lukkeskat_sign() -> None:
    y0 = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))["yearStart"]
    wrong = []
    for run, scenario in _financed_runs():
        t_lukning = scenario["deviations"]["tLukning"][run.first_year - y0]
        text = run.explainer_perm_da
        says_takes = any(p in text for p in _TAKES)
        says_back = any(p in text for p in _HANDS_BACK)
        # only a negligible lukkeskat may go without a direction, and the text must say it is negligible
        negligible = "betyder næsten intet" in text and abs(scenario["definition"]["lukningShare"]) < 0.05
        if says_takes == says_back and not negligible:
            wrong.append(f"{run.shock}: text gives no single direction for lukkeskat {t_lukning:+.2f}")
        if (t_lukning < 0 and says_takes) or (t_lukning > 0 and says_back):
            wrong.append(f"{run.shock}: lukkeskat {t_lukning:+.2f} but the text says the opposite")
    assert wrong == []


@pytest.mark.skipif(not HAS_DATA, reason="no extracted data")
def test_shipped_financed_scenarios_carry_the_financed_text_and_size() -> None:
    stale = []
    for run, scenario in _financed_runs():
        definition = scenario["definition"]
        share = definition.get("lukningShare")
        if share is None or "{" in definition["explainerDa"]:
            stale.append(run.shock)
        elif definition["explainerDa"] != run.explainer_perm_da.replace("{lukning}", catalog.lukning_size_da(share)):
            stale.append(run.shock)
    assert stale == []
