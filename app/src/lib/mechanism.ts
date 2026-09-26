/** The mechanism map (makroskop-hkt): one fixed economy map for every shock, the shock's
 *  channel drawn on it. The arrows are editorial — MAKRO's channels as we describe them in
 *  etl/catalog.py (`channel`); the numbers on the nodes are the model's.
 *  Design: docs/superpowers/specs/2026-09-26-mechanism-view-design.md. */

export const MAP_COLUMNS = ['Finans', 'Efterspørgsel', 'Produktion', 'Arbejdsmarked', 'Løn og priser', 'Offentlige finanser'];

export interface MapNode {
	/** Series key in the scenario JSON. */
	key: string;
	label: string;
	/** What the series is, when the short label does not say it. */
	detail?: string;
	column: number;
	row: number;
}

export const MAP_NODES: MapNode[] = [
	{ key: 'rRenteObl', label: 'Renter', detail: 'obligationsrenten', column: 0, row: 1 },
	{ key: 'pBolig', label: 'Boligpriser', column: 0, row: 2 },
	{ key: 'qC', label: 'Privat forbrug', column: 1, row: 0 },
	{ key: 'qI', label: 'Investeringer', column: 1, row: 1 },
	{ key: 'qG', label: 'Off. forbrug', detail: 'offentligt forbrug', column: 1, row: 2 },
	{ key: 'qX', label: 'Eksport', column: 1, row: 3 },
	{ key: 'qM', label: 'Import', column: 1, row: 4 },
	{ key: 'qBNP', label: 'BNP', column: 2, row: 2 },
	{ key: 'nPop', label: 'Befolkning', column: 3, row: 0 },
	{ key: 'snL', label: 'Arbejdsudbud', detail: 'strukturel beskæftigelse', column: 3, row: 1 },
	{ key: 'nL', label: 'Beskæftigelse', column: 3, row: 2 },
	{ key: 'ledighedsgrad', label: 'Ledighed', detail: 'bruttoledighedsgraden', column: 3, row: 3 },
	{ key: 'vhW', label: 'Løn', detail: 'timelønnen', column: 4, row: 1 },
	{ key: 'pC', label: 'Forbrugerpriser', column: 4, row: 2 },
	{ key: 'saldo2bnp', label: 'Offentlig saldo', detail: 'andel af BNP', column: 5, row: 1 },
	{ key: 'tLukning', label: 'Lukkeskat', detail: 'den beregningstekniske lukkeskat', column: 5, row: 2 }
];

/** The arrows a channel may use: MAKRO's channels between the map's nodes. Only the current
 *  shock's arrows are drawn; this list keeps a catalog channel from drawing one MAKRO lacks. */
export const MAP_EDGES: ReadonlyArray<readonly [string, string]> = [
	// interest rates: housing, investment, consumption, the state's interest bill
	['rRenteObl', 'pBolig'], ['rRenteObl', 'qI'], ['rRenteObl', 'qC'], ['rRenteObl', 'saldo2bnp'],
	// housing wealth and housing investment
	['pBolig', 'qC'], ['pBolig', 'qI'],
	// demand makes output; imports leak
	['qC', 'qBNP'], ['qI', 'qBNP'], ['qG', 'qBNP'], ['qX', 'qBNP'], ['qM', 'qBNP'],
	['qC', 'qM'], ['qI', 'qM'], ['qX', 'qM'],
	// labour demand
	['qBNP', 'nL'], ['qG', 'nL'], ['vhW', 'nL'],
	// labour supply: more people, more workers, unemployment first
	['nPop', 'snL'], ['nPop', 'qC'], ['nPop', 'qI'], ['snL', 'ledighedsgrad'], ['snL', 'nL'],
	['nL', 'ledighedsgrad'], ['nL', 'qBNP'], ['nL', 'qC'],
	// wage bargaining, prices, competitiveness, real income
	['ledighedsgrad', 'vhW'], ['vhW', 'pC'], ['vhW', 'qX'], ['vhW', 'qC'],
	['pC', 'qC'], ['pC', 'vhW'], ['pC', 'qX'],
	// public finances and the financed closure
	['qBNP', 'saldo2bnp'], ['qC', 'saldo2bnp'], ['nL', 'saldo2bnp'],
	['saldo2bnp', 'tLukning'], ['tLukning', 'qC']
];

/** Financed runs: the closure tax answers the budget effect and feeds back on consumption. */
export const FINANCED_CHAIN = 'saldo2bnp>tLukning>qC';

const NODE_KEYS = new Set(MAP_NODES.map((n) => n.key));
const EDGE_KEYS = new Set(MAP_EDGES.map(([a, b]) => `${a}>${b}`));

export function nodeByKey(key: string): MapNode | undefined {
	return MAP_NODES.find((n) => n.key === key);
}

/** Problems with a catalog channel, for the data test; empty when the map can draw it. */
export function channelErrors(chains: string[]): string[] {
	const errors: string[] = [];
	for (const chain of chains) {
		const keys = chain.split('>');
		for (const key of keys) if (!NODE_KEYS.has(key)) errors.push(`unknown node ${key} in "${chain}"`);
		for (let i = 1; i < keys.length; i++) {
			const edge = `${keys[i - 1]}>${keys[i]}`;
			if (NODE_KEYS.has(keys[i - 1]) && NODE_KEYS.has(keys[i]) && !EDGE_KEYS.has(edge)) {
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
	/** Nodes the shock hits directly: arrows from the shock bar. */
	entries: string[];
}

/** The shock's path: the catalog chains, plus the closure tax on a financed run. A chain whose
 *  first node no earlier chain reached enters from the shock; one that starts on the path
 *  continues it. */
export function pathOf(chains: string[], variation: string): MechanismPath {
	const nodes: string[] = [];
	const edges: [string, string][] = [];
	const entries: string[] = [];
	const all = chains.length > 0 && variation === '_perm' ? [...chains, FINANCED_CHAIN] : chains;
	for (const [index, chain] of all.entries()) {
		const keys = chain.split('>');
		const financed = index >= chains.length;
		if (!financed && !nodes.includes(keys[0])) entries.push(keys[0]);
		for (const [i, key] of keys.entries()) {
			if (!nodes.includes(key)) nodes.push(key);
			if (i === 0) continue;
			const prev = keys[i - 1];
			if (!edges.some(([a, b]) => a === prev && b === key)) edges.push([prev, key]);
		}
	}
	return { nodes, edges, entries };
}

export interface NodeReading {
	/** Scaled deviation at the year; null where the series has no value. */
	value: number | null;
	/** |value| as a share of the node's largest |deviation| from the shock year to the horizon:
	 *  how far along its own response the node is. 0 for a flat series. */
	reach: number;
}

export function nodeReading(
	values: (number | null)[] | undefined,
	at: { year: number; yearStart: number; firstYear: number; lastYear: number; scale: number }
): NodeReading {
	const raw = values?.[at.year - at.yearStart];
	if (values == null || raw == null) return { value: null, reach: 0 };
	let peak = 0;
	for (let y = at.firstYear; y <= at.lastYear; y++) {
		const v = values[y - at.yearStart];
		if (v != null && Math.abs(v) > peak) peak = Math.abs(v);
	}
	return { value: raw * at.scale, reach: peak > 1e-12 ? Math.abs(raw) / peak : 0 };
}
