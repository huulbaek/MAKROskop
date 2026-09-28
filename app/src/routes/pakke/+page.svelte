<script lang="ts">
	import PackageWorkbench from '$lib/components/PackageWorkbench.svelte';
	let { data } = $props();
</script>

<PackageWorkbench meta={data.meta} baseline={data.baseline} />
