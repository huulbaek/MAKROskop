<script lang="ts">
	import { formatTileValue } from '$lib/card';
	import { MAP_COLUMNS, MAP_NODES, nodeByKey, nodeReading, type MechanismPath, type NodeReading } from '$lib/mechanism';

	let {
		shockLabel,
		path,
		deviations,
		devModes,
		year,
		yearStart,
		firstYear,
		lastYear,
		scale,
		financed
	}: {
		/** "ECB-renten +1 pct.-point", scaled with the size slider. */
		shockLabel: string;
		path: MechanismPath;
		deviations: Record<string, (number | null)[]>;
		/** devMode per series key: pct. or pct.-point. */
		devModes: Record<string, string>;
		year: number;
		yearStart: number;
		firstYear: number;
		/** The horizon the reach bars measure against (the charts' last year). */
		lastYear: number;
		scale: number;
		/** Financed run: the closure-tax node is on the map. */
		financed: boolean;
	} = $props();

	/** Below this width the map gives way to the path as a list. */
	const MAP_MIN_WIDTH = 640;
	const NODE_H = 58;
	const ROW_STEP = 80;
	/** Column headings, then the top lane, then the first row. */
	const TOP = 46;
	/** Horizontal room between columns: the corridors long arrows travel in. */
	const GAP = 30;
	const LANE = 16;

	let width = $state(0);
	const wide = $derived(width >= MAP_MIN_WIDTH);

	const nodes = $derived(MAP_NODES.filter((n) => financed || n.key !== 'tLukning'));
	const rows = $derived(Math.max(...nodes.map((n) => n.row)) + 1);
	const gridBottom = $derived(TOP + rows * ROW_STEP - (ROW_STEP - NODE_H));
	const height = $derived(gridBottom + LANE + 6);
	const colW = $derived(width / MAP_COLUMNS.length);
	const nodeW = $derived(Math.min(150, colW - GAP));

	const readings = $derived(
		Object.fromEntries(
			nodes.map((n) => [n.key, nodeReading(deviations[n.key], { year, yearStart, firstYear, lastYear, scale })])
		) as Record<string, NodeReading>
	);

	function box(key: string) {
		const n = nodeByKey(key)!;
		const cx = colW * (n.column + 0.5);
		const cy = TOP + n.row * ROW_STEP + NODE_H / 2;
		return { n, cx, cy, left: cx - nodeW / 2, right: cx + nodeW / 2, top: cy - NODE_H / 2, bottom: cy + NODE_H / 2 };
	}

	/** A polyline with rounded corners. */
	function rounded(points: [number, number][], r = 7): string {
		let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
		for (let i = 1; i < points.length - 1; i++) {
			const [px, py] = points[i - 1];
			const [x, y] = points[i];
			const [nx, ny] = points[i + 1];
			const inLen = Math.hypot(x - px, y - py) || 1;
			const outLen = Math.hypot(nx - x, ny - y) || 1;
			const rr = Math.min(r, inLen / 2, outLen / 2);
			d += ` L${(x - ((x - px) / inLen) * rr).toFixed(1)},${(y - ((y - py) / inLen) * rr).toFixed(1)}`;
			d += ` Q${x.toFixed(1)},${y.toFixed(1)} ${(x + ((nx - x) / outLen) * rr).toFixed(1)},${(y + ((ny - y) / outLen) * rr).toFixed(1)}`;
		}
		const [lx, ly] = points[points.length - 1];
		return `${d} L${lx.toFixed(1)},${ly.toFixed(1)}`;
	}

	/** Arrows never run under a box: neighbours in a column join vertically, neighbouring columns
	 *  by an S-curve through the corridor between them, and anything longer leaves through a
	 *  corridor, travels along the lane above or below the grid, and comes in from the side. */
	function arrow(from: string, to: string, trackNo: number): string {
		const a = box(from);
		const b = box(to);
		const tip = 5;
		const dc = b.n.column - a.n.column;
		if (dc === 0) {
			if (Math.abs(b.n.row - a.n.row) === 1) {
				const down = b.n.row > a.n.row;
				return rounded([[a.cx, down ? a.bottom : a.top], [b.cx, down ? b.top - tip : b.bottom + tip]]);
			}
			const x = a.right + GAP / 2 - 4;
			return rounded([[a.right, a.cy], [x, a.cy], [x, b.cy], [b.right + tip, b.cy]]);
		}
		const forward = dc > 0;
		const sx = forward ? a.right : a.left;
		const ex = forward ? b.left - tip : b.right + tip;
		if (Math.abs(dc) === 1) {
			const mx = (sx + ex) / 2;
			return `M${sx.toFixed(1)},${a.cy.toFixed(1)} C${mx.toFixed(1)},${a.cy.toFixed(1)} ${mx.toFixed(1)},${b.cy.toFixed(1)} ${ex.toFixed(1)},${b.cy.toFixed(1)}`;
		}
		// Long arrows side by side, not on top of each other: each gets its own track.
		const track = (trackNo % 3) - 1;
		const upper = Math.min(a.n.row, b.n.row) <= (rows - 1) / 2;
		const lane = (upper ? TOP - LANE + 5 : gridBottom + LANE - 5) + (upper ? 1 : -1) * track * 4;
		const out = (forward ? a.right + GAP / 2 : a.left - GAP / 2) + track * 5;
		const into = (forward ? b.left - GAP / 2 : b.right + GAP / 2) - track * 5;
		return rounded([[sx, a.cy], [out, a.cy], [out, lane], [into, lane], [into, b.cy], [ex, b.cy]]);
	}

	/** Each long arrow's track number, in path order. */
	const tracks = $derived.by(() => {
		const out: Record<string, number> = {};
		let k = 0;
		for (const [a, b] of path.edges) {
			if (Math.abs(nodeByKey(a)!.column - nodeByKey(b)!.column) > 1) out[`${a}>${b}`] = k++;
		}
		return out;
	});

	const unitOf = (key: string) => (devModes[key] === 'pct' ? 'pct.' : 'pct.-point');
	const valueText = (key: string) => {
		const value = readings[key]?.value;
		return value == null ? '–' : formatTileValue(value);
	};
	const labelOf = (key: string) => nodeByKey(key)?.label ?? key;

	/** What feeds each path node, for the list: "via renter og boligpriser". */
	const incoming = $derived(
		Object.fromEntries(path.nodes.map((key) => [key, path.edges.filter(([, b]) => b === key).map(([a]) => labelOf(a).toLowerCase())]))
	);

	function via(key: string): string {
		const from = incoming[key] ?? [];
		const parts: string[] = [];
		if (path.entries.includes(key)) parts.push('stødet rammer her');
		if (from.length > 0) parts.push(`via ${from.length > 1 ? `${from.slice(0, -1).join(', ')} og ${from.at(-1)}` : from[0]}`);
		return parts.join(' · ');
	}
