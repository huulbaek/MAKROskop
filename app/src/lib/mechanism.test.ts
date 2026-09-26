import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { channelErrors, FINANCED_CHAIN, MAP_EDGES, MAP_NODES, nodeReading, pathOf } from './mechanism';
import type { Scenario } from './data';

const RENTE = ['rRenteObl>pBolig>qC>qBNP', 'rRenteObl>qI>qBNP', 'qBNP>nL>ledighedsgrad>vhW>pC'];

describe('pathOf', () => {
	it('lists the nodes in reading order, each once', () => {
		expect(pathOf(RENTE, '_ufin').nodes).toEqual(['rRenteObl', 'pBolig', 'qC', 'qBNP', 'qI', 'nL', 'ledighedsgrad', 'vhW', 'pC']);
	});

	it('draws an edge for every consecutive pair, each once', () => {
		const { edges } = pathOf(RENTE, '_ufin');
		expect(edges).toContainEqual(['rRenteObl', 'pBolig']);
		expect(edges).toContainEqual(['qI', 'qBNP']);
		expect(edges).toContainEqual(['vhW', 'pC']);
		expect(edges).toHaveLength(9);
	});

	it('enters from the shock only where a chain starts on a node no earlier chain reached', () => {
		expect(pathOf(RENTE, '_ufin').entries).toEqual(['rRenteObl']);
		expect(pathOf(['qC>qBNP', 'pBolig>qI', 'saldo2bnp'], '_ufin').entries).toEqual(['qC', 'pBolig', 'saldo2bnp']);
	});

	it('adds the closure tax to a financed run, without an entry arrow', () => {
		const path = pathOf(['qC>qBNP'], '_perm');
		expect(path.nodes).toEqual(['qC', 'qBNP', 'saldo2bnp', 'tLukning']);
		expect(path.edges).toContainEqual(['saldo2bnp', 'tLukning']);
		expect(path.edges).toContainEqual(['tLukning', 'qC']);
		expect(path.entries).toEqual(['qC']);
		expect(pathOf(['qC>qBNP'], '_ufin').nodes).not.toContain('tLukning');
	});

	it('is empty for a shock without a channel', () => {
		expect(pathOf([], '_ufin')).toEqual({ nodes: [], edges: [], entries: [] });
	});
});

describe('channelErrors', () => {
	it('accepts chains made of map nodes and vocabulary edges', () => {
		expect(channelErrors(RENTE)).toEqual([]);
		expect(channelErrors([FINANCED_CHAIN])).toEqual([]);
	});

	it('names unknown nodes and arrows the map does not have', () => {
		expect(channelErrors(['qC>qFoo'])).toEqual(['unknown node qFoo in "qC>qFoo"']);
		expect(channelErrors(['pC>pBolig'])).toEqual(['no map edge pC>pBolig in "pC>pBolig"']);
	});
});

describe('the map', () => {
	it('uses each node once, and every edge joins two map nodes', () => {
		const keys = MAP_NODES.map((n) => n.key);
		expect(new Set(keys).size).toBe(keys.length);
		for (const [a, b] of MAP_EDGES) {
			expect(keys).toContain(a);
			expect(keys).toContain(b);
		}
	});

	it('gives each node its own cell', () => {
		const cells = MAP_NODES.map((n) => `${n.column},${n.row}`);
		expect(new Set(cells).size).toBe(cells.length);
	});
});

describe('nodeReading', () => {
	const values = [null, 0, -1, -2, -4, -3, -2];
	const at = { yearStart: 2028, firstYear: 2030, lastYear: 2034 };

	it('reads the scaled deviation at the year', () => {
		expect(nodeReading(values, { ...at, year: 2031, scale: 1 }).value).toBe(-2);
		expect(nodeReading(values, { ...at, year: 2031, scale: -0.5 }).value).toBe(1);
	});

	it('measures reach against the largest deviation from the shock year to the horizon', () => {
		expect(nodeReading(values, { ...at, year: 2031, scale: 1 }).reach).toBe(0.5);
		expect(nodeReading(values, { ...at, year: 2031, scale: -2 }).reach).toBe(0.5);
		expect(nodeReading(values, { ...at, year: 2032, scale: 1 }).reach).toBe(1);
	});

	it('has no value and no reach where the series is missing or flat', () => {
		expect(nodeReading(undefined, { ...at, year: 2032, scale: 1 })).toEqual({ value: null, reach: 0 });
		expect(nodeReading([0, 0, 0, 0, 0, 0, 0], { ...at, year: 2032, scale: 1 })).toEqual({ value: 0, reach: 0 });
	});
});

describe('shipped scenarios', () => {
	const dir = new URL('../../static/data/shocks/', import.meta.url);
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

	it.each(files)('%s has a channel the map can draw', (file) => {
		const scenario: Scenario = JSON.parse(readFileSync(new URL(file, dir), 'utf-8'));
		const channel = scenario.definition?.channel;
		expect(channel?.length, 'channel missing: re-run etl/extract.py').toBeGreaterThan(0);
		expect(channelErrors(channel!)).toEqual([]);
		for (const key of pathOf(channel!, scenario.variation).nodes) {
			expect(scenario.deviations[key], `${key} missing`).toBeDefined();
		}
	});
});
