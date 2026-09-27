<script lang="ts">
	import { modelLine } from '$lib/opendata';

	let { data } = $props();
	const od = $derived(data.opendata);
	const m = $derived(od.manifest);
	const megabytes = $derived(`${(od.zip.bytes / 1e6).toFixed(1).replace('.', ',')} MB`);
	const model = $derived(modelLine(m));
	let copied = $state('');

	async function copy(text: string, which: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = which;
		} catch {
			copied = '';
		}
	}
</script>

<div class="page">
	<h1>Hent tallene bag MAKROskop</h1>
	<p class="lede">
		Alle scenarier, siden viser, som afvigelser fra MAKROs referenceforløb – i CSV til regneark og
		statistikprogrammer og i JSON til kode. Frit til genbrug under
		<a href="https://creativecommons.org/licenses/by/4.0/deed.da" rel="external license">CC BY 4.0</a>.
	</p>

	<section class="card download" aria-labelledby="hele">
		<h2 id="hele">Hele datasættet</h2>
		<a class="button" href={`/data/${od.zip.name}`} download rel="external">Hent {od.zip.name} ({megabytes})</a>
		<p class="version">Version {m.version} · {model} · {od.scenarioCount} scenarier</p>
		<p class="changelog">{m.changelog}</p>
		<details>
			<summary>Kontrolsum og manifest</summary>
			<p>SHA-256: <code class="mono sum">{od.zip.sha256}</code></p>
			<p><a href="/data/udgivelse.json" rel="external">udgivelse.json</a> – version, model og SHA-256 for hver datafil.</p>
		</details>
	</section>

	<section aria-labelledby="hvad">
		<h2 id="hvad">Hvad tallene er</h2>
		<p>
			Hvert scenarie er ét stød til MAKRO, DREAM-gruppens makroøkonomiske model af Danmark, løst med
			MAKROskops frie løser over hele modellens horisont (til 2129; filerne går til 2100). Tallene er
			afvigelser fra modellens kalibrerede referenceforløb: pct. for mængder og priser, pct.-point for
			satser, andele og saldi – ordbogen nedenfor siger hvilken.
		</p>
		<p>
			Stødet sættes ind i 2030. <em>Ufinansieret</em> betyder, at ingen skat reagerer; <em>finansieret</em>
			betyder, at den beregningstekniske lukkeskat justeres, så den offentlige nettoformue i 2129 udgør
			samme andel af BNP som i grundforløbet.
		</p>
		<p>
			Filerne indeholder stødet i den størrelse, det er beregnet i. Skyderen på scenariesiderne skalerer
			lineært; den skalering er ikke med her. Løseren er efterprøvet mod GAMS – se
			<a href="/validering/">Validering</a>.
		</p>
	</section>

	<section aria-labelledby="scenarier">
		<h2 id="scenarier">Pr. scenarie</h2>
		{#each od.groups as group (group.group)}
			<h3>{group.group}</h3>
			<div class="table-wrap">
			<table class="files">
				<thead>
					<tr><th scope="col">Stød</th><th scope="col">Variant</th><th scope="col">Filer</th></tr>
				</thead>
				<tbody>
					{#each group.shocks as shock (shock.name)}
						{#each shock.variants as variant, i (variant.suffix)}
							<tr>
								{#if i === 0}<th scope="row" rowspan={shock.variants.length}>{shock.labelDa}</th>{/if}
								<td>{variant.labelDa}</td>
								<td class="links">
									<a href={`/data/shocks/${variant.file}.json`} rel="external">JSON</a> ·
									<a href={`/data/csv/${variant.file}.csv`} rel="external">CSV</a> ·
									<a href={`/data/csv-da/${variant.file}.csv`} rel="external">CSV (dansk)</a> ·
									<a href={`/scenarier/${variant.file}/`}>vis</a>
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
			</div>
		{/each}
	</section>

	<section aria-labelledby="samlet">
		<h2 id="samlet">Alt i én fil</h2>
		<p>
			<a href="/data/csv/alle-scenarier.csv" rel="external">alle-scenarier.csv</a> ·
			<a href="/data/csv-da/alle-scenarier.csv" rel="external">dansk</a> – langt format med kolonnerne scenarie, stød,
			variant, serie, år og værdi; nemt at filtrere i R, Python eller en pivottabel.
		</p>
		<p>
			Grundforløbets niveauer: <a href="/data/csv/grundforloeb.csv" rel="external">grundforloeb.csv</a> ·
			<a href="/data/csv-da/grundforloeb.csv" rel="external">dansk</a>.
		</p>
		<p class="note">
			CSV: kommasepareret med decimalpunktum. CSV (dansk): semikolon og decimalkomma – åbner direkte i dansk Excel.
		</p>
	</section>

	<section aria-labelledby="ordbog">
		<h2 id="ordbog">Dataordbog</h2>
		<p><a href="/data/ordbog.csv" rel="external">ordbog.csv</a> · <a href="/data/ordbog-da.csv" rel="external">dansk</a></p>
		<div class="table-wrap">
			<table class="dictionary">
				<thead>
					<tr>
						<th scope="col">Nøgle</th><th scope="col">Betegnelse</th><th scope="col">Gruppe</th>
						<th scope="col">Enhed</th><th scope="col">Afvigelse i</th>
					</tr>
				</thead>
				<tbody>
					{#each od.series as s (s.key)}
						<tr><td><code class="mono">{s.key}</code></td><td>{s.labelDa}</td><td>{s.group}</td><td>{s.unit}</td><td>{s.deviationUnit}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section aria-labelledby="citer">
		<h2 id="citer">Sådan citerer du</h2>
		<blockquote>{od.citationDa}</blockquote>
		<button class="chip" onclick={() => copy(od.citationDa, 'da')}>Kopiér</button>
		<blockquote lang="en">{od.citationEn}</blockquote>
		<button class="chip" onclick={() => copy(od.citationEn, 'en')}>Copy</button>
		<span role="status" class="status">{copied ? 'Kopieret' : ''}</span>
		<p class="note">
			Modellen er DREAM-gruppens <a href="https://github.com/DREAM-DK/MAKRO" rel="external">MAKRO</a>. MAKROskop er en
			uafhængig prototype og ikke et produkt fra DREAM eller Finansministeriet.
		</p>
	</section>

	{#if m.earlier.length}
		<section aria-labelledby="tidligere">
			<h2 id="tidligere">Tidligere versioner</h2>
			<ul>
				{#each m.earlier as release (release.version)}
					<li><a href={release.url} rel="external">{release.version}</a> ({release.date}) – {release.changelog}</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 920px;
		padding: 32px 0 56px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: clamp(30px, 5vw, 42px);
		margin: 0 0 12px;
	}

	.lede {
		font-size: 19px;
		line-height: 1.5;
		color: var(--ink-secondary);
		max-width: 64ch;
	}

	section {
		margin-top: 36px;
	}

	h2 {
		font-size: 22px;
		margin: 0 0 10px;
	}

	h3 {
		font-size: 16px;
		margin: 22px 0 6px;
	}

	.download {
		border-left: 3px solid var(--makro);
		padding: 18px 20px;
	}

	.button {
		display: inline-block;
		padding: 10px 16px;
		border-radius: 4px;
		background: var(--makro-strong);
		/* the page colour: light on dark teal, dark on the dark theme's light teal */
		color: var(--page);
		font-weight: 500;
		text-decoration: none;
	}

	.version,
	.changelog,
	.note {
		font-size: 14px;
		color: var(--ink-secondary);
	}

	.sum {
		word-break: break-all;
	}

	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 14px;
	}

	th,
	td {
		text-align: left;
		padding: 6px 10px 6px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
	}

	thead th {
		font-weight: 600;
		color: var(--ink-muted);
	}

	.links {
		white-space: nowrap;
	}

	.table-wrap {
		overflow-x: auto;
	}

	blockquote {
		margin: 8px 0;
		padding: 10px 14px;
		border-left: 3px solid var(--rule);
		font-size: 15px;
	}

	.status {
		margin-left: 8px;
		font-size: 13px;
		color: var(--ink-muted);
	}

	@media (max-width: 600px) {
		.links {
			white-space: normal;
		}
	}
</style>
