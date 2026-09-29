# Pakker: presets that recompute real policy proposals

Date: 2026-09-28. Issue: makroskop-48o. Status: approved in chat, spec for review before planning.

## Goal

A reader of /pakke/ can open a named, published policy proposal (e.g. Personskattereform 2025/26)
and see what MAKRO says it does to GDP, employment and the public finances. Every proposal goes
through the same method, sized from the same kind of official figure, shown with the same card, and
the method is published on its own page. The site recomputes proposals; it does not rate them.

## Decisions (from the brainstorm)

- **Structural labour supply:** MAKRO does not compute it. In the shock model
  `shLHh = 1/uh · ((1−mtInd)/fhLHh)^(1/eh)` with `fhLHh = 1−mtInd` (`struk.gms:232,236`), so marginal
  taxes cancel out of structural hours; only the wage-bargaining term `dFF2dLoen`
  (`labor_market.gms:455`) sees `mtInd`. The Finance Ministry adds the structural effect from its own
  models. A preset therefore carries the **Finance Ministry's published structural employment
  estimate as its own package row** (Arbejdsudbud_beskaeftigelse, scaled to that estimate), labelled
  as such and removable. Leaving it out would bias every tax proposal against spending proposals; the
  proposer's own estimate would mean a different source per party.
- **Instruments:** the proposal's own instruments are solved where MAKRO has them. Two new catalog
  shocks: Topskat (`tTop`) and Beskæftigelsesfradrag (`tBeskFradrag`), both exogenous in the zip
  (`is_fixed` checked for 2030). MAKRO June 2026 has **one working topskat step**: `tMellem` (7.5 %)
  and `tTopTop` (5 %) are set in 2030, but their bases `rMellemSkatInd`/`rTopTopSkatInd` are 0 in
  every age group and year (`GovRevenues.gms:826`: "Når vi har data for vtMellem og vtTopTop skal de
  indlæses her!"), so shocking them moves neither revenue nor the marginal tax. An element on an
  instrument MAKRO lacks is mapped onto **the nearest working instrument of the same tax, at the same
  static revenue**, and the row says so (`mappedDa`); the reform's mellemskat/topskat/toptopskat
  elements become one Topskat row. The joint-solve check below still applies.
- **Launch set:** a published inclusion rule plus a balanced first set: Personskattereform 2025/26
  and two or three Finance-Ministry-costed party proposals from across the spectrum. The shortlist is
  researched and approved by the owner before anything ships.
- **Financing:** the proposal's own. A preset opens unfinanced (`_ufin`) with the stated financing as
  rows (e.g. Offentligt_forbrug −x), so the saldo shows what is left. The closure chips still work.
- **Size:** fully phased-in, permanent from 2030, measured in pct. of GDP (see Conversion). No
  phase-in paths.
- **Approach A:** source figures are data, scales are computed. No scale is typed by hand.

## Non-goals

- No distributional effects (MAKRO has age but not income deciles); the method note says so.
- No phase-in profiles, no temporary elements (a proposal whose core is temporary is not eligible).
- No kroner-size input on ordinary package rows (possible follow-up, same conversion function).
- No share-card image per preset in this issue (follow-up bead); the route gets title and description.
- No rating, ranking or "best proposal" wording anywhere.

## Proposals are added on top of the grundforløb

Every preset is laid on top of MAKRO's grundforløb, enacted or not. What the grundforløb carries was
checked for the reform's instruments (2030 reference): one topskat step at 15 % on the historical
topskat base (`vtTop` 22.8 mia. kr.), zero-base mellemskat and toptopskat, `tBeskFradrag` unchanged
from 2025. For each proposal the research step checks the same thing, and an element the
grundforløb already contains is left out and listed in `omittedDa` with the reason. `Proposal.status`
(`'vedtaget' | 'forslag'`) is shown on the card and in the list, and changes nothing in the arithmetic.

## Conversion

Each fiscal catalog shock gets a **static saldo effect at ×1**, `staticSaldoPct`: the change in the
public balance before any behaviour, in pct. of 2030 GDP, positive when it strengthens the balance.
Computed from `_reference.gdx` and written by `extract.py` into meta.json's `sizing` block (so it
exists before a shock is solved, and the joint-solve queries can be computed first):

