<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Meta } from '$lib/data';
	import { formatValue } from '$lib/format';
	import { formatPctDa, MAX_GAP_PCT, proposalDateDa } from '$lib/proposal';
	import { PROPOSALS } from '$lib/proposals';

	const meta = $derived(page.data.meta as Meta);
	const sizing = $derived(meta.sizing);
	const shockRows = $derived(sizing ? Object.entries(sizing.staticSaldoPct) : []);
	/** " = 30.643 personer" appended after "2030"; Svelte trims a bare space next to {#if}, so the
	 *  leading space is built into the string itself. */
	const structuralNote = $derived(sizing ? ` = ${formatValue(sizing.snLHh2030 * 10)} personer` : '');
	/** Nominal GDP for the price years the shipped proposals use, so kr → pct. of GDP can be checked. */
	const daGdp = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const gdpRows = $derived.by(() => {
		if (!sizing) return [];
		const years = new Set(PROPOSALS.flatMap((p) => [...p.elements, ...p.financing].map((e) => e.priceYear)));
		return [...years]
			.sort((a, b) => a - b)
			.filter((y) => sizing.vBNP[String(y)] != null)
			.map((y) => [y, sizing.vBNP[String(y)]] as const);
	});
	const revised = $derived(PROPOSALS.filter((p) => p.revisions.length > 0));

	function shockLabel(name: string): string {
		return meta.shocks.find((s) => s.name === name)?.labelDa ?? name;
	}
</script>

