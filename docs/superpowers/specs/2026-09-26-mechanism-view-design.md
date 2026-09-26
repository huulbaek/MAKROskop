# Mechanism view: transmission map and year scrubber (makroskop-hkt)

## Goal

MAKRO's selling point is mechanisms. A reader of a scenario page should see *how* a shock reaches
BNP, not only that it does, and watch it spread year by year. Audience: journalists and curious
readers. The arrows are editorial (MAKRO's channels as we describe them); the numbers are the
model's. The page says so.

## The map

One fixed "economy map" for every shock, so readers learn the layout once. A header bar names the
shock ("Stødet: bundskatten +1 pct.-point", scaled with the size slider); below it six columns:

| Finans | Efterspørgsel | Produktion | Arbejdsmarked | Løn og priser | Offentlige finanser |
|---|---|---|---|---|---|
| rRenteObl, pBolig | qC, qI, qG, qX, qM | qBNP | nPop, snL, nL, ledighedsgrad | vhW, pC | saldo2bnp, tLukning (financed runs only) |

Each node shows its label, the signed deviation at the shown year (pct. or pct.-point per the
series' devMode, scaled with the slider), and a thin *reach bar*: |value now| / max |value| over
firstYear..2060. The bar is what makes propagation visible when playing. Sign is text only (no
red/green: "higher prices = bad" is editorial); no teal in data.

**Edges are a vocabulary, not a drawing.** `app/src/lib/mechanism-map.json` lists the allowed arrows
(MAKRO channels: rente→boligpriser, boligpriser→forbrug, ledighed→løn, løn→eksport, …). Only the
current shock's path is drawn; the other nodes sit dimmed with their numbers and no lines.

**Path format.** `ShockRun.channel` in `etl/catalog.py`, next to `explainer_da`: a tuple of chains
`"a>b>c"`. A chain whose first node is not on an earlier chain is hit by the shock directly: that
node carries a "Stødet" tab (entry arrows from a header bar would have to cross the grid). Chains may branch and rejoin; the first chain is the main story. Single-node chains are
allowed (an entry tab only). Financed runs (`_perm`) get `saldo2bnp>tLukning>qC` appended by the
app, without an entry tab.

**Routing.** No arrow runs under a box: neighbours in a column join vertically, neighbouring
columns by an S-curve through the corridor between them, and longer arrows leave through a
corridor, travel along a lane above or below the grid (each on its own track) and come in from the
side.

```python
channel=("rRenteObl>pBolig>qC>qBNP", "rRenteObl>qI>qBNP", "qBNP>nL>ledighedsgrad>vhW>pC")
```

Exported as `definition.channel` (list of strings) by `extract.py`.

**Honesty line** under the map: "Pilene er MAKROs kanaler, som vi har beskrevet dem; tallene er
modellens."

**Phones and screen readers.** Below ~640 px the map is replaced by the path as an ordered list
(chain order, nodes deduplicated) with the same values and bars. The same list is the accessible
representation at every width (the SVG is aria-hidden).

## The year scrubber

A sticky bar above the map: ▶/❚❚ button, range slider firstYear..2060, "År 2034 (år 5)". It drives:

- the map's nodes;
- a vertical year marker on every chart (LineChart `markerYear`);
- the three key-figure tiles, *once the reader has scrubbed*. Until then they keep their
  share-card years (år 1 / år 3 / år 1), so the page matches its share card.

Charts feed back: hovering a chart previews that year on the map and the other charts' markers
(pointer leave reverts); a click, tap or arrow key commits it to the scrubber. Play steps one year
per 250 ms from the current year (from firstYear if at the end) and stops at 2060 or on any manual
input. Selecting another shock resets the year to firstYear; changing the size keeps it.

The committed year travels in the URL as `?aar=2035` (only once scrubbed), alongside
`?sammenlign`. Prerendered pages and share cards are unchanged.

## Units

- `app/src/lib/mechanism-map.json`: columns, nodes, allowed arrows, the financed chain; read by
  mechanism.ts and by `etl/tests/test_channel.py`, so both sides check against one map.
- `app/src/lib/mechanism.ts` (pure, unit-tested): `pathOf(channel, variation)` → { nodes in
  order, edges, entries }, `channelErrors`, `peakOf` (per scenario) and `nodeReading(values,
  {year, yearStart, scale, peak})` → { value, reach }.
- `app/src/lib/components/MechanismMap.svelte`: SVG map + ordered list.
- `app/src/lib/components/YearScrubber.svelte`: play button, slider, readout.
- `LineChart.svelte`: `markerYear`, `onhover`, `onpick` props.
- `ScenarioExplorer.svelte`: owns `year`, `previewYear`, `scrubbed`, play timer, `aar` param.
- `card.ts`: `cardTiles` takes an optional `year` that overrides the three curated years.
- `export.ts`: `permalink` takes an optional `aar`.

## Testing

- Vitest: mechanism.ts (parsing, entries, financed chain, readings, reach); a data test that every
  shipped scenario's `definition.channel` uses only map nodes and vocabulary edges; cardTiles with
  a year; permalink with aar.
- ETL pytest: every ShockRun with an explainer has a channel, and every channel uses only map
  nodes and map arrows (mechanism-map.json); the map's nodes are catalog series.
- Browser: map + scrubber + play on Rente, Bundskat (financed), Befolkning; phone width; both
  colour schemes.
