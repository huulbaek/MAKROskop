# Open data: versioned downloads of every scenario

Date: 2026-09-27. Issue: makroskop-gko. Status: approved in chat, spec for review before planning.

## Goal

Researchers, analysts and data journalists can download every number MAKROskop shows, open it
in the tool they use (CSV for spreadsheets and statistics software, JSON for code), understand
every column without asking, and cite exactly which version of the numbers they used.

## Decisions (from the brainstorm)

- **Versioned releases.** Each data vintage is a version; the site serves the current one at
  stable URLs, and every version is kept as a GitHub Release with a zip. A citation names the
  version. A DOI comes later for free: once the owner switches the repository on in Zenodo
  (sign-in with GitHub), every `data-…` release gets one.
- **Contents:** the site's series only — per scenario the 50 series whose deviations are pct. or
  pct.-point, plus the baseline levels. The three `gdp_pp` series (vSaldo, vPrimSaldo, vOff13Net) are
  raw level differences ×100 in the JSON and are left out of the CSVs (final review); their ratios
  to BNP are published. The solved GDX files (4 GB) are not published.
- **CSV dialects:** both an international one (comma, decimal point, UTF-8) and a Danish one
  (semicolon, decimal comma, UTF-8 with BOM).
- **Licence:** CC BY 4.0 for the data (the code stays MIT). Credit: MAKROskop; model: DREAM's
  MAKRO.
- **Architecture:** the site serves the current version (files generated at build time); GitHub
  Releases keep every version; a committed manifest ties the two together.

## Non-goals

- No GDX files, no Parquet or Excel files, no API.
- No English page copy (makroskop-dtd); the dictionary carries the English series labels.
- No change to the ETL, the solver or nginx.
- The site's ×-slider is linear scaling of the solved run; the files hold only the solved size.

## Files

All under `/data/`, next to the existing JSON (`/data/meta.json`, `/data/baseline.json`,
`/data/shocks/<scenario>.json`, which stay as they are).

| Path | Content |
|------|---------|
| `/data/csv/<scenario>.csv` | International dialect, one row per year 1985–2100: `year`, then one column per series (header = series key). Values: deviations from the reference, 4 decimals, empty where the JSON has null. |
| `/data/csv-da/<scenario>.csv` | Danish dialect of the same; header `year` → `år`, series columns `<labelDa> [<key>]`. |
| `/data/csv/alle-scenarier.csv` (+ `csv-da/`) | Long format: `scenario, shock, variant, series, year, value` (Danish headers: `scenarie, stød, variant, serie, år, værdi`), one row per non-null value. |
| `/data/csv/grundforloeb.csv` (+ `csv-da/`) | Baseline levels from `baseline.json`, one row per year, one column per series. |
| `/data/ordbog.csv`, `/data/ordbog-da.csv` | Data dictionary: `key, label_da, label_en, group, unit, deviation_unit` (Danish headers in `ordbog-da.csv`); `deviation_unit` is `pct.` or `pct.-point` (`devUnit`). |
| `/data/udgivelse.json` | The manifest (committed; see Versions). |
| `/data/makroskop-data-<version>.zip` and `/data/makroskop-data.zip` | The whole current version: `meta.json`, `baseline.json`, `shocks/*.json`, both CSV dialects of every CSV above, both dictionaries, `udgivelse.json` and `LAES-MIG.md`. Deterministic: fixed entry order and timestamps, so every build of a version gives the same bytes. |

`LAES-MIG.md` (Danish, with a short English section): what the numbers are (deviations from the
calibrated reference; pct. for quantities and prices, pct.-point for rates, shares and balances),
shock year 2030, horizon (solved to 2129, published to 2100), the four variants and the financed
closure, the free solver and a link to /validering/, the file list, how to cite, the licence, and
the credit to DREAM's MAKRO (not a DREAM or Finance Ministry product).

Generation: `app/scripts/data-files.ts` (bun) runs in `bun run build` after `vite build`, like
`scripts/og-images.ts`, and writes into `build/data/`. Only the manifest is committed; the CSVs
and the zip are derived from the committed JSON. The zip uses `fflate` (pure JS, no
dependencies) as the one new dependency.

Pure logic lives in `app/src/lib/opendata.ts` (relative imports only, used by the bun scripts and
the page): CSV builders for both dialects (wide per scenario, long, baseline, dictionary), the file
list, the zip builder, the version rule, the citation text, and the manifest type.

## Versions

- **Version number:** the release date, `YYYY.MM.DD` (`2026.09.27`); a second release on the same
  day is `2026.09.27.2`. Git tag: `data-<version>`.
- **Manifest `app/static/data/udgivelse.json`:** `version`, `date`, `format` (the
  `FORMAT_VERSION` it was built with), `model` (`name`, `commit`, `fingerprint`,
  `dataBasisDa` from `meta.json`), `license: "CC-BY-4.0"`, `doi` (optional, absent until Zenodo),
  `changelog` (one line), `files` (SHA-256 per committed data file: `meta.json`, `baseline.json`,
  every `shocks/*.json`), `earlier` (list of `{ version, date, changelog, url }` for previous
  releases, `url` = the GitHub Release page).