<div class="page">
	<h1>Sådan regner vi forslag</h1>
	<p class="lede">
		Hvert forslag under Pakker er regnet med samme metode: kilden er Finansministeriets egne tal,
		størrelsen er beregnet – ikke skrevet ind – og resultatet er kontrolleret mod én samlet
		modelkørsel af hele forslaget. Denne side beskriver metoden trin for trin.
	</p>

	<section aria-labelledby="optagelse">
		<h2 id="optagelse">Hvilke forslag kommer med?</h2>
		<p>Et forslag kommer med, når tre betingelser er opfyldt:</p>
		<ol>
			<li>
				Finansministeriet har offentliggjort den statiske provenuvirkning for hvert element og
				den strukturelle beskæftigelsesvirkning – i et lovforslag, en aftaletekst eller et
				folketingssvar.
			</li>
			<li>Hvert element kan henføres til et instrument, MAKRO har løst.</li>
			<li>
				Den samlede modelkørsel af hele forslaget stemmer overens med den lineære sum af
				elementerne inden for {MAX_GAP_PCT} pct. på hver af hovedserierne.
			</li>
		</ol>
		<p>
			Afvigelsen måles for hver af fem hovedserier – BNP, beskæftigelse, den offentlige saldo, privat
			forbrug og timelønnen – som den største forskel mellem den samlede modelkørsel og den lineære
			sum i årene 2030-2060, i procent af den samlede kørsels største afvigelse fra grundforløbet i
			samme periode. Det er en relativ afvigelse, ikke pct. af BNP; forslagets kort viser den største
			af de fem.
		</p>
		<p>
			Alle kan bede om, at et forslag kommer med; anmodninger behandles i den rækkefølge, de
			kommer, og et afslag begrundes med den betingelse, forslaget ikke opfylder.
			<a href="https://github.com/huulbaek/makroskop/issues" rel="external">Bed om et forslag på GitHub</a>.
		</p>
	</section>

	<section aria-labelledby="stoerrelse">
		<h2 id="stoerrelse">Hvordan sættes et forslag i størrelse?</h2>
		<p>
			Hvert element i et forslag er Finansministeriets egen umiddelbare provenuvirkning – før
			tilbageløb og adfærd – i mia. kr., opgjort i det år, kilden angiver. Den omregnes til en
			skalering af det tilsvarende MAKRO-stød:
		</p>
		<p class="formula">
			<code>skala = (mia. kr. / BNP i prisåret) / stødets statiske provenuvirkning</code>
		</p>
		<p>
			Stødets statiske provenuvirkning er, hvad stødet ved ×1 umiddelbart ændrer den offentlige
			saldo med, i pct. af BNP i 2030:
		</p>
		{#if shockRows.length}
			<div class="table-wrap">
				<table>
					<thead>
						<tr><th scope="col">Stød</th><th scope="col">Statisk provenuvirkning</th></tr>
					</thead>
					<tbody>
						{#each shockRows as [name, value] (name)}
							<tr><td>{shockLabel(name)}</td><td>{formatPctDa(value)} pct. af BNP ved ×1</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		{#if gdpRows.length}
			<p>BNP i løbende priser i de prisår, forslagenes tal er opgjort i:</p>
			<div class="table-wrap">
				<table>
					<thead>
						<tr><th scope="col">Prisår</th><th scope="col">BNP</th></tr>
					</thead>
					<tbody>
						{#each gdpRows as [year, gdp] (year)}
							<tr><td>{year}</td><td>{daGdp.format(gdp)} mia. kr.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		<p>
			Bundskat, Topskat og AM-bidrag er satser på et grundlag (<code>vtX = tX · grundlag</code>):
			den statiske provenuvirkning er den ændrede sats gange grundlaget.
		</p>
		<p>
			Beskæftigelsesfradraget trækkes fra det skattepligtige indkomstgrundlag, så en ændring af
			fradraget er kommune- og kirkeskatten af beløbet værd:
		</p>
		<p class="formula">
			<code>
				statisk provenuvirkning = −vBeskFradrag · Δt / t · (tKommune · ftKommune + tKirke · ftKirke ·
				rtKirke) / BNP, alt i 2030
			</code>
		</p>
		<p>
			Her er <code>vBeskFradrag = tBeskFradrag · vWHh</code> fradragets samlede beløb (sats gange husholdningernes lønindkomst), <code>Δt / t</code>
			stødets relative ændring af fradragssatsen og parentesen den gennemsnitlige kommune- og kirkeskat af
			et fradraget beløb.
		</p>
		<p>
			Offentligt forbrug, offentlige varekøb og offentlig beskæftigelse er stød til det offentliges
			egne udgifter: den statiske provenuvirkning er den ændrede udgift.
		</p>
		<p>
			Et element på et instrument, MAKRO ikke har, regnes på det nærmeste instrument af samme
			skat, ved samme statiske provenu – forslagets kort viser hvilket. MAKRO har i denne udgave
			ét topskattetrin.
		</p>
	</section>

	<section aria-labelledby="strukturel">
		<h2 id="strukturel">Strukturel virkning</h2>
		<p>
			I MAKROs stødmodel påvirker marginalskatten ikke det strukturelle arbejdsudbud: en ændret
			skattesats går ud af den ligning, der bestemmer det. Et forslags strukturelle virkning skal
			derfor komme udefra.
		</p>
		<p>
			MAKROskop bruger Finansministeriets offentliggjorte skøn over den strukturelle
			beskæftigelsesvirkning – samme kilde for hvert forslag – og lægger det ind som stødet
			Arbejdsudbud (beskæftigelse), opgjort i fuldtidspersoner (forskellen på timer og personer er
			ikke modelleret):
		</p>
		<p class="formula">
			<code>
				skala = fuldtidspersoner / (1 pct. af husholdningernes strukturelle beskæftigelse i
				2030{structuralNote})
			</code>
		</p>
		<p>
			Grundlaget er husholdningernes strukturelle beskæftigelse (<code>snLHh</code>) – det grundlag,
			stødet Arbejdsudbud (beskæftigelse) selv flytter med 1 pct. ved ×1.
		</p>
	</section>

	<section aria-labelledby="finansiering">
		<h2 id="finansiering">Finansiering</h2>
		<p>
			Finansieringen er forslagets egen: de rækker, forslagsstilleren selv har angivet som
			finansiering, lægges ind i pakken. De sættes i størrelse efter det beløb, kilden angiver for
			finansieringen, og omregnes til pct. af BNP på samme måde som forslagets øvrige elementer.
		</p>
		<p>
			Pakken åbner ufinansieret (uden lukkeskat); saldoen viser derfor, hvad der er tilbage, når
			forslagets egen finansiering er talt med. Skifter man lukningen til finansieret, dækker
			lukkeskatten resten – men så er pakken ikke længere forslaget, den bliver en tilpasset pakke.
		</p>
		<p>
			Skatteelementerne sættes i størrelse efter deres umiddelbare (statiske) provenu, mens
			Finansministeriet ofte opgør finansieringsbehovet, efter tilbageløb og adfærd er talt med.
			MAKRO beregner selv tilbageløbet og adfærden, så saldoen bliver ikke nødvendigvis nul, selv om
			forslagets finansiering er talt med.
		</p>
		<p>
			Hvert forslag lægges oven på MAKROs grundforløb. Elementer, grundforløbet allerede
			indeholder, er ikke talt med – de står under "Ikke med i beregningen" på forslagets kort.
		</p>
	</section>

	<section aria-labelledby="ikke">
		<h2 id="ikke">Hvad MAKROskop ikke er</h2>
		<ul>
			<li>
				MAKROskop er ikke Finansministeriets eller DREAMs egen beregning af forslaget – tallene
				er regnet i MAKRO, med den metode, denne side beskriver.
			</li>
			<li>Der er ingen fordelingsvirkning: MAKRO har alder, men ikke indkomstgrupper.</li>
			<li>Der er ingen indfasning: forslaget regnes fuldt indfaset og varigt fra 2030.</li>
			<li>
				Den lineære sum af elementerne er kontrolleret mod én samlet modelkørsel af hele
				forslaget; afvigelsen står på forslagets kort, og et forslag kommer kun med, hvis
				afvigelsen er inden for {MAX_GAP_PCT} pct.
			</li>
		</ul>
	</section>

	<section aria-labelledby="rettelser">
		<h2 id="rettelser">Rettelser</h2>
		{#if revised.length}
			{#each revised as p (p.id)}
				<h3>{p.titleDa}</h3>
				<ul>
					{#each p.revisions as r, i (i)}<li>{proposalDateDa(r.date)} – {r.noteDa}</li>{/each}
				</ul>
			{/each}
		{:else}
			<p>Ingen rettelser endnu.</p>
		{/if}
	</section>

	<p class="back"><a href={resolve('/pakke/')}>Tilbage til Pakker</a></p>
</div>

<style>
	.page {
		max-width: 760px;
		padding: 32px 0 56px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: clamp(30px, 5vw, 42px);
		margin: 0 0 12px;
	}

	.lede {
		font-size: 17px;
		line-height: 1.5;
		color: var(--ink-secondary);
		max-width: 62ch;
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
		margin: 20px 0 6px;
	}

	p,
	li {
		line-height: 1.55;
	}

	ol,
	ul {
		padding-left: 20px;
	}

	li {
		margin-bottom: 6px;
	}

	.formula {
		margin: 10px 0;
	}

	.formula code {
		display: inline-block;
		font-size: 13.5px;
		background: var(--surface-raised);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
		padding: 8px 12px;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
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

	.back {
		margin-top: 40px;
	}
</style>
