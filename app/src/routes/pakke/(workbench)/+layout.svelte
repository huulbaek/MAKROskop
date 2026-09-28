<script lang="ts">
	import PackageWorkbench from '$lib/components/PackageWorkbench.svelte';
	import { page } from '$app/state';

	let { data, children } = $props();
	/** Set by /pakke/forslag/<id>/ (its +page.server.ts); absent on /pakke/. */
	const proposalId = $derived((page.data.proposalId as string | undefined) ?? null);
</script>

<PackageWorkbench meta={data.meta} baseline={data.baseline} checks={data.checks} initialProposal={proposalId} />
{@render children()}
