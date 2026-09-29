<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProposalCheck, Sizing } from '$lib/data';
	import {
		chainLineDa, proposalDateDa, proposalPackage, statusDa, verificationLineDa, type PresetState
	} from '$lib/proposal';

	/** The proposal a preset package was opened from (makroskop-48o): the full card while the
	 *  package is the proposal, a one-line "Tilpasset fra" note once anything is changed. */
	let {
		state,
		sizing,
		labels,
		check,
		onreset
	}: {
		state: PresetState;
		sizing: Sizing;
		/** Catalog name → labelDa, so each step names the shock as the catalog does. */
		labels: Record<string, string>;
		check: ProposalCheck | undefined;
		onreset: () => void;
	} = $props();

	const p = $derived(state.proposal);
	const chain = $derived(proposalPackage(p, sizing).chain);
	const STANDARD_OMITTED = [
		'Indfasning: forslaget er regnet fuldt indfaset og varigt fra 2030.',
		'Fordelingsvirkninger: MAKRO har alder, men ikke indkomstgrupper.',
		'Samspil mellem elementerne ud over det, den samlede modelkørsel viser.'
	];
</script>

{#if state.edited}
	<p class="card adapted" role="note">
		Tilpasset fra: <em>{p.titleDa}</em> ({p.proposerDa}). Tallene er ikke længere forslagets.
		<button class="linklike" onclick={onreset}>Vis forslaget igen</button>
	</p>
{:else}
	<section class="card proposal" aria-label="Forslaget">
		<p class="kicker">{statusDa(p.status)} · {p.proposerDa} · {proposalDateDa(p.date)}</p>
		<h3>{p.titleDa}</h3>
		<ul class="chain">
			{#each chain as row, i (i)}
				<li>{chainLineDa(row, labels)}{#if row.mappedDa}<span class="mapped">{row.mappedDa}</span>{/if}</li>
			{/each}
		</ul>
		{#if check}<p class="verification">{verificationLineDa(check.maxGapPct)}</p>{/if}
		<details>
			<summary>Ikke med i beregningen</summary>
			<ul>
				{#each [...p.omittedDa, ...STANDARD_OMITTED] as line, i (i)}<li>{line}</li>{/each}
			</ul>
		</details>
		<p class="sources">
			Kilder: {#each p.sources as s, i (i)}<a href={s.url} rel="external">{s.labelDa}</a>{i < p.sources.length - 1
					? ' · '
					: ''}{/each}
			· <a href={resolve('/pakke/metode/')}>Metode</a>
		</p>
	</section>
{/if}

<style>
	.card {
		margin: 0 0 16px;
	}

	.adapted {
		font-size: 14px;
		color: var(--ink-secondary);
		border-left: 3px solid var(--rule-strong);
	}

	.linklike {
		font: inherit;
		padding: 0;
		border: 0;
		border-bottom: 1px solid currentColor;
		border-radius: 0;
		background: none;
		color: var(--ink);
		cursor: pointer;
		margin-left: 4px;
	}

	.linklike:hover {
		color: var(--makro-strong);
	}

	.proposal {
		border-left: 3px solid var(--rule-strong);
		font-size: 14px;
	}

	.kicker {
		margin: 0 0 4px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}

	h3 {
		margin: 0 0 10px;
	}

	.chain {
		margin: 0 0 10px;
		padding-left: 18px;
		font-variant-numeric: tabular-nums;
	}

	.chain li {
		margin-bottom: 6px;
		overflow-wrap: anywhere;
	}

	.mapped {
		display: block;
		font-size: 12.5px;
		color: var(--ink-muted);
	}

	.verification {
		margin: 0 0 10px;
		color: var(--ink-secondary);
	}

	details {
		margin: 0 0 10px;
		color: var(--ink-secondary);
	}

	summary {
		cursor: pointer;
		color: var(--ink);
	}

	details ul {
		margin: 6px 0 0;
		padding-left: 18px;
	}

	.sources {
		margin: 0;
		font-size: 12.5px;
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}
</style>
