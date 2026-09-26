<script lang="ts">
	let {
		year = $bindable(),
		playing = $bindable(false),
		min,
		max,
		onscrub
	}: {
		year: number;
		playing?: boolean;
		/** The shock year: år 1. */
		min: number;
		max: number;
		/** The reader moved the year (slider or play). */
		onscrub?: () => void;
	} = $props();

	/** One year per step: about 4 a second, so thirty years play out in under ten seconds. */
	const STEP_MS = 250;

	$effect(() => {
		if (!playing) return;
		const id = setInterval(() => {
			if (year >= max) playing = false;
			else year += 1;
		}, STEP_MS);
		return () => clearInterval(id);
	});

	function togglePlay() {
		if (!playing && year >= max) year = min;
		playing = !playing;
		onscrub?.();
	}

	const nth = $derived(year - min + 1);
</script>

<div class="scrubber" role="group" aria-label="År">
	<button class="play" onclick={togglePlay} aria-label={playing ? 'Stop afspilning' : 'Afspil år for år'}>
		{#if playing}
			<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" /><rect x="7" y="1.5" width="3" height="9" /></svg>
		{:else}
			<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5,1.5 L10.5,6 L2.5,10.5 z" /></svg>
		{/if}
	</button>
	<input
		type="range"
		{min}
		{max}
		step="1"
		bind:value={year}
		oninput={() => {
			playing = false;
			onscrub?.();
		}}
		aria-label="Vis året"
		aria-valuetext={`${year}, år ${nth} efter stødet`}
	/>
	<output class="readout"><strong>{year}</strong> <span>år {nth}</span></output>
</div>

<style>
	.scrubber {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.play {
		flex: none;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid var(--rule-strong);
		background: var(--surface-raised);
		color: var(--ink);
		cursor: pointer;
	}

	.play svg {
		fill: currentColor;
	}

	.play:hover {
		border-color: var(--makro);
	}

	.play:focus-visible {
		outline: 2px solid var(--makro);
		outline-offset: 2px;
	}

	input {
		flex: 1;
		min-width: 0;
		accent-color: var(--makro);
	}

	.readout {
		flex: none;
		min-width: 88px;
		font-variant-numeric: tabular-nums;
		font-size: 14px;
		color: var(--ink);
	}

	.readout span {
		font-size: 12px;
		color: var(--ink-muted);
		margin-left: 2px;
	}
</style>
