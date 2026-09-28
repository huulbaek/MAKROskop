"""The change as size and unit (makroskop-uah): the pages scale change_size with the slider and
append change_unit_da, so at scale 1 that text must be what the catalog's change_da says."""

import pytest

import catalog


def worded(size: float, unit: str) -> str:
    number = f"{abs(size):g}".replace(".", ",")
    return f"{'+' if size > 0 else '−'}{number} {unit}"


@pytest.mark.parametrize("run", catalog.SHOCK_RUNS, ids=lambda r: r.shock)
def test_the_display_at_scale_one_is_the_catalog_wording(run: catalog.ShockRun) -> None:
    size, unit = catalog.change_display(run)
    assert run.change_da.startswith(worded(size, unit))


def test_a_run_the_rule_cannot_word_must_say_so() -> None:
    run = next(r for r in catalog.SHOCK_RUNS if r.shock == "Arbejdsudbud_timer")
    bare = catalog.ShockRun(run.shock, run.instrument, run.instrument_da, run.factor, run.delta,
                            run.change_da, run.first_year, run.dream_da)
    with pytest.raises(ValueError, match="change_size"):
        catalog.change_display(bare)


def test_the_definition_carries_the_display_fields() -> None:
    definition = catalog.shock_definition("Loen", "_ufin", 2129)
    assert definition["shortDa"] == "Arbejdsgivernes forhandlingsvægt"
    assert (definition["changeSize"], definition["changeUnitDa"]) == (-1.0, "pct.-point")
    assert catalog.shock_definition("Bundskat", "_ufin", 2129)["shortDa"] is None
