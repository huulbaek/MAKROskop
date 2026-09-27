<script lang="ts">
	import EmbedChart from '$lib/components/EmbedChart.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.embed.title} · MAKROskop</title>
	<meta name="robots" content="noindex" />
	<link rel="canonical" href={data.embed.canonical} />
	<link rel="alternate" type="application/json+oembed" href={data.embed.oembed} title={data.embed.title} />
</svelte:head>

<EmbedChart meta={data.meta} head={data.embed} />