</script>

<section class="mechanism" aria-labelledby="mechanism-title">
	<div class="head">
		<h3 id="mechanism-title">Sådan breder stødet sig</h3>
		<p class="shock"><span class="shock-key">Stødet</span> {shockLabel}</p>
	</div>

	<div class="canvas" bind:clientWidth={width}>
		{#if wide}
			<div class="map" style:height="{height}px" aria-hidden="true">
				<svg {width} {height}>
					<defs>
						<marker id="mechanism-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
							<path d="M0,1 L9,5 L0,9 z" fill="var(--ink-secondary)" />
						</marker>
					</defs>
					{#each MAP_COLUMNS as column, i (column)}
						<text class="column" x={colW * (i + 0.5)} y="11" text-anchor="middle">{column}</text>
					{/each}
					{#each path.edges as [from, to], i (`${from}>${to}`)}
						<path class="edge" d={arrow(from, to, tracks[`${from}>${to}`] ?? i)} marker-end="url(#mechanism-arrow)" />
					{/each}
				</svg>
				{#each nodes as node (node.key)}
					{@const b = box(node.key)}
					{@const on = path.nodes.includes(node.key)}
					<div
						class="node"
						class:on
						class:entry={path.entries.includes(node.key)}
						style:left="{b.left}px"
						style:top="{b.top}px"
						style:width="{nodeW}px"
						style:height="{NODE_H}px"
						title={node.detail ? `${node.label} (${node.detail})` : node.label}
					>
						{#if path.entries.includes(node.key)}<span class="entry-tag">stødet</span>{/if}
						<span class="label">{node.label}</span>
						<span class="value">{valueText(node.key)}<span class="unit">{unitOf(node.key)}</span></span>
						<span class="reach"><span style:width="{(readings[node.key]?.reach ?? 0) * 100}%"></span></span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- The path in reading order: the map on phones, and its text version everywhere. -->
		<ol class="chain" class:sr-only={wide}>
			{#each path.nodes as key (key)}
				<li class:entry={path.entries.includes(key)}>
					<span class="label">{labelOf(key)}</span>
					<span class="value">{valueText(key)} <span class="unit">{unitOf(key)}</span></span>
					{#if via(key)}<span class="via">{via(key)}</span>{/if}
					<span class="reach" aria-hidden="true"><span style:width="{(readings[key]?.reach ?? 0) * 100}%"></span></span>
				</li>
			{/each}
		</ol>
	</div>

	<p class="note">
		Pilene er MAKROs kanaler, som vi har beskrevet dem; tallene er modellens. Bjælken viser, hvor langt hver
		størrelse er nået mod sit største udslag frem til {lastYear}.
	</p>
</section>

<style>
	.mechanism {
		margin: 0 0 22px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
		margin-bottom: 10px;
	}

	h3 {
		font-size: 20px;
		margin: 0;
	}

	.shock {
		margin: 0;
		font-size: 14px;
		color: var(--ink);
	}

	.shock-key {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--makro-strong);
		margin-right: 4px;
	}

	.map {
		position: relative;
	}

	svg {
		position: absolute;
		inset: 0;
		overflow: visible;
	}

	text.column {
		font-family: var(--font-body);
		font-size: 10.5px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		fill: var(--ink-muted);
	}

	.edge {
		fill: none;
		stroke: var(--ink-secondary);
		stroke-width: 1.6;
	}

	.node {
		position: absolute;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
		padding: 6px 8px 8px;
		background: var(--surface-raised);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
		opacity: 0.5;
	}

	.node.on {
		opacity: 1;
		border-color: var(--rule-strong);
		box-shadow: 0 1px 0 var(--rule);
	}

	.node.entry {
		border-top: 2px solid var(--makro-strong);
	}

	/* A tab on the box's top edge: the shock hits here. */
	.entry-tag {
		position: absolute;
		bottom: 100%;
		left: -1px;
		padding: 1px 6px 0;
		font-size: 9.5px;
		font-weight: 600;
		line-height: 14px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--page);
		background: var(--makro-strong);
		border-radius: var(--radius) var(--radius) 0 0;
	}

	.label {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.value {
		font-size: 16px;
		font-weight: 600;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.unit {
		font-size: 11px;
		font-weight: 400;
		color: var(--ink-muted);
		margin-left: 3px;
	}

	.reach {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 3px;
		background: var(--grid);
		overflow: hidden;
	}

	.reach > span {
		display: block;
		height: 100%;
		background: var(--series-1);
		transition: width 180ms linear;
	}

	.chain {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}

	.chain li {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: baseline;
		gap: 0 12px;
		padding: 8px 12px 10px;
		background: var(--surface-raised);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
	}

	.chain li.entry {
		border-left: 3px solid var(--makro);
	}

	.chain .via {
		grid-column: 1 / -1;
		font-size: 12px;
		color: var(--ink-muted);
	}

	.note {
		margin: 10px 0 0;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--ink-muted);
		max-width: 72ch;
	}

	@media (prefers-reduced-motion: reduce) {
		.reach > span {
			transition: none;
		}
	}
</style>