- **Data guard:** an app test recomputes the SHA-256 of the committed data files and fails when
  they differ from the manifest, with "Data er ændret siden version <v>: kør `bun run
  data:release`". The same check (`buildProblems`) stops the build step, since the deploy runs
  no tests. The manifest also pins the zip (`zip`: name, bytes, SHA-256), so any change to the
  zip's bytes — read-me or citation wording included — needs a new version (final review); the
  zip's own copy of the manifest leaves out `zip` and `doi`.
- **Format guard:** `FORMAT_VERSION` in `opendata.ts` must equal the manifest's `format`; changing
  a CSV or zip layout means bumping the constant, which fails the same test until a new release.
- **`bun run data:release`** (local): computes the checksums and the next version, moves the
  current version into `earlier`, asks for a changelog line (or takes `--changelog`), writes the
  manifest. The owner commits and pushes as usual; the site then serves the new version.
- **`bun run data:publish`** (outward-facing, run only with the owner's go-ahead): builds the zip
  with the same function as the site build, then `gh release create data-<version>` with the zip
  attached and the changelog as notes. It refuses when `gh` is not logged in, the tag exists, or
  the committed data differs from the manifest.
- **First release:** `2026.09.27` from the current data.
- **DOI:** when the manifest has `doi`, the page and the citation show it. Switching Zenodo on is
  the owner's step and needs no code change.
- **`CITATION.cff`** at the repository root: title "MAKROskop: scenarieberegninger med MAKRO",
  author (the repository owner, as in `LICENSE`), the current data version and date, the site
  URL, licence CC-BY-4.0 for the data, and a `references` entry for DREAM's MAKRO
  (github.com/DREAM-DK/MAKRO). `data:release` updates its version and date.

## The page `/aabne-data/`

Prerendered route `src/routes/aabne-data/`, a nav entry "Data" (with its own meta description in
the layout's link list). Top to bottom:

1. **Heading and intro:** "Hent tallene bag MAKROskop" — every scenario the site shows, as
   deviations from the model's reference path, free to reuse under CC BY 4.0.
2. **Download the whole dataset:** a button to `makroskop-data-<version>.zip` with its size; the
   version line ("Version 2026.09.27 · MAKRO 2026-June (01f2a43) · Nationalregnskabsdata fra
   marts 2026 · 78 scenarier"); in a `<details>`: the zip's SHA-256 and a link to
   `udgivelse.json`. Size and checksum are computed at prerender time with the same zip builder.
3. **What the numbers are:** 4–5 short paragraphs (the `LAES-MIG.md` content in page form).
4. **Per scenario:** a table grouped by the catalog groups (`ShockMeta.group`), one row per shock,
   and for each available variant the links JSON · CSV · CSV (dansk) and "vis" (the scenario
   page).
5. **All in one file:** links to `alle-scenarier.csv` in both dialects and the baseline levels,
   with one sentence on the long format and its columns.
6. **Data dictionary:** a table of the series (key, label, group, unit, deviation unit) and links
   to `ordbog.csv` / `ordbog-da.csv`.
7. **How to cite:** a copyable citation in Danish and English (version, link, DOI when present),
   and the note that the model is DREAM's MAKRO and MAKROskop is not a DREAM or Finance Ministry
   product.
8. **Earlier versions:** version, date, changelog line and a link to the GitHub Release; the
   section is hidden while `earlier` is empty.

Links in: the nav entry; one line under the scenario page's source line ("Alle tallene kan
hentes under Data" linking to `/aabne-data/`); the scenario page's CSV export gains the data
version in its `#` provenance lines (the manifest is imported at build time).

## Errors and guards

- The data and format guards (above) stop a stale version label from reaching the site.
- `scripts/verify-build.ts` checks that every file the page links to exists in `build/`, that
  the built zip's SHA-256 equals the one the page shows, and that the zip lists every file in the
  manifest plus the CSVs, dictionaries and `LAES-MIG.md`.
- `data:publish` refuses as listed above; it never force-updates a tag.

## Testing

Written first:

- `opendata.test.ts`: the international CSV of Rente_ufin parsed back equals the JSON deviations
  to 4 decimals; the Danish dialect has the BOM, semicolons, decimal commas and labelled headers
  and parses back to the same numbers; the long file's row count equals the non-null values over
  all scenarios; every series in the data is in the dictionary; the version rule (new day → date,
  same day → `.2`, then `.3`); the zip built twice is byte-identical and holds exactly the
  expected entries; the citation with and without a DOI.
- The data and format guard test against the committed data and manifest.
- `verify-build.ts` as above, plus the page's prerendered links to all 78 × 3 per-scenario files.
- Browser: the page at 375 px and desktop, a real download of the zip, and an accessibility
  audit in both colour schemes.
- Gates: `bun run test`, `bun run check`, `bun run build`, `bun run verify:build`.

## Docs

One line under Layout in `CLAUDE.md` (the page, the files, `opendata.ts`, the release commands and
the guards).
