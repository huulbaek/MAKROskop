# Front page: a question with a live answer

Date: 2026-09-25. Status: approved in chat, spec for review before planning. Bead: makroskop-169
(epic makroskop-gnp).

## Goal

A first-time visitor — a journalist, an interested citizen, a policy person — understands within
five seconds that MAKROskop lets you ask the Finance Ministry's model "what if", and sees a real
answer. Today `/` opens on the stylised baseline, which the page itself says is not a forecast.

The front page asks "Hvad sker der, hvis …" and answers one of six curated questions with a solved
MAKRO scenario: three headline numbers, a line on what is left after five years, one chart, and
the way into the full scenario. The baseline moves to `/grundforloeb/` unchanged.

## Non-goals

- No new data, solver runs or ETL changes. Only already-solved `_ufin` scenarios are shown.
- No mirrored or scaled numbers on the front page: every answer is a scenario as solved.
- No per-chip URL (`?q=`), no animation, no sentence builder over the whole catalogue.
- The plain-Danish answer sentence on scenario pages is makroskop-glk; it may later reuse the
  text logic from this page, but is not built here.

## The six questions

All unfinanced (`_ufin`), at their solved size. The chip label is the short form; the question
completes "Hvad sker der, hvis …".

| Chip | Question (after "Hvad sker der, hvis …") | Scenario file |
|---|---|---|
| renten stiger *(default)* | ECB hæver renten med 1 pct.-point? | `Rente_ufin` |
| momsen sænkes | momsen sænkes med 0,5 pct.-point? | `Moms_ned_ufin` |
| bundskatten hæves | bundskatten hæves med 1 pct.-point? | `Bundskat_ufin` |
| det offentlige forbrug øges | det offentlige forbrug øges med 1 pct.? | `Offentligt_forbrug_ufin` |
| eksporten vokser | eksportmarkederne bliver 1 pct. større? | `Eksportmarkedsvaekst_ufin` |
| flere vil arbejde | 1 pct. flere vil arbejde? | `Arbejdsudbud_beskaeftigelse_ufin` |

The question wording is hand-written per entry. Each entry also carries `solvedAs`, the exact
`definition.changeDa` it was written against (e.g. `"+1 pct.-point (100 basispoint)"` for
Rente, `"−0,5 pct.-point"` for Moms_ned) and `solvedMove`, the catalog `factor`/`delta`; a unit
test asserts both against the scenario file. Both are catalog values, not read from the solve, so
where a scenario carries the instrument's own series (Rente) a test also checks the solved move
itself. Carrying the solver's stamp into the JSON would close the gap for all six (review
finding, 2026-09-25; separate bead).

The set is chosen so the contrast between demand and supply shocks is visible without prose:
demand shocks fade within five years as wages adjust; the labour-supply shock keeps growing.

## The answer

Built by a pure function from a trimmed scenario plus baseline levels:

- **Framing line** under the question: "Varigt, ufinansieret stød fra 2030 · tallene er
  afvigelser fra grundforløbet" — the questions read like one-off events; the runs are permanent
  and unfinanced (review finding, 2026-09-25). The description says "varigt og ufinansieret" too.
- **Three tiles**, via `cardTiles` from `lib/card.ts` (same numbers and formatting as the share
  cards): employment in persons in year 1, BNP in pct. in year 3, public balance in pct. of BNP
  in year 1.
- **The five-year line**, from employment in year 5 (shock year + 4) in persons, using the
  baseline employment level of that year:
  - fades — `|y5| ≤ 0.2·|y1|`: "Efter 5 år er beskæftigelseseffekten næsten væk (y5 personer)."
  - grows — same sign and `|y5| > |y1|`: "Efter 5 år er effekten vokset til y5 personer."
  - otherwise: "Efter 5 år: y5 personer i beskæftigelse i forhold til grundforløbet."
  `y5` is formatted with `formatPersons` (signed, nearest 10/100).
- **The chart**: BNP (`qBNP`) and employment (`nL`) as percent deviations from the baseline,
  2029–2045, two series with the existing `LineChart` legend, zero line on.
- **Links**: "Se hele scenariet →" to that answer's share-card page `/scenarier/<file>/`;
  "Alle stød" to `/scenarier/`; "Byg en pakke" to `/pakke/`.

With the six values from the table above, the year-5 lines read: Rente, Bundskat, Offentligt
forbrug, Eksport and Moms fade; Arbejdsudbud grows.

## Units

- `src/lib/frontpage.ts` — pure and unit-tested. Exports the `QUESTIONS` list (chip, question, solvedAs,
  file), `trimScenario(scenario)` (keeps `shock`, `variation`, `definition`, and the deviations
  of `qBNP`, `nL`, `saldo2bnp` only) and `buildAnswer({ question, scenario, baseline levels })`
  returning tiles, five-year line and chart series.
- `src/routes/+page.server.ts` — prerendered. Reads the six scenarios and the baseline with the
  `$lib/server/scenarios` helpers, trims, and returns `{ answers }` (about 2 KB per answer
  instead of 54 KB). A missing scenario file throws, so the build fails loudly.
- `src/routes/+page.svelte` — the new front page (below).
- `src/routes/grundforloeb/+page.svelte` and `+page.ts` — today's `/` moved as-is.
- `src/routes/+layout.svelte` — nav "Grundforløb" points to `/grundforloeb/`; the logo is the
  way home. The front page gets its own `<title>`, description and `og:title`.

## Page layout (top to bottom)

1. Heading "Hvad sker der, hvis …" in the serif display face; the six chips below it as toggle
   buttons (`aria-pressed`), default "renten stiger".
2. The full question as a subheading; the three tiles in the existing `StatTile` style; the
   five-year line.
3. The chart.
4. The three links.
5. A trust strip: MAKRO is the Finance Ministry's model; MAKROskop solves it with a free solver
   and checks the results against DREAM's own — link to `/validering/`.
6. A doorway to the baseline: one line and a link to `/grundforloeb/`.

Existing editorial visual language: serif display, ruled sections, no cards. The MAKRO teal
stays UI-only (chips, links), never a chart series colour.

Switching chips swaps the answer instantly (all six are in the page data). A polite live region
announces "Viser: <question>". Without JavaScript the default answer is fully rendered and the
links work; the chips need JavaScript.

## Head tags

- `<title>`: "MAKROskop – spørg Finansministeriets model, hvad der sker, hvis …".
- Description: the default question and its three numbers in one sentence, generated at build
  time from the default answer.
- `og:image` stays the site image `og.png`.
- `/grundforloeb/` takes over today's front-page description.

## Testing

- `frontpage.test.ts`: every question's file exists in `meta.json` with `_ufin` available; the
  question's size agrees with `definition.changeDa`; tiles equal `cardTiles` for the same input;
  the three five-year branches with synthetic series; `trimScenario` keeps exactly the three
  series.
- `verify-build.ts`: `/` contains the default question, the tiles and six chips, and the new
  `<title>`; `/grundforloeb/` exists with the "Dansk økonomi, beregnet et århundrede frem"
  heading and the old description.
- Browser pass: chip switching and keyboard focus, light and dark, a 375 px width screenshot,
  no console errors.
