<script lang="ts">
	/** One live chart for an iframe in a newsroom article (makroskop-64y): headline, chart, source
	 *  line and a link back. Reads ?skala= and ?sammenlign after hydration; posts its height to the
	 *  host page for the optional resize script. */
	import { onMount } from 'svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { scaleSteps } from '$lib/card';
	import { financingLine, partnerVariation } from '$lib/compare';
	import { devUnit, loadScenario, seriesByKey, type Meta, type Scenario } from '$lib/data';
	import { chartUnit, embedHeadline, embedSeries, loadEmbedRuns, readEmbedQuery, scaleNote, type EmbedHead } from '$lib/embed';
	import { permalink, provenanceLine } from '$lib/export';
	import { SITE_URL } from '$lib/site';

	let { meta, head }: { meta: Meta; head: EmbedHead } = $props();

	let main = $state.raw<Scenario | null>(null);
	let partner = $state.raw<Scenario | null>(null);
	let failed = $state(false);
	let scale = $state(1);
	let root: HTMLElement | undefined = $state();

	const info = $derived(seriesByKey(meta).get(head.serie));
	const shock = $derived(meta.shocks.find((s) => s.name === head.name));
	const years = $derived(Array.from({ length: meta.yearEnd - meta.yearStart + 1 }, (_, i) => meta.yearStart + i));
	const compare = $derived(!!partner);
	const runs = $derived(
		main && partner ? (head.variation === '_ufin' ? { ufin: main, perm: partner } : { ufin: partner, perm: main }) : null
	);

	const headline = $derived(
		main?.definition && shock
			? embedHeadline({ shock, definition: main.definition, variation: head.variation, scale, compare })
			: head.headline
	);
	const series = $derived(
		main
			? embedSeries({
					key: head.serie, label: head.chartTitle, instrument: main.definition?.seriesKey,
					main, partner, variation: head.variation, scale
				})
			: []
	);
	const financing = $derived(
		runs && main?.definition
			? financingLine({ ...runs, yearStart: meta.yearStart, firstYear: main.definition.firstYear, scale })
			: null
	);
	const closure = $derived(
		compare ? 'Permanent, finansieret og ufinansieret' : (meta.variations.find((v) => v.suffix === head.variation)?.labelDa ?? '')
	);
	const source = $derived(
		provenanceLine({
			model: main?.modelVersion?.name ?? meta.model.name,
			commit: main?.modelVersion?.commit ?? meta.model.commit ?? '',
			dataBasis: !main?.modelVersion || main.modelVersion.name === meta.model.name ? meta.model.dataBasisDa : undefined,
			closure,
			date: __BUILD_DATE__
		})
	);
	const link = $derived(permalink(SITE_URL, { stod: head.name, variant: head.variation, skala: scale, sammenlign: compare }));
	const note = $derived(scaleNote(scale));

	onMount(() => {
		let stale = false;
		void (async () => {
			const params = new URL(location.href).searchParams;
			const partnerVar = partnerVariation(head.variation);
			const hasPartner = !!partnerVar && !!shock?.available.includes(partnerVar);
			const wanted = hasPartner && params.has('sammenlign') ? `${head.name}${partnerVar}` : null;
			const runs = await loadEmbedRuns({ load: (file) => loadScenario(fetch, file), scenario: head.scenario, partner: wanted });
			if (stale) return;
			if (!runs?.main.definition) {
				failed = true;
				return;
			}
			scale = readEmbedQuery(params, scaleSteps(runs.main.definition.maxScale), hasPartner).scale;
			partner = runs.partner;
			main = runs.main;
		})();

		const post = () => {
			if (!root || window.parent === window) return;
			window.parent.postMessage({ type: 'makroskop:height', height: Math.ceil(root.getBoundingClientRect().height) }, '*');
		};
		const observer = new ResizeObserver(post);
		if (root) observer.observe(root);
		return () => {
			stale = true;
			observer.disconnect();
		};
	});
</script>

<main class="embed" bind:this={root}>
	<h1>{headline}</h1>
	{#if main}
		<LineChart
			title={head.chartTitle}
			code={head.serie}
			unit={chartUnit(info?.devMode)}
			{years}
			{series}
			fromYear={meta.defaultShockYear - 1}
			toYear={2060}
			zeroLine
			height={220}
			suffix={` ${devUnit(info?.devMode)}`}
		/>
		{#if financing}<p class="financing">{financing}</p>{/if}
	{:else if failed}
		<p class="failed">Kunne ikke hente data.</p>
	{:else}
		<div class="skeleton" aria-hidden="true"></div>
	{/if}
	<footer>
		{#if note}<p class="note">{note}</p>{/if}
		<p class="source">Kilde: {source}</p>
		<a class="back" href={link} target="_blank" rel="noopener">Se hele scenariet på MAKROskop →</a>
	</footer>
</main>

<style>
	:global(body) {
		background: var(--page);
		margin: 0;
	}

	.embed {
		padding: 12px 16px 14px;
		color: var(--ink);
	}

	h1 {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 500;
		line-height: 1.3;
		margin: 0 0 8px;
	}

	.skeleton {
		height: 290px;
		border-radius: 4px;
		background: var(--rule);
		opacity: 0.4;
	}

	.financing,
	.failed {
		font-size: 14px;
		line-height: 1.45;
		color: var(--ink-secondary);
		margin: 8px 0 0;
	}

	footer {
		margin-top: 10px;
		font-size: 12px;
		color: var(--ink-muted);
	}

	footer p {
		margin: 0 0 4px;
	}

	.back {
		font-weight: 500;
		color: var(--makro-strong);
	}
</style>
