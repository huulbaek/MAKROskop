# Embeddable charts for newsrooms

Date: 2026-09-27. Issue: makroskop-64y. Status: approved in chat, spec for review before planning.

## Goal

A journalist can put one live MAKROskop chart into an article: copy an `<iframe>` code from any
chart on a scenario page, or paste an embed link into a CMS that expands links (oEmbed). The
embed states what was shocked, shows the chart, credits the source and links back to the full
view. This is how the product spreads beyond share cards.

## Decisions (from the brainstorm)

- **Unit:** one chart (one series of one scenario view), not a whole-view summary.
- **Compare:** an embed copied from a page in compare mode draws both runs (Ufinansieret /
  Finansieret) with the one-line financing note; otherwise one line.
- **Data:** always current. The iframe loads the live scenario JSON; a re-solve changes published
  embeds, traceable through the model version and build date in the source line. No versioned
  data vintages are hosted.
- **Formats:** iframe code and oEmbed discovery, both static (no server).
- **Height:** a fixed height in the code that works without scripts, plus an optional resize
  script (postMessage), as Datawrapper does.
- **Routes:** one prerendered embed page per (scenario, series); scale and compare are query
  parameters read on the client. oEmbed therefore describes the solved size (×1); scaled or
  compared embeds go into articles through the copied iframe code.

## Non-goals

- No slider, year scrubber, mechanism map, explainer text or PNG/CSV download in the embed; the
  footer link leads to the page that has them.
- No dark theme in the embed (a static embed cannot know the host article's theme; same choice as
  the share cards).
- No frozen/versioned embeds, no embeds of the baseline (Grundforløb) or package (Pakker) pages,
  no whole-view summary embed. Each is a possible follow-up.
