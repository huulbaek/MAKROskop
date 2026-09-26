/** The mechanism map (makroskop-hkt): one fixed economy map for every shock, the shock's
 *  channel drawn on it. The arrows are editorial — MAKRO's channels as we describe them in
 *  etl/catalog.py (`channel`); the numbers on the nodes are the model's.
 *  The map itself (nodes, allowed arrows) is mechanism-map.json, which etl/tests/test_channel.py
 *  reads too, so a catalog channel with an arrow the map lacks fails at catalog-edit time.
 *  Design: docs/superpowers/specs/2026-09-26-mechanism-view-design.md. */

import map from './mechanism-map.json';

export interface MapNode {
	/** Series key in the scenario JSON. */
	key: string;
	label: string;
	/** What the series is, when the short label does not say it. */
	detail?: string;
	column: number;
	row: number;
}

export const MAP_COLUMNS: string[] = map.columns;
export const MAP_NODES: MapNode[] = map.nodes;

/** The arrows a channel may use: MAKRO's channels between the map's nodes. Only the current
 *  shock's arrows are drawn; this list keeps a catalog channel from drawing one MAKRO lacks. */
export const MAP_EDGES: ReadonlyArray<readonly [string, string]> = Object.values(map.edges)
	.flat()
	.map((edge) => edge.split('>') as [string, string]);

/** Financed runs: the closure tax answers the budget effect and feeds back on consumption. */
export const FINANCED_CHAIN: string = map.financedChain;

const NODE_BY_KEY = new Map(MAP_NODES.map((n) => [n.key, n]));
const EDGE_KEYS = new Set(Object.values(map.edges).flat());

export function nodeByKey(key: string): MapNode | undefined {
	return NODE_BY_KEY.get(key);
}

/** Problems with a catalog channel, for the data test; empty when the map can draw it. */
export function channelErrors(chains: string[]): string[] {
	const errors: string[] = [];
	for (const chain of chains) {
		const keys = chain.split('>');
		for (const key of keys) if (!NODE_BY_KEY.has(key)) errors.push(`unknown node ${key} in "${chain}"`);
		for (let i = 1; i < keys.length; i++) {
			const edge = `${keys[i - 1]}>${keys[i]}`;
			if (NODE_BY_KEY.has(keys[i - 1]) && NODE_BY_KEY.has(keys[i]) && !EDGE_KEYS.has(edge)) {
				errors.push(`no map edge ${edge} in "${chain}"`);
			}
		}
	}
	return errors;
}

export interface MechanismPath {
	/** Nodes on the path in reading order (chain by chain), each once. */
	nodes: string[];
	edges: [string, string][];
	/** Nodes the shock hits directly. */
	entries: string[];
}

/** The shock's path: the catalog chains, plus the closure tax on a financed run. A chain whose
 *  first node no earlier chain reached is hit by the shock; one that starts on the path
 *  continues it. */
export function pathOf(chains: string[], variation: string): MechanismPath {
	const path: MechanismPath = { nodes: [], edges: [], entries: [] };
	const add = (chain: string, fromShock: boolean) => {
		const keys = chain.split('>');
		if (fromShock && !path.nodes.includes(keys[0])) path.entries.push(keys[0]);
		for (const [i, key] of keys.entries()) {
			if (!path.nodes.includes(key)) path.nodes.push(key);
			const prev = keys[i - 1];
			if (i > 0 && !path.edges.some(([a, b]) => a === prev && b === key)) path.edges.push([prev, key]);
		}
	};
	for (const chain of chains) add(chain, true);
	if (chains.length > 0 && variation === '_perm') add(FINANCED_CHAIN, false);
	return path;
}

/** A node's largest |deviation| from the shock year to the horizon: what its reach bar fills
 *  towards. Independent of the year shown, so it is computed once per scenario. */
export function peakOf(values: (number | null)[] | undefined, at: { yearStart: number; firstYear: number; lastYear: number }): number {
	let peak = 0;
	for (let y = at.firstYear; y <= at.lastYear; y++) {
		const v = values?.[y - at.yearStart];
		if (v != null && Math.abs(v) > peak) peak = Math.abs(v);
	}
	return peak;
}

export interface NodeReading {
	/** Scaled deviation at the year; null where the series has no value. */
	value: number | null;
	/** |value| as a share of the node's peak: how far along its own response the node is.
	 *  0 for a flat series. */
	reach: number;
}

export function nodeReading(
	values: (number | null)[] | undefined,
	at: { year: number; yearStart: number; scale: number; peak: number }
): NodeReading {
	const raw = values?.[at.year - at.yearStart];
	if (raw == null) return { value: null, reach: 0 };
	return { value: raw * at.scale, reach: at.peak > 1e-12 ? Math.abs(raw) / at.peak : 0 };
}
