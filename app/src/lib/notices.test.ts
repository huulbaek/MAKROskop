import { describe, expect, it } from 'vitest';
import { RECOMPUTING } from './notices';
import { countWord } from './frontpage';
import { readMeta } from './server/scenarios';

describe('RECOMPUTING', () => {
	it('flags both VAT shocks until the proportional re-solve lands (makroskop-gnp.2)', () => {
		expect(Object.keys(RECOMPUTING).sort()).toEqual(['Moms', 'Moms_ned']);
	});

	it('names only shocks in the catalog', () => {
		const names = new Set(readMeta().shocks.map((s) => s.name));
		for (const name of Object.keys(RECOMPUTING)) expect(names.has(name), name).toBe(true);
	});
});

describe('countWord', () => {
	it('spells small counts in Danish, capitalised', () => {
		expect([countWord(5), countWord(6)]).toEqual(['Fem', 'Seks']);
	});
});
