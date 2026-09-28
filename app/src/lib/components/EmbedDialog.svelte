<script lang="ts">
	/** "Indlejr": the embed code for one chart, a live preview and the oEmbed link (makroskop-64y). */
	import { embedCode } from '$lib/embed';
	import { SITE_URL } from '$lib/site';

	let {
		title,
		url,
		baseUrl,
		height,
		scaled,
		onclose
	}: {
		/** Headline and chart, the iframe's title. */
		title: string;
		/** The embed URL with the page's current scale and compare state. */
		url: string;
		/** The ×1 embed URL: what a pasted link expands to through oEmbed. */
		baseUrl: string;
		height: number;
		/** The page is scaled or compared, so the pasted link differs from the code. */
		scaled: boolean;
		onclose: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let script = $state(true);
	let copied = $state('');
	const code = $derived(embedCode({ url, title, height, script }));
	/** The preview loads from this site, so it works before a deploy and on any host. */
	const preview = $derived(url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url);

	$effect(() => {
		dialog?.showModal();
	});

	async function copy(event: MouseEvent) {
		const box = (event.currentTarget as HTMLElement).closest('.code')?.querySelector('textarea');
		let ok = true;
		try {
			await navigator.clipboard.writeText(code);
		} catch {
			box?.select();
			ok = document.execCommand('copy');
		}
		copied = ok ? 'Kopieret' : 'Kunne ikke kopiere – markér koden og kopiér selv';
		setTimeout(() => (copied = ''), ok ? 2500 : 6000);
	}
</script>

<dialog
	bind:this={dialog}
	class="embed-dialog"
	aria-labelledby="embed-dialog-title"
	onclose={onclose}
	onclick={(event) => {
		if (event.target === dialog) dialog?.close();
	}}
>
	<div class="inner">
		<header>
			<h2 id="embed-dialog-title">Indlejr grafen</h2>
			<button class="close" onclick={() => dialog?.close()} aria-label="Luk">×</button>
		</header>
		<iframe src={preview} {title} style:height={`${height}px`} loading="lazy"></iframe>
		<div class="code">
			<label for="embed-code">Kode til din artikel</label>
			<textarea id="embed-code" readonly rows="5" onfocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()}>{code}</textarea>
			<div class="row">
				<button onclick={copy}>Kopiér</button>
				<span class="status" role="status">{copied}</span>
			</div>
			<label class="check">
				<input type="checkbox" bind:checked={script} />
				Tilpas højden automatisk
			</label>
			<p class="help">
				Tilføjer et lille script. Nogle CMS'er fjerner scripts – så beholder grafen den faste højde.
			</p>
		</div>
		<p class="help">
			Nogle CMS'er (fx WordPress) laver selv indlejringen, hvis du indsætter linket:
			<a href={baseUrl} target="_blank" rel="noopener">{baseUrl}</a>
			{#if scaled}<br />Linket viser stødet, som det er beregnet (×1 og uden sammenligning); koden ovenfor viser det, du ser nu.{/if}
		</p>
	</div>
</dialog>

<style>
	.embed-dialog {
		width: min(720px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: var(--page);
		color: var(--ink);
	}

	.embed-dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}

	.inner {
		padding: 16px 20px 20px;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	h2 {
		font-size: 20px;
		margin: 0;
	}

	.close {
		font-size: 24px;
		line-height: 1;
		background: none;
		border: 0;
		color: var(--ink);
		cursor: pointer;
	}

	iframe {
		width: 100%;
		border: 1px solid var(--rule);
		background: #fff;
	}

	.code {
		margin-top: 14px;
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--font-mono);
		font-size: 12px;
		margin-top: 4px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 6px 0 10px;
	}

	.help {
		font-size: 13px;
		color: var(--ink-secondary);
		margin: 4px 0 0;
	}

	@media (max-width: 600px) {
		.embed-dialog {
			width: 100vw;
			max-width: 100vw;
			height: 100dvh;
			max-height: 100dvh;
			border-radius: 0;
		}
	}
</style>
