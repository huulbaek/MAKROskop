"""Mechanism-map channels in the catalog (makroskop-hkt): every explained shock has a channel the
app's map can draw. The map (nodes and allowed arrows) is the app's own mechanism-map.json, so a
channel with an arrow the map lacks fails here, at catalog-edit time."""

import json
from pathlib import Path

import catalog
from extract import DERIVED_KEYS

MAP = json.loads((Path(__file__).parents[2] / "app/src/lib/mechanism-map.json").read_text(encoding="utf-8"))
NODES = {node["key"] for node in MAP["nodes"]}
EDGES = {edge for group in MAP["edges"].values() for edge in group}


def test_the_map_is_made_of_catalog_series() -> None:
    series = {s.key for s in catalog.SERIES} | set(DERIVED_KEYS)
    assert NODES - series == set()


def test_every_explained_shock_has_a_channel() -> None:
    missing = [r.shock for r in catalog.SHOCK_RUNS if r.explainer_da and not r.channel]
    assert missing == []


def test_channels_are_drawable_on_the_map() -> None:
    for run in catalog.SHOCK_RUNS:
        for chain in run.channel:
            keys = chain.split(">")
            assert set(keys) <= NODES, f"{run.shock}: {set(keys) - NODES} in {chain!r}"
            arrows = {f"{a}>{b}" for a, b in zip(keys, keys[1:])}
            assert arrows <= EDGES, f"{run.shock}: no map edge {arrows - EDGES} in {chain!r}"


def test_the_definition_carries_the_channel() -> None:
    definition = catalog.shock_definition("Rente", "_ufin", 2129)
    assert definition is not None
    assert definition["channel"][0] == "rRenteObl>pBolig>qC>qBNP"
    assert catalog.shock_definition("Oliepris", "_ufin", 2129)["channel"] is None
