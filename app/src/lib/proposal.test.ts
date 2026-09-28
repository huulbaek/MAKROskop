import { describe, expect, it } from 'vitest';
import type { Sizing } from './data';
import {
	PROPOSAL_KEYS, chainLineDa, proposalPackage, proposalQuery, verificationLineDa, type Proposal
} from './proposal';

const SIZING: Sizing = {
	year: 2030,
	vBNP: { '2024': 2800, '2025': 2900 },
	snL2030: 3000,
	staticSaldoPct: { Topskat: 0.05, Bundskat: 0.5, Offentligt_forbrug: -0.25 }
};

const BASE: Proposal = {
	id: 'test', titleDa: 'Testforslag', proposerDa: 'Regeringen', status: 'forslag', date: '2025-01-01',
	sources: [{ labelDa: 'Aftaletekst', url: 'https://fm.dk/a' }],
	elements: [{ shock: 'Topskat', labelDa: 'Lavere topskat', kr: -2.9, priceYear: 2025, source: 0 }],
	structural: { fte: 3000, source: 0 },
	financing: [{ shock: 'Offentligt_forbrug', labelDa: 'Mindre offentligt forbrug', kr: 2.9, priceYear: 2025, source: 0 }],
	omittedDa: [], revisions: []
};

describe('proposalPackage', () => {
	it('sizes each row by its static saldo effect in pct. of GDP', () => {
		const pkg = proposalPackage(BASE, SIZING);
		expect(pkg.problems).toEqual([]);
		// −2,9 mia. kr. of 2.900 = −0,1 pct. of GDP; Topskat ×1 = +0,05 → ×−2
		expect(pkg.components).toEqual([
			{ name: 'Topskat', scale: -2 },
			{ name: 'Arbejdsudbud_beskaeftigelse', scale: 0.1 },
			{ name: 'Offentligt_forbrug', scale: -0.4 }
		]);
	});
	it('sums elements that land on the same shock and keeps each in the chain', () => {
		const p: Proposal = { ...BASE, elements: [
			{ shock: 'Topskat', labelDa: 'Mellemskat', kr: 1.45, priceYear: 2025, source: 0, mappedDa: 'Mellemskatten regnes som topskat' },
			{ shock: 'Topskat', labelDa: 'Topskat', kr: -4.35, priceYear: 2025, source: 0 }
		] };
		const pkg = proposalPackage(p, SIZING);
		expect(pkg.components.filter((c) => c.name === 'Topskat')).toEqual([{ name: 'Topskat', scale: -2 }]);
		expect(pkg.chain.filter((r) => r.shock === 'Topskat').map((r) => r.scale)).toEqual([1, -3]);
	});
	it('reports problems instead of producing NaN scales', () => {
		const p: Proposal = { ...BASE, structural: null, elements: [
			{ shock: 'Rente', labelDa: 'Rente', kr: 1, priceYear: 2025, source: 0 },
			{ shock: 'Topskat', labelDa: 'Topskat', kr: 1, priceYear: 2021, source: 0 },
			{ shock: 'Topskat', labelDa: 'Topskat', kr: 1, priceYear: 2025, source: 3 }
		] };
		const { problems, components } = proposalPackage(p, SIZING);
		expect(problems).toHaveLength(4);
		expect(components.every((c) => Number.isFinite(c.scale))).toBe(true);
	});
	it('drops a zero structural estimate without a row', () => {
		const pkg = proposalPackage({ ...BASE, structural: { fte: 0, source: 0 } }, SIZING);
		expect(pkg.components.map((c) => c.name)).not.toContain('Arbejdsudbud_beskaeftigelse');
		expect(pkg.problems).toEqual([]);
	});
	it('reports a problem for a shock whose static saldo effect is zero, never an Infinity scale', () => {
		const p: Proposal = { ...BASE, elements: [
			{ shock: 'ZeroUnit', labelDa: 'Nulvirkning', kr: 1, priceYear: 2025, source: 0 }
		] };
		const sizing: Sizing = { ...SIZING, staticSaldoPct: { ...SIZING.staticSaldoPct, ZeroUnit: 0 } };
		const { problems, components } = proposalPackage(p, sizing);
		expect(problems).toHaveLength(1);
		expect(components.map((c) => c.name)).not.toContain('ZeroUnit');
		expect(components.every((c) => Number.isFinite(c.scale))).toBe(true);
	});
});

describe('proposalQuery', () => {
	it('is the package query, unfinanced', () => {
		expect(proposalQuery(BASE, SIZING)).toBe('Topskat=-2&Arbejdsudbud_beskaeftigelse=0.1&Offentligt_forbrug=-0.4&variant=_ufin');
	});
});

describe('card text', () => {
	it('words the conversion chain', () => {
		const [row] = proposalPackage(BASE, SIZING).chain;
		expect(chainLineDa(row)).toBe('Lavere topskat: −2,9 mia. kr. (2025) = −0,1 pct. af BNP → Topskat ×−2');
	});
	it('words the structural row', () => {
		const row = proposalPackage(BASE, SIZING).chain.find((r) => r.role === 'structural')!;
		expect(chainLineDa(row)).toBe('Strukturel virkning – Finansministeriets skøn: +3.000 fuldtidspersoner → Arbejdsudbud ×0,1');
	});
	it('words the verification gap', () => {
		expect(verificationLineDa(1.84)).toBe('Den lineære sum afviger højst 1,8 pct. fra en samlet modelkørsel af hele forslaget.');
	});
});

describe('PROPOSAL_KEYS', () => {
	it('is exactly the Proposal fields: no per-proposal override can sneak in', () => {
		expect([...PROPOSAL_KEYS].sort()).toEqual(Object.keys(BASE).sort());
	});
});
