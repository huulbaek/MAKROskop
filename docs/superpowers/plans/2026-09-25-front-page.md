# Front Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the baseline front page with "Hvad sker der, hvis …": six curated questions, each answered by a solved `_ufin` scenario; move the baseline to `/grundforloeb/`.

**Architecture:** A pure module `lib/frontpage.ts` holds the questions and builds answers (tiles via the share cards' `cardTiles`, a five-year employment line, chart series). A prerendered `+page.server.ts` reads the six scenarios at build time, trims them to three series and hands all answers to the page, so chip switching needs no fetch. The layout reads an optional `head` from page data for the front page's title and description.

**Tech Stack:** SvelteKit 2 static (adapter-static, everything prerendered), Svelte 5 runes, TypeScript, vitest, bun. Run everything from `app/`.

**Spec:** `docs/superpowers/specs/2026-09-25-front-page-design.md`

## Global Constraints

- Danish-first UI copy. MAKRO teal (`--makro`, `--makro-strong`) is UI-only, never a chart series colour; charts use `LineChart`'s default `--series-1`/`--series-2`.
- Only already-solved `_ufin` scenarios, shown exactly as solved: no scaling, no mirroring.
- Editorial visual language: serif display (`--font-display`), ruled sections (`--rule`, `--rule-strong`), no boxed cards. Reuse global `.chip-row`, `.chip`, `.chip.active`, `.lede` from `src/app.css`.
- No new data files, no ETL or solver changes, no new dependencies.
- `trailingSlash = 'always'`: every internal link ends in `/`.
- Commits: descriptive body, reference `makroskop-169`.

## Review Focus

- A scenario re-solved at a different size (e.g. Rente +0,5) → the question text would lie; `solvedAs` test in Task 1 must fail.
- A scenario file missing at build time → the build must fail, not ship a front page with a hole; Task 3 relies on `readJson` throwing, and Task 4's verify-build asserts six chips.
- Year-1 employment effect of exactly zero (or rounding to zero) → the five-year line must still read sensibly, no division; Task 1 tests `fiveYearLine(0, 0)` and `fiveYearLine(0, 500)`.
- Keyboard and screen-reader users switching chips → focus stays on the chip, the answer change is announced; Task 3 browser step checks `aria-pressed` and the live region.
- Old bookmarks and share links to `/` expecting the baseline → the baseline must be one click away (nav "Grundforløb" and the doorway line); Task 4 verify-build checks `/grundforloeb/` and the doorway link.

---

### Task 1: `lib/frontpage.ts` — questions and answers

**Files:**
- Create: `app/src/lib/frontpage.ts`
- Test: `app/src/lib/frontpage.test.ts`

**Interfaces:**
- Consumes: `cardTiles`, `formatPersons`, `CardLevels`, `CardTile` from `$lib/card`; `Scenario`, `ScenarioDefinition` from `$lib/data`; in tests `readMeta`, `readScenario`, `readBaseline`, `levelsAt` from `$lib/server/scenarios`.
- Produces:
  - `interface Question { chip: string; question: string; file: string; solvedAs: string }`
  - `const QUESTIONS: Question[]` (six entries, default first)
  - `interface TrimmedScenario { shock: string; variation: string; definition: Pick<ScenarioDefinition, 'firstYear' | 'changeDa'>; deviations: Record<string, (number | null)[]> }`
  - `trimScenario(scenario: Scenario): TrimmedScenario`
  - `fiveYearLine(y1: number, y5: number): string`
  - `interface Answer { question: Question; tiles: CardTile[]; fiveYear: string | null; chart: { key: string; label: string; values: (number | null)[] }[]; href: string }`
  - `buildAnswer(input: { question: Question; scenario: TrimmedScenario; yearStart: number; levels: CardLevels | null; nL5: number | null }): Answer`
  - `interface PageHead { title: string; description: string }`
  - `homeHead(answer: Answer): PageHead`

- [ ] **Step 1: Write the failing tests**

`app/src/lib/frontpage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cardTiles } from './card';
import { QUESTIONS, buildAnswer, fiveYearLine, homeHead, trimScenario, type TrimmedScenario } from './frontpage';
import { levelsAt, readBaseline, readMeta, readScenario } from './server/scenarios';

describe('QUESTIONS', () => {
	it('has six questions, the ECB rate first', () => {
		expect(QUESTIONS).toHaveLength(6);
		expect(QUESTIONS[0].file).toBe('Rente_ufin');
	});

	it('every question points at a solved unfinanced scenario', () => {
		const meta = readMeta();
		for (const q of QUESTIONS) {
			const name = q.file.replace(/_ufin$/, '');
			expect(q.file, q.chip).toMatch(/_ufin$/);
			expect(meta.shocks.find((s) => s.name === name)?.available, q.file).toContain('_ufin');
		}
	});

	it('every question was written against the size the scenario was solved at', () => {
		for (const q of QUESTIONS) {
			expect(readScenario(q.file).definition?.changeDa, q.file).toBe(q.solvedAs);
		}
	});
});

/** 1985-based series with values only where the test sets them. */
function series(yearStart: number, values: Record<number, number>): (number | null)[] {
	return Array.from({ length: 50 }, (_, i) => values[yearStart + i] ?? 0);
}

const fake = (nL: Record<number, number>): TrimmedScenario => ({
	shock: 'X',
	variation: '_ufin',
	definition: { firstYear: 2030, changeDa: '+1 pct.' },
	deviations: {
		qBNP: series(1985, { 2032: -1.16 }),
		nL: series(1985, nL),
		saldo2bnp: series(1985, { 2030: -0.97 })
	}
});

describe('fiveYearLine', () => {
	it('says the effect has faded when at most a fifth is left', () => {
		expect(fiveYearLine(-10942, -129)).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (−130 personer).');
		expect(fiveYearLine(-2176, 108)).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (+110 personer).');
	});

	it('says the effect has grown when it is larger with the same sign', () => {
		expect(fiveYearLine(17427, 30714)).toBe('Efter 5 år er effekten vokset til +30.700 personer.');
	});

	it('states the number otherwise', () => {
		expect(fiveYearLine(3000, 1500)).toBe('Efter 5 år: +1.500 personer i beskæftigelse i forhold til grundforløbet.');
	});

	it('handles a zero first-year effect without dividing', () => {
		expect(fiveYearLine(0, 0)).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (0 personer).');
		expect(fiveYearLine(0, 500)).toBe('Efter 5 år: +500 personer i beskæftigelse i forhold til grundforløbet.');
	});
});

describe('trimScenario', () => {
	it('keeps exactly the three answer series and the definition fields the page uses', () => {
		const trimmed = trimScenario(readScenario('Rente_ufin'));
		expect(Object.keys(trimmed.deviations).sort()).toEqual(['nL', 'qBNP', 'saldo2bnp']);
		expect(Object.keys(trimmed.definition).sort()).toEqual(['changeDa', 'firstYear']);
		expect(JSON.stringify(trimmed).length).toBeLessThan(8000);
	});
});

describe('buildAnswer', () => {
	const question = QUESTIONS[0];
	const levels = { nL: 3000, vBNP: 3000 };

	it('uses the share cards’ tiles', () => {
		const scenario = fake({ 2030: -0.4, 2034: -0.004 });
		const answer = buildAnswer({ question, scenario, yearStart: 1985, levels, nL5: 3000 });
		expect(answer.tiles).toEqual(cardTiles({ scenario, definition: scenario.definition, yearStart: 1985, levels, scale: 1 }));
		expect(answer.href).toBe('/scenarier/Rente_ufin/');
	});

	it('builds the five-year line from employment in the shock year + 4', () => {
		// −0,4 % of 3.000.000 = −12.000 in year 1; −0,004 % of 3.000.000 = −120 in year 5
		const answer = buildAnswer({ question, scenario: fake({ 2030: -0.4, 2034: -0.004 }), yearStart: 1985, levels, nL5: 3000 });
		expect(answer.fiveYear).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (−120 personer).');
	});

	it('leaves the five-year line out when a level is missing', () => {
		const answer = buildAnswer({ question, scenario: fake({ 2030: -0.4 }), yearStart: 1985, levels, nL5: null });
		expect(answer.fiveYear).toBeNull();
	});

	it('charts BNP and employment', () => {
		const answer = buildAnswer({ question, scenario: fake({ 2030: -0.4 }), yearStart: 1985, levels, nL5: 3000 });
		expect(answer.chart.map((s) => [s.key, s.label])).toEqual([['qBNP', 'BNP'], ['nL', 'Beskæftigelse']]);
	});

	it('answers the real default question with the published numbers', () => {
		const baseline = readBaseline();
		const scenario = trimScenario(readScenario('Rente_ufin'));
		const y1 = scenario.definition.firstYear;
		const answer = buildAnswer({
			question, scenario, yearStart: readMeta().yearStart,
			levels: levelsAt(baseline, y1), nL5: levelsAt(baseline, y1 + 4)?.nL ?? null
		});
		expect(answer.tiles.map((t) => t.value)).toEqual(['−10.900', '−1,2', '−1,0']);
		expect(answer.fiveYear).toMatch(/^Efter 5 år er beskæftigelseseffekten næsten væk/);
	});
});

describe('homeHead', () => {
	it('puts the default question and its numbers in the description', () => {
		const answer = buildAnswer({ question: QUESTIONS[0], scenario: fake({ 2030: -0.4 }), yearStart: 1985, levels: { nL: 3000, vBNP: 3000 }, nL5: 3000 });
		const head = homeHead(answer);
		expect(head.title).toBe('MAKROskop – spørg Finansministeriets model, hvad der sker, hvis …');
		expect(head.description).toBe(
			'Hvad sker der, hvis ECB hæver renten med 1 pct.-point? MAKRO: beskæftigelse −12.000 personer i år 1, BNP −1,2 pct. efter 3 år, offentlig saldo −1,0 pct. af BNP i år 1. Seks spørgsmål til Finansministeriets model, besvaret med MAKROskops frie løser.'
		);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && bunx vitest run src/lib/frontpage.test.ts`
Expected: FAIL — `Failed to resolve import "./frontpage"`.

- [ ] **Step 3: Implement `app/src/lib/frontpage.ts`**

```ts
/** The front page: six curated "Hvad sker der, hvis …" questions, each answered by a solved
 *  unfinanced scenario exactly as solved — no scaling, no mirroring. Spec:
 *  docs/superpowers/specs/2026-09-25-front-page-design.md (makroskop-169). */
import { cardTiles, formatPersons, type CardLevels, type CardTile } from './card';
import type { Scenario, ScenarioDefinition } from './data';

export interface Question {
	/** Short form on the chip. */
	chip: string;
	/** The question after "Hvad sker der, hvis …". */
	question: string;
	/** Scenario file stem in static/data/shocks. */
	file: string;
	/** The scenario's definition.changeDa the wording was written against; a test pins it,
	 *  so a re-solve at another size fails instead of shipping a wrong question. */
	solvedAs: string;
}

/** Demand shocks fade within five years as wages adjust; the labour-supply shock keeps
 *  growing — the set is chosen so that contrast shows without prose. Default first. */
export const QUESTIONS: Question[] = [
	{ chip: 'renten stiger', question: 'ECB hæver renten med 1 pct.-point?', file: 'Rente_ufin', solvedAs: '+1 pct.-point (100 basispoint)' },
	{ chip: 'momsen sænkes', question: 'momsen sænkes med 0,5 pct.-point?', file: 'Moms_ned_ufin', solvedAs: '−0,5 pct.-point' },
	{ chip: 'bundskatten hæves', question: 'bundskatten hæves med 1 pct.-point?', file: 'Bundskat_ufin', solvedAs: '+1 pct.-point' },
	{ chip: 'det offentlige forbrug øges', question: 'det offentlige forbrug øges med 1 pct.?', file: 'Offentligt_forbrug_ufin', solvedAs: '+1 pct.' },
	{ chip: 'eksporten vokser', question: 'eksportmarkederne vokser 1 pct.?', file: 'Eksportmarkedsvaekst_ufin', solvedAs: '+1 pct.' },
	{ chip: 'flere vil arbejde', question: '1 pct. flere vil arbejde?', file: 'Arbejdsudbud_beskaeftigelse_ufin', solvedAs: '+1 pct.' }
];

const ANSWER_SERIES = ['qBNP', 'nL', 'saldo2bnp'] as const;

export interface TrimmedScenario {
	shock: string;
	variation: string;
	definition: Pick<ScenarioDefinition, 'firstYear' | 'changeDa'>;
	deviations: Record<string, (number | null)[]>;
}

/** Only what the answer uses: ~3 KB instead of the 54 KB scenario file, times six in the page. */
export function trimScenario(scenario: Scenario): TrimmedScenario {
	const def = scenario.definition;
	if (!def) throw new Error(`${scenario.shock}${scenario.variation}: scenario has no definition`);
	return {
		shock: scenario.shock,
		variation: scenario.variation,
		definition: { firstYear: def.firstYear, changeDa: def.changeDa },
		deviations: Object.fromEntries(ANSWER_SERIES.map((key) => [key, scenario.deviations[key] ?? []]))
	};
}

/** Employment five years on (shock year + 4), in persons, against year 1. */
export function fiveYearLine(y1: number, y5: number): string {
	const persons = `${formatPersons(y5)} personer`;
	if (Math.abs(y5) <= 0.2 * Math.abs(y1)) return `Efter 5 år er beskæftigelseseffekten næsten væk (${persons}).`;
	if (Math.sign(y5) === Math.sign(y1) && Math.abs(y5) > Math.abs(y1)) return `Efter 5 år er effekten vokset til ${persons}.`;
	return `Efter 5 år: ${persons} i beskæftigelse i forhold til grundforløbet.`;
}

export interface Answer {
	question: Question;
	tiles: CardTile[];
	/** null when a deviation or a baseline level is missing */
	fiveYear: string | null;
	chart: { key: string; label: string; values: (number | null)[] }[];
	/** The scenario's own page (share card, full explorer). */
	href: string;
}

export function buildAnswer(input: {
	question: Question;
	scenario: TrimmedScenario;
	yearStart: number;
	/** baseline levels in the shock year */
	levels: CardLevels | null;
	/** baseline employment (thousand persons) in the shock year + 4 */
	nL5: number | null;
}): Answer {
	const { question, scenario, yearStart, levels, nL5 } = input;
	const y1 = scenario.definition.firstYear;
	const nL = scenario.deviations.nL;
	const d1 = nL?.[y1 - yearStart];
	const d5 = nL?.[y1 + 4 - yearStart];
	const fiveYear =
		d1 == null || d5 == null || levels == null || nL5 == null
			? null
			: fiveYearLine((d1 / 100) * levels.nL * 1000, (d5 / 100) * nL5 * 1000);
	return {
		question,
		tiles: cardTiles({ scenario, definition: scenario.definition, yearStart, levels, scale: 1 }),
		fiveYear,
		chart: [
			{ key: 'qBNP', label: 'BNP', values: scenario.deviations.qBNP ?? [] },
			{ key: 'nL', label: 'Beskæftigelse', values: nL ?? [] }
		],
		href: `/scenarier/${question.file}/`
	};
}

export interface PageHead {
	title: string;
	description: string;
}

/** The front page's <title> and description; the description carries the default answer. */
export function homeHead(answer: Answer): PageHead {
	const [persons, bnp, saldo] = answer.tiles;
	const numbers = [
		persons.value == null ? null : `beskæftigelse ${persons.value} personer i år 1`,
		bnp.value == null ? null : `BNP ${bnp.value} pct. efter 3 år`,
		saldo.value == null ? null : `offentlig saldo ${saldo.value} pct. af BNP i år 1`
	].filter(Boolean);
	return {
		title: 'MAKROskop – spørg Finansministeriets model, hvad der sker, hvis …',
		description:
			`Hvad sker der, hvis ${answer.question.question}` +
			(numbers.length ? ` MAKRO: ${numbers.join(', ')}.` : '') +
			' Seks spørgsmål til Finansministeriets model, besvaret med MAKROskops frie løser.'
	};
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && bunx vitest run src/lib/frontpage.test.ts`
Expected: PASS (all). If the real-data test's tile values differ, the published data changed — check with `bd show makroskop-169` notes before editing the expectation.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/frontpage.ts app/src/lib/frontpage.test.ts
git commit -m "Front page: questions and answers module (makroskop-169)

Six curated _ufin questions pinned to the size they were solved at, answers built from the
share cards' tiles plus a five-year employment line and BNP/employment chart series."
```

---

### Task 2: Move the baseline to `/grundforloeb/`; layout head plumbing

**Files:**
- Move: `app/src/routes/+page.svelte` → `app/src/routes/grundforloeb/+page.svelte`
- Move: `app/src/routes/+page.ts` → `app/src/routes/grundforloeb/+page.ts`
- Create (temporary, replaced in Task 3): `app/src/routes/+page.svelte`
- Modify: `app/src/routes/+layout.svelte` (the `links` array, head derivations)

**Interfaces:**
- Consumes: `PageHead` from `$lib/frontpage` (Task 1).
- Produces: the layout honours `page.data.head: PageHead | undefined` — `<title>` and `og:title` = `head.title` verbatim, description = `head.description`. Task 3 returns `head` from the front page's load.

- [ ] **Step 1: Move the baseline page**

```bash
cd app && mkdir -p src/routes/grundforloeb && git mv src/routes/+page.svelte src/routes/grundforloeb/+page.svelte && git mv src/routes/+page.ts src/routes/grundforloeb/+page.ts
```

Temporary `app/src/routes/+page.svelte` so `/` still builds until Task 3:

```svelte
<p><a href="/grundforloeb/">Grundforløb</a> · <a href="/scenarier/">Scenarier</a></p>
```

- [ ] **Step 2: Point the nav at the new route**

In `app/src/routes/+layout.svelte`, in the `links` array change the first entry's `href: '/'` to `href: '/grundforloeb/'` (label and description unchanged — the baseline page keeps today's description).

- [ ] **Step 3: Honour a page-provided head**

In `app/src/routes/+layout.svelte`, add the import next to the `CardHead` import:

```ts
	import type { PageHead } from '$lib/frontpage';
```

and replace the three derivations `description`, `ogTitle`, `title` with:

```ts
	/** The front page passes its own title and description (the default answer's numbers). */
	const head = $derived(page.data.head as PageHead | undefined);
	const description = $derived(card?.description ?? head?.description ?? current?.description ?? SITE_DESCRIPTION);
	const ogTitle = $derived(
		card?.title ?? head?.title ?? (current ? `${current.label} · MAKROskop` : 'MAKROskop – udforsk MAKRO uden licens')
	);
	/** The tab title: the card's headline number, the front page's own, else the page name. Only the layout sets <title>. */
	const title = $derived(card ? `${card.title} · MAKROskop` : head ? head.title : current ? `${current.label} · MAKROskop` : 'MAKROskop');
```

- [ ] **Step 4: Check, build, look**

Run: `cd app && bun run check && bun run build`
Expected: 0 errors; build completes. Then `bun run preview --port 4178` and open `http://localhost:4178/grundforloeb/`: the baseline page as before, nav "Grundforløb" underlined. Stop the preview.

- [ ] **Step 5: Commit**

```bash
git add -A app/src/routes
git commit -m "Grundforløb moves to /grundforloeb/; layout takes a page-provided head (makroskop-169)"
```

---

### Task 3: The front page

**Files:**
- Create: `app/src/routes/+page.server.ts`
- Replace: `app/src/routes/+page.svelte`

**Interfaces:**
- Consumes: `QUESTIONS`, `trimScenario`, `buildAnswer`, `homeHead`, `Answer` (Task 1); `readMeta`, `readBaseline`, `readScenario`, `levelsAt` from `$lib/server/scenarios`; layout `head` plumbing (Task 2); `data.meta` from `+layout.ts`.
- Produces: page data `{ answers: Answer[]; head: PageHead }`.

- [ ] **Step 1: The load**

`app/src/routes/+page.server.ts`:

```ts
/** The front page's six answers, read and trimmed at build time (prerendered): the page ships
 *  ~3 KB per answer instead of six 54 KB scenario files, and switching needs no fetch. A missing
 *  scenario file throws in readScenario, so the build fails instead of shipping a gap. */
import { QUESTIONS, buildAnswer, homeHead, trimScenario } from '$lib/frontpage';
import { levelsAt, readBaseline, readMeta, readScenario } from '$lib/server/scenarios';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const meta = readMeta();
	const baseline = readBaseline();
	const answers = QUESTIONS.map((question) => {
		const scenario = trimScenario(readScenario(question.file));
		const y1 = scenario.definition.firstYear;
		return buildAnswer({
			question,
			scenario,
			yearStart: meta.yearStart,
			levels: levelsAt(baseline, y1),
			nL5: levelsAt(baseline, y1 + 4)?.nL ?? null
		});
	});
	return { answers, head: homeHead(answers[0]) };
};
```

- [ ] **Step 2: The page**

Replace `app/src/routes/+page.svelte` with:

```svelte
<script lang="ts">
	import LineChart from '$lib/components/LineChart.svelte';
	import StatTile from '$lib/components/StatTile.svelte';

	let { data } = $props();

	const meta = $derived(data.meta);
	const years = $derived(Array.from({ length: meta.yearEnd - meta.yearStart + 1 }, (_, i) => meta.yearStart + i));
	let selected = $state(0);
	const answer = $derived(data.answers[selected]);
</script>

<section class="ask">
	<h1>Hvad sker der, hvis&nbsp;…</h1>
	<div class="chip-row" role="group" aria-label="Vælg et spørgsmål">
		{#each data.answers as a, i (a.question.file)}
			<button class="chip" class:active={selected === i} aria-pressed={selected === i} onclick={() => (selected = i)}>
				{a.question.chip}
			</button>
		{/each}
	</div>
</section>

<section class="answer" aria-labelledby="question">
	<div class="sr-only" role="status">Viser: {answer.question.question}</div>
	<h2 id="question">… {answer.question.question}</h2>
	<div class="tiles" role="group" aria-label="Svaret i tre tal">
		{#each answer.tiles as tile (tile.key)}
			<StatTile label={`${tile.label}, år ${tile.year}`} value={tile.value ?? '–'} unit={tile.value == null ? '' : tile.unit} />
		{/each}
	</div>
	{#if answer.fiveYear}
		<p class="five-year">{answer.fiveYear}</p>
	{/if}
	<LineChart
		title="BNP og beskæftigelse"
		unit="afvigelse fra grundforløbet, pct."
		{years}
		series={answer.chart}
		fromYear={meta.defaultShockYear - 1}
		toYear={2045}
		zeroLine
		height={260}
		suffix=" pct."
	/>
	<p class="go">
		<a class="primary" href={answer.href}>Se hele scenariet →</a>
		<a href="/scenarier/">Alle stød</a>
		<a href="/pakke/">Byg en pakke</a>
	</p>
</section>

<section class="trust">
	<p class="lede">
		MAKRO er den model, Finansministeriet regner finanseffekter med. MAKROskop løser den med en fri,
		licensløs løser og efterprøver resultaterne mod DREAMs egne beregninger.
		<a href="/validering/">Sådan er tallene efterprøvet →</a>
	</p>
	<p class="doorway">
		Svarene er afvigelser fra modellens grundforløb — en stiliseret fremskrivning af dansk økonomi til
		{meta.yearEnd}. <a href="/grundforloeb/">Se grundforløbet →</a>
	</p>
</section>

<style>
	.ask h1 {
		margin-bottom: 18px;
	}

	.answer {
		border-top: 1px solid var(--rule-strong);
		margin-top: 28px;
		padding-top: 20px;
	}

	.answer h2 {
		font-family: var(--font-display);
		font-size: 30px;
		margin: 0 0 16px;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		max-width: 760px;
		margin-bottom: 10px;
	}

	.tiles :global(.figure) {
		border-left: 0;
		padding-left: 0;
	}

	.five-year {
		font-family: var(--font-display);
		font-size: 19px;
		color: var(--ink-secondary);
		margin: 0 0 18px;
	}

	.go {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 22px;
		margin: 14px 0 0;
		font-size: 15px;
	}

	.go .primary {
		font-weight: 600;
		color: var(--makro-strong);
	}

	.trust {
		border-top: 1px solid var(--rule-strong);
		margin-top: 36px;
		padding-top: 20px;
		max-width: 72ch;
	}

	.doorway {
		font-size: 14px;
		color: var(--ink-muted);
	}

	@media (max-width: 520px) {
		.tiles {
			grid-template-columns: 1fr;
		}
		.answer h2 {
			font-size: 24px;
		}
	}
</style>
```

- [ ] **Step 3: Check and build**

Run: `cd app && bun run check && bun run test && bun run build`
Expected: 0 errors, all tests pass, build completes (a missing scenario would fail here with `missing data file shocks/…`).

- [ ] **Step 4: Browser pass**

`bun run preview --port 4178` (restart it after every rebuild — sirv caches the old chunk list). With the Playwright MCP at 1400×900, then at 375×812, in light and dark (`emulate` colour scheme):
- `/` shows "… ECB hæver renten med 1 pct.-point?", tiles −10.900 / −1,2 / −1,0, a "næsten væk" line, a two-series chart.
- Click each chip: question, tiles, five-year line and chart change; "flere vil arbejde" reads "vokset til". `aria-pressed` moves; the `role=status` text updates.
- Tab to a chip, press Enter: same, focus stays on the chip.
- "Se hele scenariet →" opens `/scenarier/<file>/` on the same scenario.
- No console errors; no horizontal scroll at 375 px.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/+page.server.ts app/src/routes/+page.svelte
git commit -m "Front page: 'Hvad sker der, hvis …' with six solved answers (makroskop-169)"
```

---

### Task 4: Build verification and close-out

**Files:**
- Modify: `app/scripts/verify-build.ts` (append before the `if (failures.length)` block)

**Interfaces:**
- Consumes: the built `build/index.html` and `build/grundforloeb/index.html`.
- Produces: `bun run verify:build` fails if the front page or the moved baseline regresses.

- [ ] **Step 1: Add the checks**

```ts
const home = readFileSync(join(build, 'index.html'), 'utf8');
check(home.includes('ECB hæver renten med 1 pct.-point?'), 'front page: default question missing');
check(count(home, /class="chip[^"]*"[^>]*aria-pressed/g) === 6, 'front page: expected six question chips');
check(home.includes('<title>MAKROskop – spørg Finansministeriets model, hvad der sker, hvis …</title>'), 'front page: <title> is not its own');
check(/content="Hvad sker der, hvis ECB hæver renten[^"]*beskæftigelse −/.test(home), 'front page: description lacks the default answer');
check(home.includes('href="/grundforloeb/"'), 'front page: no doorway to the baseline');
check(home.includes('href="/scenarier/Rente_ufin/"'), 'front page: default answer does not link to its scenario page');

const grund = readFileSync(join(build, 'grundforloeb', 'index.html'), 'utf8');
check(grund.includes('Dansk økonomi, beregnet et århundrede frem'), '/grundforloeb/: baseline heading missing');
check(grund.includes('<title>Grundforløb · MAKROskop</title>'), '/grundforloeb/: <title> is not the page name');
check(grund.includes('MAKROs grundforløb for dansk økonomi'), '/grundforloeb/: lost the baseline description');
```

- [ ] **Step 2: Run it**

Run: `cd app && bun run build && bun run verify:build`
Expected: `verify-build: 932 views, pages and images present, tags correct`. If the chip regex miscounts (attribute order in the built HTML), inspect `grep -o '<button class="chip[^>]*>' build/index.html` and adjust the pattern, not the page.

- [ ] **Step 3: Commit and close**

```bash
git add app/scripts/verify-build.ts
git commit -m "verify-build: front page and /grundforloeb/ (makroskop-169)"
bd close makroskop-169 --reason="Front page answers six curated as-solved questions; baseline at /grundforloeb/; verify-build covers both."
```

Do not push: pushing `main` redeploys the public site — report and let the user decide.