- proportional rate taxes (`vtX = tX · base`): `vtX_2030 · Δt / t_ref / vBNP_2030`
  (Bundskat `vtBund`, Topskat `vtTop`, AM-bidrag `vtHhAM`)
- Beskæftigelsesfradrag (`vBeskFradrag = tBeskFradrag · vWHh`, deducted from `vSkatteplInd`, so it
  is worth the kommune- and kirkeskat, `GovRevenues.gms:298,433,462,499`):
  `−vBeskFradrag_2030 · Δt / t_ref · (tKommune·ftKommune[tot] + tKirke·ftKirke·rtKirke) / vBNP_2030`;
  the formula and its value are shown in the method note
- spending (Offentligt_forbrug, varekøb, beskæftigelse, investeringer, overførsler):
  `−Δspending_2030 / vBNP_2030`
- non-fiscal shocks (Rente, Eksportmarkedsvækst, …): `null`; a preset may not use them.

The formulas live in `etl/static_saldo.py` (`STATIC_SALDO: dict[str, Callable[[Reference], float]]`
keyed by catalog shock name), each unit-tested against a hand calculation from the reference values.
Only the shocks the approved shortlist needs get one; a shock without one cannot be used in a preset.

A proposal element states the Finance Ministry's **umiddelbar provenuvirkning** (static, before
behaviour and tilbageløb) in mia. kr. in a stated price year, with the same sign convention. Then

    elementPct = kr / vBNP[priceYear]            (vBNP from the reference, years ≥ 2022)
    scale      = elementPct / staticSaldoPct

The structural row: `scale = fte / (0.01 · snL_2030 · 1000)`, with `snL` from the reference (`sizing`).
Arbejdsudbud_beskaeftigelse raises participation, so the method note says the Finance Ministry's
full-time persons are applied as persons (the hours/persons split is not modelled).

All of this is a pure function `proposalComponents(proposal, shocks, baseline)` in
`app/src/lib/proposal.ts`, returning the `PackageComponent[]` plus the per-row chain for the card
("Topskat: −4,1 mia. kr. (2025) = −0,15 pct. af BNP → ×−0,63").

## Verification solve

Linear sums are honest to ~2 % per shock at ladder sizes (makro-linearity), but real proposals need
scales far off the ladder (a topskat change of several pct.-points is far beyond ×2 of a +1 pct.-point shock).
So every preset ships with a **joint solve**: the whole package (all instruments, the structural swap,
the financing rows) solved as one full-horizon `_ufin` run. freesolver gains per-instrument sizes in
one run: `solve-export --package "Topskat=-0.8&Arbejdsudbud_beskaeftigelse=0.12&Offentligt_forbrug=-0.3"`
takes the /pakke/ query itself, looks each shock up in `catalog.SHOCK_RUNS` (solver shock, factor,
delta, endogenize) and applies it with its scale as the weight, `level·(1 + (factor−1)·scale) +
delta·scale`, the same rule the profile weights already use. The query is stamped in
`makroskop_meta` as `package`.

The ETL writes, per preset, the largest relative gap between the linear sum and the joint solve on
the headline series (qBNP, nL, saldo2bnp, qC, vhW) over 2030–2060 into `proposals.json`. The card
shows it ("Den lineære sum afviger højst 1,8 pct. fra en samlet modelkørsel af hele forslaget").
**A preset whose gap exceeds 10 % on any headline series does not ship**; the charts always show
the linear sum, so an edited preset and the unedited one use the same arithmetic.

## Data and files

- `app/src/lib/proposals.ts` — the proposals, verbatim source figures only:
  `{ id, titleDa, proposerDa, status, date, sources: {labelDa, url}[], elements: {shock, labelDa, kr,
  priceYear, sourceIndex, mappedDa?}[], structuralFte: {fte, sourceIndex} | null, financing: same as elements,
  omittedDa: string[], revisions: {date, noteDa}[] }`. No scale, no wording override, no headline
  choice: the type has no field that could treat one proposal differently.
- `app/src/lib/proposal.ts` (+ test) — conversion, eligibility check, card text.
- `etl/catalog.py` — two new `ShockDef`/`ShockRun`s (Topskat, Beskaeftigelsesfradrag) with Danish wording.
- `etl/static_saldo.py` — the static formulas; `etl/extract.py` writes meta.json `sizing`:
  `staticSaldoPct` per shock, reference `vBNP` in mia. kr. 2022–2030, `snL` 2030.
