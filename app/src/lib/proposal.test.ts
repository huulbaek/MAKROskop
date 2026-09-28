import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Sizing } from './data';
import {
	exportTitle, isPublishable, listedProposals, presetState, PROPOSAL_KEYS, chainLineDa, proposalDateDa,
	proposalDescriptionDa, proposalPackage, proposalQuery, verificationLineDa, type Proposal
} from './proposal';
import { PROPOSALS } from './proposals';

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

const meta = JSON.parse(readFileSync('static/data/meta.json', 'utf8'));

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
	it('uses the catalog labels when given, the shock name otherwise', () => {
		const [row, structural, financing] = proposalPackage(BASE, SIZING).chain;
		const labels = { Topskat: 'Topskat', Offentligt_forbrug: 'Offentligt forbrug', Arbejdsudbud_beskaeftigelse: 'Arbejdsudbud (beskæftigelse)' };
		expect(chainLineDa(row, labels)).toBe('Lavere topskat: −2,9 mia. kr. (2025) = −0,1 pct. af BNP → Topskat ×−2');
		expect(chainLineDa(financing, labels)).toBe('Mindre offentligt forbrug: +2,9 mia. kr. (2025) = +0,1 pct. af BNP → Offentligt forbrug ×−0,4');
		expect(chainLineDa(structural, labels)).toBe('Strukturel virkning – Finansministeriets skøn: +3.000 fuldtidspersoner → Arbejdsudbud (beskæftigelse) ×0,1');
		expect(chainLineDa(financing, {})).toBe('Mindre offentligt forbrug: +2,9 mia. kr. (2025) = +0,1 pct. af BNP → Offentligt forbrug ×−0,4');
	});
	it('words the date in Danish', () => {
		expect(proposalDateDa('2023-12-14')).toBe('14. december 2023');
		expect(proposalDateDa('2025-01-01')).toBe('1. januar 2025');
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

describe('PROPOSALS', () => {
	it('is non-empty, ordered by date and has unique ids', () => {
		expect(PROPOSALS.length).toBeGreaterThan(0);
		expect(PROPOSALS.map((p) => p.date)).toEqual([...PROPOSALS.map((p) => p.date)].sort());
		expect(new Set(PROPOSALS.map((p) => p.id)).size).toBe(PROPOSALS.length);
	});
	for (const p of PROPOSALS) {
		it(`${p.id}: the same method, with a source for every figure`, () => {
			expect(Object.keys(p).sort()).toEqual([...PROPOSAL_KEYS].sort());
			expect(p.sources.every((s) => s.url.startsWith('https://'))).toBe(true);
			expect(proposalPackage(p, meta.sizing).problems).toEqual([]);
		});
	}
});

describe('isPublishable', () => {
	const check = { query: proposalQuery(BASE, SIZING), gapPct: {}, maxGapPct: 2, exported: '2026-10-01' };
	it('needs a current, agreeing joint solve', () => {
		expect(isPublishable(BASE, SIZING, { test: check })).toBe(true);
		expect(isPublishable(BASE, SIZING, {})).toBe(false);
		expect(isPublishable(BASE, SIZING, { test: { ...check, query: 'Topskat=-1&variant=_ufin' } })).toBe(false);
		expect(isPublishable(BASE, SIZING, { test: { ...check, maxGapPct: 10.5 } })).toBe(false);
	});
	it('every shipped proposal is publishable', () => {
		const checks = JSON.parse(readFileSync('static/data/proposals.json', 'utf8'));
		for (const p of PROPOSALS) expect(isPublishable(p, meta.sizing, checks), p.id).toBe(true);
	});
});

describe('presetState', () => {
	const PROPS = [BASE];
	const q = proposalQuery(BASE, SIZING);
	it('is the proposal, unedited, when the package is its query', () => {
		expect(presetState(q, 'test', SIZING, PROPS)).toEqual({ proposal: BASE, edited: false });
	});
	it('is edited after any change: scale, row, closure', () => {
		expect(presetState(q.replace('Topskat=-2', 'Topskat=-1'), 'test', SIZING, PROPS)?.edited).toBe(true);
		expect(presetState(q.replace('Arbejdsudbud_beskaeftigelse=0.1&', ''), 'test', SIZING, PROPS)?.edited).toBe(true);
		expect(presetState(q.replace('_ufin', '_perm'), 'test', SIZING, PROPS)?.edited).toBe(true);
	});
	it('is null for an unknown or missing id', () => {
		expect(presetState(q, 'nope', SIZING, PROPS)).toBeNull();
		expect(presetState(q, null, SIZING, PROPS)).toBeNull();
	});
});
describe('exportTitle', () => {
	it('names the proposal only while unedited', () => {
		expect(exportTitle({ proposal: BASE, edited: false })).toBe('Forslag: Testforslag (Regeringen)');
		expect(exportTitle({ proposal: BASE, edited: true })).toBeNull();
		expect(exportTitle(null)).toBeNull();
	});
});

describe('proposalDescriptionDa', () => {
	it('counts the sized rows and names only the parts the proposal has', () => {
		expect(proposalDescriptionDa(BASE, SIZING)).toBe(
			'Testforslag (Regeringen) regnet i MAKRO med samme metode som alle forslag: 2 elementer sat i størrelse ' +
				'efter deres statiske provenu, heraf 1 til finansiering, plus Finansministeriets skøn over den strukturelle ' +
				'beskæftigelse. Regnet uden lukkeskat.'
		);
	});
	it('leaves out financing and the structural estimate when there are none', () => {
		const bare = { ...BASE, financing: [], structural: null };
		expect(proposalDescriptionDa(bare, SIZING)).toBe(
			'Testforslag (Regeringen) regnet i MAKRO med samme metode som alle forslag: 1 element sat i størrelse ' +
				'efter dets statiske provenu. Regnet uden lukkeskat.'
		);
		expect(proposalDescriptionDa({ ...BASE, structural: { fte: 0, source: 0 } }, SIZING)).not.toContain('strukturelle');
	});
});

describe('listedProposals', () => {
	it('keeps the publishable ones, oldest first, whatever the array order', () => {
		const check = { query: proposalQuery(BASE, SIZING), gapPct: {}, maxGapPct: 2, exported: '2026-10-01' };
		const later = { ...BASE, id: 'later', date: '2026-03-01' };
		const hidden = { ...BASE, id: 'hidden', date: '2024-01-01' };
		const checks = { test: check, later: check };
		expect(listedProposals([later, hidden, BASE], SIZING, checks).map((p) => p.id)).toEqual(['test', 'later']);
	});
});
