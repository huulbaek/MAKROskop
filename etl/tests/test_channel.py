"""Mechanism-map channels in the catalog (makroskop-hkt). The app's data test checks the arrows
against the map's edges; here: every explained shock has a well-formed channel of known series."""

import catalog
from extract import DERIVED_KEYS

KEYS = {s.key for s in catalog.SERIES} | set(DERIVED_KEYS)


def test_every_explained_shock_has_a_channel() -> None:
    missing = [r.shock for r in catalog.SHOCK_RUNS if r.explainer_da and not r.channel]
    assert missing == []


def test_channels_are_chains_of_catalog_series() -> None:
    for run in catalog.SHOCK_RUNS:
        for chain in run.channel:
            keys = chain.split(">")
            assert all(keys), f"{run.shock}: empty step in {chain!r}"
            unknown = [k for k in keys if k not in KEYS]
            assert unknown == [], f"{run.shock}: {unknown} in {chain!r}"


def test_the_definition_carries_the_channel() -> None:
    definition = catalog.shock_definition("Rente", "_ufin", 2129)
    assert definition is not None
    assert definition["channel"][0] == "rRenteObl>pBolig>qC>qBNP"
    assert catalog.shock_definition("Oliepris", "_ufin", 2129)["channel"] is None