- `app/scripts/proposal-specs.ts` — writes `etl/proposal_specs.json` (id → package query) from
  `proposals.ts`, so the solver and the ETL use exactly the scales the page computes.
- `etl/freesolver.py` — `--package`; `etl/proposals_check.py` — reads `etl/proposal_gdx/Forslag_<id>.gdx`,
  checks the stamped query against the spec, writes `app/static/data/proposals.json` (gap per preset).
- `cloud/run_proposals.sh` — the 4 new shock runs plus one joint solve per preset.

## Page

- **/pakke/**, empty state: a "Forslag" list above the existing examples, ordered by date, each
  line the title, proposer as the source names them and status. Choosing one loads its rows with
  `variant=_ufin` and shows the proposal card.
- **Proposal card** (above the rows): title, proposer, date, status, source links; the conversion
  chain per row; the structural row labelled "Strukturel virkning – Finansministeriets skøn: +X
  fuldtidspersoner"; the verification sentence; "Ikke med i beregningen": the proposal's `omittedDa`
  plus the standard exclusions (phase-in, distribution, interactions beyond the verification solve);
  link to the method note.
- **Off-ladder scales:** `scaleSteps` gains the current value when it is not on the ladder, so the
  select shows ×−0,63.
- **Edited presets:** any change to rows, sizes or closure turns the card into "Tilpasset fra:
  *<title>*" with a link back. An edited package never carries the proposal's name, in the page,
  exports or share text.
- **/pakke/forslag/<id>/**: one prerendered route per proposal (entries from `proposals.ts`), the
  same page with the preset loaded, its own `<title>` and description. This is the citable URL.
- **/pakke/metode/**: the method note (below).

## Method note (/pakke/metode/, Danish)

1. Hvad et forslag er her, and the inclusion rule: (a) the Finance Ministry has published the
   static revenue of every element and the structural employment effect (lovforslag, aftaletekst
   or folketingssvar); (b) every element maps to a solved instrument; (c) the joint solve agrees
   with the linear sum within 10 %. Anyone can ask for a proposal to be added; requests are handled
   in order of arrival, and a rejected request is answered with the rule it fails.
2. Størrelse: the conversion, with the static-saldo formula and value of every shock used.
3. Strukturel virkning: why MAKRO needs it from outside and why the Finance Ministry's estimate is
   used for every proposal.
4. Finansiering: the proposal's own; every proposal is laid on top of the grundforløb, and elements the grundforløb already holds are left out.
5. Hvad MAKROskop ikke er: not the Finance Ministry's or DREAM's calculation; no distribution; no
   phase-in.
6. Rettelser: every preset's `revisions`, dated.

## Testing

- `proposal.test.ts`: conversion against hand numbers; sign conventions (tax cut, spending cut,
  mapped rows); eligibility (non-fiscal shock, missing source index, missing structural
  estimate); the card text; a **same-method test** that runs every entry in `proposals.ts` through
  `proposalComponents` and asserts each has sources for every figure and nothing outside the type.
- `package.test.ts`: `scaleSteps` with an off-ladder current value.
- ETL: `static_saldo` per new and existing fiscal shock against hand calculations from the
  reference; the stamp check covers the new runs; `proposals.json` gap computation on a fixture.
- freesolver: `--package` parsing, and on a 12-year window that `--package Bundskat=1` equals today's
  `--shock-name tBund --shock-delta 0.01` run to 1e-11.
- Build: `verify:build` checks each `/pakke/forslag/<id>/` exists and `/pakke/metode/` links resolve.
- Page: preset load, edit → "Tilpasset fra", both colour schemes, phone width.

## Order of work and gates

1. Research the shortlist (Personskattereform 2025/26 + 2–3 costed party proposals) with sources
   and figures. **Owner approves the shortlist.**
2. Solver `--package`, catalog entries, `static_saldo`. Box runs: 4 shock runs + joint solves.
   **Owner's go-ahead for box time** (shared production box; run when quiet).
3. ETL, `proposal.ts`, page, method note, routes.
4. Final review of wording for neutrality by the owner before push.
