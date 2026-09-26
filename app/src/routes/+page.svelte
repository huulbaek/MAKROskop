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
	<p class="framing">{answer.framing}</p>
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

	.framing {
		font-size: 13.5px;
		color: var(--ink-muted);
		margin: -8px 0 16px;
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
		gap: 0 22px;
		margin: 8px 0 0;
		font-size: 15px;
	}

	.go a {
		padding: 6px 0;
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
			gap: 0;
		}
		.tiles :global(.figure) {
			border-right: 0;
			padding: 12px 0;
		}
		.tiles :global(.figure + .figure) {
			border-top: 1px solid var(--rule);
		}
		.answer h2 {
			font-size: 24px;
		}
	}
</style>
