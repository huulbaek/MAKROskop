<script lang="ts">
	import LineChart from '$lib/components/LineChart.svelte';
	import MechanismMap from '$lib/components/MechanismMap.svelte';
	import YearScrubber from '$lib/components/YearScrubber.svelte';
	import { pathOf } from '$lib/mechanism';
	import StatTile from '$lib/components/StatTile.svelte';
	import { formatSigned } from '$lib/format';
	import { ALL_SCALE_STEPS, cardSubject, cardTiles, changeText, formatScale, scaleSteps as stepsFor } from '$lib/card';
	import type { CardTile } from '$lib/card';
	import { buildAnswerSentence, type AnswerSentence } from '$lib/answer';
	import { compareFilenameVariant, financingLine, partnerVariation } from '$lib/compare';
	import { defaultVariation, loadBaseline, loadScenario, type Baseline, type Meta, type Scenario, type ShockMeta } from '$lib/data';
	import { RECOMPUTING } from '$lib/notices';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick, untrack } from 'svelte';
	import {
		downloadBlob, exportFilename, permalink, provenanceLine, scenarioCsv, svgToPngBlob
	} from '$lib/export';

	let {
		meta,
		initialScenario,
		initial = null,
		initialTiles = null,
		initialAnswer = null,
		baseline = null
	}: {
		meta: Meta;
		/** A scenario loaded ahead of time (the bare /scenarier/ page prerenders its default view). */
		initialScenario: Scenario | null;
		/** Preselected view (the prerendered /scenarier/<view>/ pages); otherwise the ?stod= query. */
		initial?: { name: string; variation: string; scale: number } | null;
		/** The view's tiles as prerendered, shown until the scenario JSON has loaded. */
		initialTiles?: CardTile[] | null;
		/** The view's answer sentence as prerendered, shown until the scenario and levels have loaded. */
		initialAnswer?: AnswerSentence | null;
		/** Baseline levels for the persons tile when the page loaded them already (prerendered). */
		baseline?: Baseline | null;
	} = $props();

	/** Prerendered pages seed from `initial` (view pages) or `initialScenario` (the bare page),
	 *  so the built HTML shows the right shock, variant, scale and loading state before
	 *  hydration — not the pending markup. Seeded once (untrack: the initial value is the
	 *  point; later changes come through select()). */
	let selectedName = $state(untrack(() => initial?.name ?? initialScenario?.shock ?? ''));
	let selectedVariation = $state(untrack(() => initial?.variation ?? initialScenario?.variation ?? ''));
	let override: Scenario | null | 'unset' = $state.raw('unset');
	let loading = $state(untrack(() => !!initial && !initialScenario));
	/** Baseline nL/vBNP by year (persons tile): from the page when prerendered, else fetched after mount. */
	let levelsByYear = $state.raw(untrack(() => (baseline ? levelsOf(baseline) : {})));

	function levelsOf(b: Baseline): Record<number, { nL: number | null; vBNP: number | null }> {
		return Object.fromEntries(
			b.years.map((year, i) => [year, { nL: b.series.nL?.[i] ?? null, vBNP: b.series.vBNP?.[i] ?? null }])
		);
	}
	const scenario = $derived(override === 'unset' ? initialScenario : override);

	/** Client-side linear rescaling of a solved scenario (1 = as solved).
	 *  Negative steps mirror the shock: the catalog only holds increases, so a cut is
	 *  shown by flipping the deviations. That is a first-order extrapolation to the other
	 *  side of the baseline — no worse than the ×2 we already allow, but it is labelled. */
	const UNSCALED = 1;
	const scaleSteps = $derived(stepsFor(scenario?.definition?.maxScale));
	// Seeded once from the prerendered view (untrack: the initial value is the point; later
	// changes come through select()).
	let scaleIdx = $state(untrack(() => ALL_SCALE_STEPS.indexOf(initial?.scale ?? UNSCALED)));
	/** scaleIdx indexes scaleSteps, which shrinks when a scenario carries a cap. */
	const boundedIdx = $derived(
		scaleIdx >= 0 && scaleIdx < scaleSteps.length ? scaleIdx : scaleSteps.indexOf(UNSCALED)
	);
	const scale = $derived(scaleSteps[boundedIdx]);
	const mirrored = $derived(scale < 0);

	const selectedShock = $derived(
		meta.shocks.find((s) => s.name === selectedName) ??
			({ name: selectedName, labelDa: selectedName, labelEn: selectedName, group: '', available: [] } satisfies ShockMeta)
	);

	/** Compare mode (makroskop-q43): the other permanent variant on every chart. `compare` is
	 *  the reader's wish and survives shock changes; `comparing` is true once both runs are here. */
	let compare = $state(false);
	let partner = $state.raw<Scenario | null>(null);
	const partnerVar = $derived(partnerVariation(selectedVariation));
	const canCompare = $derived(
		!!partnerVar && selectedShock.available.includes(partnerVar) && selectedShock.available.includes(selectedVariation)
	);
	const comparing = $derived(
		compare && canCompare && !!scenario && partner?.shock === selectedName && partner.variation === partnerVar
	);
	/** The two runs by closure, whichever of them is selected. */
	const runs = $derived(
		comparing
			? selectedVariation === '_ufin'
				? { ufin: scenario!, perm: partner! }
				: { ufin: partner!, perm: scenario! }
			: null
	);

	$effect(() => {
		if (!compare || !canCompare || !partnerVar) return;
		const name = selectedName;
		const variation = partnerVar;
		if (untrack(() => partner?.shock === name && partner.variation === variation)) return;
		let stale = false;
		void loadScenario(fetch, `${name}${variation}`).then((loaded) => {
			if (!stale) partner = loaded;
		});
		return () => {
			stale = true;
		};
	});

	const shockGroups = $derived.by(() => {
		const groups = new Map<string, ShockMeta[]>();
		for (const shock of meta.shocks) {
			const list = groups.get(shock.group) ?? [];
			list.push(shock);
			groups.set(shock.group, list);
		}
		return groups;
	});

	async function select(name: string, variation: string) {
		if (name !== selectedName) {
			// another shock is another story: it starts again at the shock year
			year = meta.defaultShockYear;
			scrubbed = false;
			playing = false;
		}
		selectedName = name;
		selectedVariation = variation;
		scaleIdx = ALL_SCALE_STEPS.indexOf(UNSCALED);
		const shock = meta.shocks.find((s) => s.name === name);
		if (!shock || !shock.available.includes(variation)) {
			override = null;
			return;
		}
		loading = true;
		override = await loadScenario(fetch, `${name}${variation}`);
		loading = false;
	}

	/** Which view to open: the prerendered page's own, else the ?stod=&variant=&skala= query
	 *  (used by the Validering page and by old links). */
	function wantedView(): { name: string; variation: string; scale: number } | null {
		if (initial) return initial;
		const name = page.url.searchParams.get('stod');
		if (!name) return null;
		const variant = page.url.searchParams.get('variant') ?? '';
		const skala = Number(page.url.searchParams.get('skala'));
		return { name, variation: variant, scale: Number.isFinite(skala) && skala !== 0 ? skala : 1 };
	}

	/** replaceState throws until SvelteKit's router is up, which is after hydration. */
	let hydrated = $state(false);

	onMount(() => {
		void tick().then(() => (hydrated = true));
		const query = new URLSearchParams(location.search);
		compare = query.has('sammenlign');
		const aar = Number(query.get('aar'));
		// Baseline levels for the persons tile (55 KB, browser-cached); every solved scenario needs them.
		if (!baseline) void loadBaseline(fetch).then((b) => (levelsByYear = levelsOf(b)));
		const wanted = wantedView();
		const shock = wanted ? meta.shocks.find((s) => s.name === wanted.name) : undefined;
		if (!wanted || !shock) return;
		const variation = shock.available.includes(wanted.variation)
			? wanted.variation
			: (defaultVariation(shock) ?? meta.variations[1]?.suffix ?? '_midl');
		void select(shock.name, variation).then(() => {
			if (scaleSteps.includes(wanted.scale)) scaleIdx = scaleSteps.indexOf(wanted.scale);
			if (Number.isInteger(aar) && aar >= yearMin && aar <= toYear) pickYear(aar);
		});
	});

	const chartKeys = [
		'qBNP', 'nL', 'ledighedsgrad',
		'qC', 'qX', 'qM',
		'qI', 'vhW', 'pC',
		'pBolig', 'saldo2bnp', 'primsaldo2bnp'
	];

	const charts = $derived.by(() => {
		if (!scenario) return [];
		const bySeriesKey = new Map(meta.series.map((s) => [s.key, s]));
		const scaled = (run: Scenario, key: string) =>
			scale === 1 ? (run.deviations[key] ?? []) : (run.deviations[key] ?? []).map((v) => (v == null ? null : v * scale));
		// The shocked instrument itself leads, so the cause is visible next to the effects. In compare
		// mode the closure tax closes the list: it is the only instrument the two runs differ in.
		const instrument = scenario.definition?.seriesKey;
		const base = instrument && !chartKeys.includes(instrument) ? [instrument, ...chartKeys] : chartKeys;
		const keys = runs ? [...base, 'tLukning'] : base;
		return keys
			.filter((key) => scenario!.deviations[key]?.some((v) => v != null))
			.map((key) => {
				const info = bySeriesKey.get(key);
				const pct = info?.devMode === 'pct';
				const title = info?.labelDa ?? key;
				const values = scaled(scenario!, key);
				// The instrument moves identically in both runs: one line says that best.
				const series =
					runs && key !== instrument
						? [
								{ key: 'ufin', label: 'Ufinansieret', values: scaled(runs.ufin, key) },
								{ key: 'perm', label: 'Finansieret', values: scaled(runs.perm, key) }
							]
						: [{ key, label: title, values }];
				return {
					key,
					title,
					isInstrument: key === instrument,
					unit: pct ? 'afvigelse fra grundforløb, pct.' : 'afvigelse, pct.-point',
					suffix: pct ? ' pct.' : ' pct.-point',
					values,
					series
				};
			});
	});

	/** The one line under the compare toggle: what the financing does, scaled with the slider. */
	const comparisonLine = $derived(
		runs && scenario?.definition
			? financingLine({ ...runs, yearStart: meta.yearStart, firstYear: scenario.definition.firstYear, scale })
			: null
	);
	const exportVariant = $derived(comparing ? compareFilenameVariant : selectedVariation);

	/** The shock size implied by the slider, in the instrument's own units. */
	const scaledChange = $derived.by(() => {
		const def = scenario?.definition;
		if (!def) return '';
		return changeText(def, scale);
	});

	/** True when the scenario was solved on a different MAKRO version than the baseline shown. */
	const versionMismatch = $derived.by(() => {
		const version = scenario?.modelVersion;
		if (!version) return false;
		if (meta.model.fingerprint && version.fingerprint) return version.fingerprint !== meta.model.fingerprint;
		return version.commit !== meta.model.commit;
	});

	const fromYear = $derived(meta.defaultShockYear - 1);
	const toYear = 2060;

	// ------------------------------------------------------------------------------------
	// The shared year (makroskop-hkt): the scrubber drives the mechanism map, a marker on every
	// chart and — once the reader has scrubbed — the key-figure tiles. Hovering a chart previews
	// a year; a click, tap or arrow key commits it.
	let year = $state(untrack(() => meta.defaultShockYear));
	let playing = $state(false);
	/** Until the reader moves the year, the tiles keep the share card's years and the URL has no ?aar. */
	let scrubbed = $state(false);
	let previewYear = $state<number | null>(null);
	const shownYear = $derived(previewYear ?? year);
	const yearMin = $derived(scenario?.definition?.firstYear ?? meta.defaultShockYear);

	/** The charts start the year before the shock; the scrubber starts at the shock. */
	const clampYear = (y: number) => Math.min(toYear, Math.max(yearMin, y));

	function pickYear(y: number) {
		year = clampYear(y);
		scrubbed = true;
		playing = false;
	}

	const devModes = $derived(Object.fromEntries(meta.series.map((s) => [s.key, s.devMode])));
	const mechanismPath = $derived(pathOf(scenario?.definition?.channel ?? [], scenario?.variation ?? ''));
	const years = $derived(Array.from({ length: meta.yearEnd - meta.yearStart + 1 }, (_, i) => meta.yearStart + i));

	// ------------------------------------------------------------------------------------
	// Sharing: every solved view is a permalink, and every export carries the source stamp.
	const shareable = $derived(!!scenario);
	const closureLabel = $derived(
		comparing
			? 'Permanent, finansieret og ufinansieret'
			: (meta.variations.find((v) => v.suffix === selectedVariation)?.labelDa ?? 'Ufinansieret')
	);
	const shareUrl = $derived(
		shareable
			? permalink(page.url.origin, {
					stod: selectedName, variant: selectedVariation, skala: scale, sammenlign: compare && canCompare, aar: scrubbed ? year : null
				})
			: ''
	);
	const provenance = $derived(
		provenanceLine({
			model: scenario?.modelVersion?.name ?? meta.model.name,
			commit: scenario?.modelVersion?.commit ?? meta.model.commit ?? '',
			// the data vintage is only known for the site's own model version
			dataBasis: !scenario?.modelVersion || scenario.modelVersion.name === meta.model.name ? meta.model.dataBasisDa : undefined,
			closure: closureLabel,
			date: __BUILD_DATE__
		})
	);
	/** The scenario in one line, as it appears on exports. */
	const scenarioLine = $derived.by(() => {
		const def = scenario?.definition;
		if (!def) return selectedShock.labelDa;
		const scaled = scale !== 1 ? ` · ×${formatScale(scale)} ${mirrored ? 'spejlet' : 'lineær tilnærmelse'}` : '';
		return `${selectedShock.labelDa}: ${def.changeDa} fra ${def.firstYear}, ${closureLabel.toLowerCase()}${scaled}`;
	});

	/** The three headline figures, the same function the share cards use; the prerendered
	 *  values bridge the gap until the scenario JSON has loaded. */
	const tiles = $derived.by((): CardTile[] | null => {
		if (scenario && shareable && scenario.definition) {
			const tileYear = scrubbed ? year : null;
			const at = levelsByYear[tileYear ?? scenario.definition.firstYear];
			const levels = at && at.nL != null && at.vBNP != null ? { nL: at.nL, vBNP: at.vBNP } : null;
			return cardTiles({ scenario, definition: scenario.definition, yearStart: meta.yearStart, levels, scale, year: tileYear });
		}
		return loading ? initialTiles : null;
	});

	/** The view's answer in plain Danish (persons and kroner), rescaled with the slider; the
	 *  prerendered sentence bridges the gap until the scenario JSON and the baseline levels load. */
	const answer = $derived.by((): AnswerSentence | null => {
		const def = scenario?.definition;
		if (scenario && def && levelsByYear[def.firstYear]) {
			return buildAnswerSentence({
				subject: cardSubject(selectedShock, def), definition: def, variation: scenario.variation, scenario,
				yearStart: meta.yearStart, scale,
				levelsAt: (year) => {
					const at = levelsByYear[year];
					return at && at.nL != null && at.vBNP != null ? { nL: at.nL, vBNP: at.vBNP } : null;
				}
			});
		}
		const seededView = !!initial && selectedName === initial.name && selectedVariation === initial.variation && scale === initial.scale;
		return seededView ? initialAnswer : null;
	});

	/** The bare page's prerendered default view stays at /scenarier/ until the reader changes something. */
	const seededUrl = untrack(() => (initialScenario && !initial ? shareUrl : ''));

	// Keep the address bar in sync, so the URL a reader copies reproduces the view.
	$effect(() => {
		if (!shareable || loading || !hydrated) return;
		if (shareUrl === seededUrl && location.pathname === resolve('/scenarier/') && !location.search) return;
		const url = new URL(shareUrl);
		if (url.pathname + url.search !== location.pathname + location.search) replaceState(url, {});
	});

	let chartSvgs: Record<string, SVGSVGElement | undefined> = $state({});
	/** Phones only: the catalog folds behind a toggle so the answer comes first (CSS shows it open on wide screens). */
	let catalogOpen = $state(false);
	let copied = $state(false);
	let exporting: string | null = $state(null);

	/** What the page is showing, for a polite live region: the visual cues (dimmed grid,
	 *  swapped heading) say nothing to a screen reader. */
	const statusText = $derived.by(() => {
		if (loading) return 'Henter scenariet …';
		if (!scenario) return `${selectedShock.labelDa}: endnu ikke beregnet.`;
		return `Viser ${selectedShock.labelDa}, ${closureLabel.toLowerCase()}.`;
	});

	async function copyLink() {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function downloadCsv() {
		const csv = scenarioCsv({
			years,
			columns: charts.flatMap((c) =>
				c.series.map((s) => ({
					key: c.series.length > 1 ? `${c.key}_${s.key}` : c.key,
					label: c.series.length > 1 ? `${c.title}, ${s.label.toLowerCase()}` : c.title,
					unit: c.suffix.trim(),
					values: s.values
				}))
			),
			provenance: [
				scenarioLine,
				'Afvigelser fra grundforløbet: pct. for mængder og priser, pct.-point for satser og saldi',
				provenance,
				`Kilde: ${shareUrl}`
			]
		});
		// BOM so Excel reads the Danish characters and the decimal commas correctly.
		downloadBlob(
			new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
			exportFilename({ stod: selectedName, variant: exportVariant, key: null, skala: scale, ext: 'csv' })
		);
	}

	async function downloadPng(chart: (typeof charts)[number]) {
		const svg = chartSvgs[chart.key];
		if (!svg) return;
		exporting = chart.key;
		try {
			const theme = getComputedStyle(document.documentElement);
			const cssVar = (name: string) => theme.getPropertyValue(name).trim();
			const blob = await svgToPngBlob(svg, {
				header: [`${chart.title} — ${chart.unit}`, scenarioLine],
				footer: [provenance, shareUrl],
				colors: { background: cssVar('--surface'), ink: cssVar('--ink'), muted: cssVar('--ink-muted') },
				fonts: { display: cssVar('--font-display'), body: cssVar('--font-body') }
			});
			downloadBlob(
				blob,
				exportFilename({ stod: selectedName, variant: exportVariant, key: chart.key, skala: scale, ext: 'png' })
			);
		} finally {
			exporting = null;
		}
	}
</script>

{#snippet keyFigures(list: CardTile[])}
	<div class="key-figures" role="group" aria-label="Nøgletal">
		{#each list as tile (tile.key)}
			<StatTile label={`${tile.label}, år ${tile.year}`} value={tile.value ?? '–'} unit={tile.value == null ? '' : tile.unit} />
		{/each}
	</div>
{/snippet}

<section class="intro">
	<h1>Hvad sker der, hvis&nbsp;…?</h1>
	<p class="lede">
		MAKRO leveres med et katalog af standardstød: veldefinerede politik-eksperimenter, der viser modellens
		svar på fx højere offentligt forbrug eller lavere bundskat. Alle kurver er <em>afvigelser fra
		grundforløbet</em> – ikke niveauer.
	</p>
</section>

<div class="workbench">
	<aside aria-label="Stødkatalog" class:open={catalogOpen}>
		<button class="catalog-toggle" aria-expanded={catalogOpen} aria-controls="catalog-list" onclick={() => (catalogOpen = !catalogOpen)}>
			<span class="catalog-toggle-key">Stød</span>
			<span class="catalog-toggle-value">{selectedShock.labelDa}</span>
			<span class="catalog-toggle-action">{catalogOpen ? 'Luk' : 'Skift'}</span>
		</button>
		<div class="catalog-list" id="catalog-list">
			{#each [...shockGroups] as [group, shocks] (group)}
				<h2>{group}</h2>
				{#each shocks as shock (shock.name)}
					{@const pending = shock.available.length === 0}
					<button
						class="shock"
						class:selected={selectedName === shock.name}
						class:pending={pending}
						aria-pressed={selectedName === shock.name}
						title={pending ? 'Afventer modelkørsel' : undefined}
						onclick={() => {
							catalogOpen = false;
							select(shock.name, defaultVariation(shock) ?? meta.variations[1]?.suffix ?? '_midl');
						}}
					>
						{shock.labelDa}{#if pending}<span class="sr-only"> – afventer modelkørsel</span>{/if}
					</button>
				{/each}
			{/each}
		</div>
	</aside>

	<div class="detail">
		<div class="sr-only" role="status">{statusText}</div>
		<div class="sr-only" role="status">{copied ? 'Link kopieret til udklipsholderen.' : ''}</div>
		<div class="sr-only" role="status">{exporting ? 'Laver PNG …' : ''}</div>
		<div class="detail-head">
			<h2>{selectedShock.labelDa}</h2>
			<div class="chip-row" role="group" aria-label="Variant">
				{#each meta.variations as variation (variation.suffix)}
					<button
						class="chip"
						class:active={selectedVariation === variation.suffix}
						aria-pressed={selectedVariation === variation.suffix}
						disabled={!selectedShock.available.includes(variation.suffix)}
						onclick={() => select(selectedName, variation.suffix)}
					>
						{variation.labelDa}
					</button>
				{/each}
			</div>
		</div>
		{#if RECOMPUTING[selectedName]}
			<div class="banner warn" role="note"><strong>Genberegnes.</strong> {RECOMPUTING[selectedName]}</div>
		{/if}
		{#if answer}
			<p class="answer"><strong>{answer.lead}</strong> {answer.body}</p>
		{/if}
		{#if scenario?.definition?.explainerDa}
			<p class="explainer">{scenario.definition.explainerDa}</p>
		{/if}

		{#if scenario?.definition && mechanismPath.nodes.length > 0}
			<!-- A direct child of .detail, so it stays on screen down through the charts. -->
			<div class="year-bar">
				<YearScrubber bind:year bind:playing min={yearMin} max={toYear} onscrub={() => (scrubbed = true)} />
			</div>
			<MechanismMap
				shockLabel={`${cardSubject(selectedShock, scenario.definition)} ${scaledChange}`}
				path={mechanismPath}
				deviations={scenario.deviations}
				{devModes}
				year={shownYear}
				yearStart={meta.yearStart}
				firstYear={yearMin}
				lastYear={toYear}
				{scale}
				financed={scenario.variation === '_perm'}
			/>
		{/if}

		{#if scenario?.definition}
			{@const def = scenario.definition}
			<section class="card definition" aria-label="Stødets definition">
				<h3>Sådan er stødet defineret</h3>
				<dl>
					<div>
						<dt>Instrument</dt>
						<dd><code class="mono">{def.instrument}</code> — {def.instrumentDa}</dd>
					</div>
					<div>
						<dt>Ændring</dt>
						<dd><strong>{def.changeDa}</strong> i forhold til grundforløbet, hvert år fra {def.firstYear}</dd>
					</div>
					<div>
						<dt>Profil</dt>
						<dd>{def.profileDa} Modellen løses frem til {def.lastYear}.</dd>
					</div>
					<div>
						<dt>Finansiering</dt>
						<dd>{def.closureDa}</dd>
					</div>
					<div>
						<dt>Beregnet med</dt>
						<dd>{def.solver} — <a href="/validering/">se valideringen</a></dd>
					</div>
					{#if scenario.modelVersion}
						<div>
							<dt>Modelversion</dt>
							<dd>
								{scenario.modelVersion.name}
								<code class="mono">{scenario.modelVersion.commit || scenario.modelVersion.fingerprint}</code>
								{#if scenario.modelVersion.source === 'assumed'}
									<span class="muted">(antaget — resultatfilen bærer intet versionsstempel)</span>
								{/if}
							</dd>
						</div>
					{/if}
				</dl>
				<p class="dream-note">{def.dreamDa}</p>
				<div class="scaler">
					<label for="scale">Prøv en anden størrelse</label>
					<input
						id="scale"
						type="range"
						min="0"
						max={scaleSteps.length - 1}
						step="1"
						bind:value={scaleIdx}
						aria-valuetext={`${formatScale(scale)} gange stødet${mirrored ? ' — spejlet, altså en lempelse' : ''}`}
					/>
					<output for="scale" class="scale-readout">
						<span class="scale-value"><strong>×{formatScale(scale)}</strong> = {scaledChange}</span>
						<!-- Always rendered: the badge sits next to the slider, so popping it in and out
						     would resize the track mid-drag. -->
						<span class="approx" class:blank={scale === 1} class:mirror={mirrored}>
							{mirrored ? 'spejlet' : 'lineær tilnærmelse'}
						</span>
					</output>
					<p class="scale-note">
						Kurverne skaleres i browseren — det er <em>ikke</em> en ny modelkørsel. Modellen er
						tæt på lineær for stød af denne størrelse, men ikke helt: {def.linearityDa}
					</p>
					{#if mirrored}
						<p class="scale-note mirror-note">
							<strong>Negativ skala spejler stødet.</strong> Kataloget indeholder kun forhøjelser,
							så en lempelse vises ved at vende fortegnet på afvigelserne. Det er en lineær
							tilnærmelse på den anden side af grundforløbet — retningen er rigtig, men størrelsen
							er ikke løst i modellen. En rigtig nedsættelse kræver en ny modelkørsel.
						</p>
					{/if}
					{#if def.maxScaleDa}
						<p class="scale-note">{def.maxScaleDa}</p>
					{/if}
				</div>
			</section>
		{/if}

		{#if scenario && versionMismatch}
			<div class="banner warn" role="alert">
				<strong>Versionsforskel.</strong> Scenariet er løst på
				{scenario.modelVersion?.name} ({scenario.modelVersion?.commit || scenario.modelVersion?.fingerprint}),
				men grundforløbet her er {meta.model.name} ({meta.model.commit}). Afvigelserne gælder den ældre
				version og bør genberegnes, før de sammenlignes med grundforløbet.
			</div>
		{/if}

		{#if scenario}
			{#if tiles}
				{@render keyFigures(tiles)}
			{/if}
			{#if scenario.hbi != null}
				<div class="hbi-row">
					<StatTile
						label="Holdbarhedsindikator (HBI) i scenariet"
						value={formatSigned(scenario.hbi * 100)}
						unit="pct. af BNP"
						tone={scenario.hbi >= 0 ? 'good' : 'bad'}
					/>
				</div>
			{/if}
			{#if shareable}
				<div class="share-row" role="group" aria-label="Del og hent">
					<button class="chip" onclick={copyLink}>{copied ? 'Link kopieret ✓' : 'Kopiér link'}</button>
					<button class="chip" onclick={downloadCsv}>Hent tal (CSV)</button>
					{#if selectedVariation === '_perm' || selectedVariation === '_ufin'}
						<a class="chip" href={`${resolve('/pakke/')}?${selectedName}=${scale}&variant=${selectedVariation}`}>Læg i en pakke →</a>
					{/if}
					<span class="share-hint">Linket gengiver præcis denne visning; hver graf kan hentes som PNG med kildeangivelse.</span>
				</div>
			{/if}
			{#if canCompare}
				<div class="compare">
					<button class="chip" class:active={compare} aria-pressed={compare} onclick={() => (compare = !compare)}>
						Vis både finansieret og ufinansieret
					</button>
					{#if comparisonLine}
						<p class="compare-line">{comparisonLine}</p>
					{:else if compare}
						<p class="compare-line muted">Henter den anden variant …</p>
					{/if}
				</div>
			{/if}
			<div class="chart-grid" style:opacity={loading ? 0.5 : 1}>
				{#each charts as chart (chart.key)}
					<div class="cell" class:instrument={chart.isInstrument}>
						{#if chart.isInstrument}<span class="badge accent">Stødet (input)</span>{/if}
						{#if scale !== 1 && !chart.isInstrument}<span class="badge warm">×{formatScale(scale)} {mirrored ? 'spejlet' : 'tilnærmet'}</span>{/if}
						<LineChart
							title={chart.title}
							code={chart.key}
							unit={chart.unit}
							{years}
							series={chart.series}
							fromYear={fromYear}
							toYear={toYear}
							zeroLine
							height={200}
							suffix={chart.suffix}
							markerYear={mechanismPath.nodes.length > 0 ? shownYear : null}
							onhover={(y) => (previewYear = y == null ? null : clampYear(y))}
							onpick={pickYear}
							bind:svg={chartSvgs[chart.key]}
						/>
						{#if shareable}
							<div class="card-tools">
								<button class="png-btn" onclick={() => downloadPng(chart)} disabled={exporting === chart.key}>
									{exporting === chart.key ? 'Henter …' : 'Hent PNG'}
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{#if shareable}
				<p class="kilde">Kilde: {provenance} · <a href={shareUrl}>{shareUrl}</a></p>
			{/if}
		{:else if loading}
			<div class="card loading-card">
				{#if tiles}
					{@render keyFigures(tiles)}
				{/if}
				<p>Henter scenariet …</p>
			</div>
		{:else}
			<div class="pending card">
				<h3>Endnu ikke beregnet</h3>
				<p>
					Dette stød er defineret i MAKROs standardkatalog
					(<code>Analysis/Standard_shocks/standard_shocks.gms</code>), men er ikke løst i MAKROskop
					endnu. Hvert scenarie er én kørsel med den frie løser over hele modellens horisont — det
					kræver en maskine med ca. 64 GB hukommelse og tager nogle timer.
				</p>
				<p>
					Når resultatfilen (fx <code class="mono">{selectedName}_ufin.gdx</code>) lægges i
					<code>etl/shock_gdx/</code> og <code>extract.py</code> køres igen, dukker kurverne op her
					automatisk — sammen med stødets definition.
				</p>
			</div>
		{/if}

		<div class="method">
			<h2>Sådan skal kurverne læses</h2>
			<p>
				Kurverne viser forskellen mellem scenariet og grundforløbet – i procent for mængder og priser, i
				procentpoint for satser og saldi. Stødet lægges ind i {meta.defaultShockYear}; den nøjagtige
				størrelse og hvad der ændres, står i boksen "Sådan er stødet defineret" for hvert beregnet
				scenarie. Varianterne følger MAKROs standardprofiler: et enkelt år, midlertidigt aftrappet
				(AR-profil), permanent finansieret (den beregningstekniske lukkeskat reagerer, som i DREAMs
				egne beregninger) og permanent ufinansieret. De midlertidige varianter er indtil videre
				ufinansierede.
			</p>
		</div>
	</div>
</div>

<style>
	.detail-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 14px;
	}

	.detail-head h2 {
		font-size: 30px;
	}

	.compare {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 10px 16px;
		margin: 0 0 16px;
	}

	.compare-line {
		flex: 1 1 32ch;
		margin: 0;
		font-size: 15px;
		line-height: 1.5;
		color: var(--ink-secondary);
		max-width: 72ch;
	}

	.year-bar {
		position: sticky;
		top: 0;
		z-index: 5;
		margin: 0 -12px 12px;
		padding: 8px 12px;
		background: var(--page);
		border-bottom: 1px solid var(--rule);
	}

	.answer {
		font-size: 18px;
		line-height: 1.5;
		color: var(--ink);
		max-width: 66ch;
		margin: 0 0 14px;
	}

	.explainer {
		font-family: var(--font-display);
		font-size: 19px;
		line-height: 1.45;
		color: var(--ink-secondary);
		max-width: 62ch;
		margin: 0 0 20px;
	}

	.definition {
		margin-bottom: 18px;
		border-left: 3px solid var(--makro);
	}

	.definition h3 {
		font-size: 20px;
		margin-bottom: 10px;
	}

	.definition dl {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px 18px;
		font-size: 13.5px;
	}

	.definition dl > div {
		display: contents;
	}

	.definition dt {
		color: var(--ink-muted);
		font-size: 12px;
		padding-top: 2px;
	}

	.definition dd {
		margin: 0;
		color: var(--ink-secondary);
	}

	.definition dd strong {
		color: var(--ink);
	}

	.definition code {
		color: var(--makro-strong);
	}

	.definition .muted {
		color: var(--ink-muted);
		font-size: 12px;
	}

	.dream-note {
		font-size: 12.5px;
		color: var(--ink-muted);
		margin: 12px 0 0;
		max-width: 80ch;
	}

	.scaler {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid var(--rule);
		display: grid;
		/* Both flexible columns are content-independent on purpose: with a max-content
		   readout the track resized as the readout text changed, and a track that
		   changes width mid-drag makes the thumb slide out from under the pointer. */
		grid-template-columns: max-content minmax(0, 1fr) minmax(0, 1fr);
		gap: 4px 14px;
		align-items: center;
		font-size: 13px;
	}

	.scaler label {
		color: var(--ink-secondary);
	}

	.scaler input[type='range'] {
		width: 100%;
		/* a finger-sized hit area; the track itself stays thin */
		height: 32px;
		margin: 0;
		accent-color: var(--makro);
	}

	.scale-readout {
		font-variant-numeric: tabular-nums;
	}

	.scale-readout .scale-value {
		white-space: nowrap;
	}

	.scale-readout .approx {
		margin-left: 6px;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--warm-text);
	}

	.scale-readout .approx.blank {
		visibility: hidden;
	}

	.scale-readout .approx.mirror {
		color: var(--bad);
	}

	.mirror-note {
		color: var(--ink-secondary);
	}

	.mirror-note strong {
		color: var(--bad);
	}

	.scale-note {
		grid-column: 1 / -1;
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--ink-muted);
		max-width: 80ch;
	}

	.hbi-row {
		max-width: 320px;
		margin-bottom: 18px;
		border-top: 1px solid var(--rule-strong);
		padding-top: 12px;
	}

	.hbi-row :global(.figure) {
		border-left: 0;
		padding-left: 0;
	}

	.cell.instrument {
		border-top: 3px solid var(--makro);
	}

	/* keep the caption clear of a badge */
	.cell.instrument :global(figcaption) {
		padding-right: 110px;
	}

	.pending h3 {
		margin-bottom: 8px;
	}

	.pending p {
		color: var(--ink-secondary);
		font-size: 14px;
		margin: 0 0 8px;
	}

	.key-figures {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		max-width: 720px;
		margin-bottom: 18px;
		border-top: 1px solid var(--rule-strong);
		padding-top: 12px;
	}

	.key-figures :global(.figure) {
		border-left: 0;
		padding-left: 0;
	}

	.loading-card p {
		color: var(--ink-muted);
		font-size: 14px;
		margin: 0;
	}

	@media (max-width: 520px) {
		.key-figures {
			grid-template-columns: 1fr;
			gap: 0;
		}
		.key-figures :global(.figure) {
			border-right: 0;
			padding: 12px 0;
		}
		.key-figures :global(.figure + .figure) {
			border-top: 1px solid var(--rule);
		}
	}

	@media (max-width: 520px) {
		.definition dl {
			grid-template-columns: 1fr;
			gap: 2px;
		}
		.definition dt {
			margin-top: 6px;
		}
		.scaler {
			grid-template-columns: 1fr;
		}
	}
</style>