- No change to the solver or the ETL. (nginx gained one header after the final review: CORS
  `Access-Control-Allow-Origin *`, because oEmbed consumers such as WordPress sandbox the iframe,
  which makes the embed's own scripts and data cross-origin requests.)

## Routes and files

- `src/routes/indlejr/[scenario]/[serie]/+page.server.ts` and `+page.svelte`, prerendered.
  - `entries()`: every (scenario, series) with data, from `meta.json` and the scenario files. The
    series are the page's charts: the 12 fixed keys of `ScenarioExplorer` (`qBNP, nL,
    ledighedsgrad, qC, qX, qM, qI, vhW, pC, pBolig, saldo2bnp, primsaldo2bnp`), the scenario's
    instrument (`definition.seriesKey`), and `tLukning` for financed (`_perm`) views. Measured on
    the current data: 979 pages. A prerendered scenario page is ~36 KB, so ~35 MB more in the
    build.
  - `load()` returns head data only (headline parts, chart title and unit, canonical and oEmbed
    URLs); the scenario JSON is fetched on the client, as on the share pages, so no page inlines
    ~55 KB of data.
  - Query: `?skala=<n>` snapped to the allowed scale steps (`scaleSteps(definition.maxScale)`),
    unknown values fall back to 1; `?sammenlign` fetches the partner run (`partnerVariation`)
    and is ignored for variants without one.
- `src/routes/oembed/[scenario]/[serie].json/+server.ts`, prerendered with the same entries: a
  static oEmbed 1.0 JSON of type `rich` — `version`, `type`, `html` (the iframe code for the ×1
  embed, with the resize script), `width`, `height`, `title`, `provider_name: "MAKROskop"`,
  `provider_url`, `cache_age`.
- Each embed page's head: `<link rel="alternate" type="application/json+oembed" href=…>` (its own
  file), `<meta name="robots" content="noindex">`, `<link rel="canonical">` to the scenario view
  (`/scenarier/<scenario>/`), and a `<title>` (the headline and chart title).
- `static/indlejr/resize.js`: the optional host-page script (see Security).
- `src/routes/+layout.svelte`: renders only `children` (no header, nav, footer, skip link) when
  the route is under `/indlejr/`. `src/app.html`'s theme bootstrap sets `light` there.
- `src/lib/embed.ts` (pure, unit-tested): `EMBED_SERIES`, `embedEntries(meta, scenarios)`,
  `embedPath`, `embedUrl({ scenario, serie, scale, compare })`, `embedHeight({ compare })`,
  `embedCode({ url, title, height, script })`, `oembedJson(...)`, `readEmbedQuery(url, steps,
  hasPartner)`. The headline reuses `card.ts` (`cardSubject`, the scaled change wording, the
  profile and closure words); the source line reuses `provenanceLine` from `export.ts`; the
  financing note reuses `financingLine` from `compare.ts`.
- `src/lib/components/EmbedChart.svelte`: the embed's body.
- `src/lib/components/EmbedDialog.svelte`: the dialog on the scenario page.
- The scenario page's chart list (`chartKeys`) moves to `embed.ts` (`EMBED_SERIES`) and
  `ScenarioExplorer` imports it, so the page and the embeds cannot drift apart.

## The embed (`EmbedChart.svelte`)

Light theme, full iframe width, no site chrome, top to bottom:

1. **Headline:** subject, change and closure in the share-card wording, e.g. "ECB-renten +0,5
   pct.-point, varigt og ufinansieret"; a mirrored scale reads as the mirrored change.
2. **Chart title and unit:** e.g. "BNP (realt) — afvigelse fra grundforløb, pct."
3. **Chart:** `LineChart` from 2029 to 2060 (the explorer's span), zero line, hover and keyboard
   readout, and the data table toggle as the accessible fallback. With `?sammenlign`: two
   series, "Ufinansieret" and "Finansieret", and the `financingLine` sentence under the chart;
   the instrument's own chart stays one line (it moves identically in both runs).
4. **Footer:** the `provenanceLine` source line, a note when the scale is not 1 ("×0,5 af det
   beregnede stød, lineær tilnærmelse", or "spejlet" for a negative scale), and the link "Se hele
   scenariet på MAKROskop →" (`target="_blank"`, `rel="noopener"`) to the view's page
   (`/scenarier/<scenario>/<skala>/`, plus `?sammenlign` when compared).

States: a fixed-height skeleton while loading (no layout jump in the article); on a failed fetch
one line, "Kunne ikke hente data", and the link.

Height: `embedHeight` gives the code's default, about 430 px for one chart and about 470 px with
the compare sentence (final values measured at 375 px width during implementation). The page
posts `{ type: 'makroskop:height', height }` to `parent` after each render and on resize
(`ResizeObserver` on the root element).

## Getting the code (`EmbedDialog.svelte`)

- An "Indlejr" button on every chart card of the scenario page, next to "Hent PNG", wherever
  that button is shown.
- It opens a native `<dialog>` for that chart, with a heading and label:
  - a live preview iframe at the current scale and compare state;
  - a read-only textarea with the code from `embedCode` and a "Kopiér" button (a polite live
    region says "Kopieret"). The code: `src` with `?skala=` and `sammenlign` only when not the
    default, `width="100%"`, the default height, `title` (the headline and chart, for screen
    readers), `loading="lazy"`, `style="border:0"`, `data-makroskop-embed`, and a fallback link
    inside the iframe element;
  - a checkbox "Tilpas højden automatisk", on by default, which appends `<script async
    src="https://makroskop.nodalit.com/indlejr/resize.js"></script>`; help text: some CMSs remove
    scripts, and the chart then keeps its fixed height;
  - the ×1 embed link for oEmbed, with the hint "Nogle CMS'er (fx WordPress) laver selv
    indlejringen, hvis du indsætter linket" and, when the view is scaled, that the link shows the
    size as solved.
- Close button, Esc and a backdrop click close it; focus returns to the button. Full screen on
  phones; the preview keeps its height and the code box scrolls.

## Security

- `resize.js` acts on a message only if its origin is the site's (`SITE_URL`), its `type` is
  `makroskop:height`, and `event.source` is the `contentWindow` of an iframe marked
  `data-makroskop-embed`; it then sets that iframe's `style.height`, clamped to 200–1200 px.
- The embed posts to `parent` with target `*`; the message carries only a height.
- nginx sends neither `X-Frame-Options` nor `frame-ancestors`; framing works without changes. It
  sends `Access-Control-Allow-Origin *` (public, cookie-free site) so sandboxed embeds can load.

## Errors

- Unknown scenario or series at prerender time: 404, and `entries()` lists only series with data.
- Missing scenario JSON at runtime: the in-frame message and link; never an empty chart.
- A bad `?skala=` falls back to 1; `?sammenlign` without a partner run is ignored.

## Testing

Written first:

- `embed.test.ts`: entries (count against the shipped data, no series without data, `tLukning`
  only for `_perm`); `embedUrl`/`embedCode` (default parameters left out, height with and without
  compare, HTML-escaped title, script toggle); `oembedJson` (required oEmbed fields, `html`
  points at the ×1 URL); `readEmbedQuery` (snapping, fallback, partner check); the headline of a
  scaled and a mirrored Rente view against the shipped data.
- `scripts/verify-build.ts`: every embed page and oEmbed file exists and they match one to one;
  each page's discovery `href` is its own file; `noindex` and canonical present; `resize.js`
  present.
- Browser: a local test page with a single, a compared and a mirrored embed, with and without
  the script; light theme under a dark OS setting; 375 px width; the dialog (copy, Esc, focus
  return); an accessibility audit in both colour schemes.
- Gates: `bun run test`, `bun run check`, `bun run build`, `bun run verify:build`.

## Docs

One line under Layout in `CLAUDE.md` (embed route, oEmbed files, `embed.ts`).
