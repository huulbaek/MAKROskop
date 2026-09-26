import { describe, expect, it } from 'vitest';
import { compareFilenameVariant, financingLine, partnerVariation } from './compare';
import { readMeta, readScenario } from './server/scenarios';

const YEAR_START = 2025;

function series(values: Record<number, number>): (number | null)[] {
	return Array.from({ length: 20 }, (_, i) => values[YEAR_START + i] ?? 0);
}

function pair(ufinGdp: number, permGdp: number, tLukning: number) {
	return {
		ufin: { deviations: { qBNP: series({ 2032: ufinGdp }), tLukning: series({}) } },
		perm: { deviations: { qBNP: series({ 2032: permGdp }), tLukning: series({ 2030: tLukning, 2031: tLukning }) } }
	};
}

describe('partnerVariation', () => {
	it('pairs the two permanent variants, both ways', () => {
		expect(partnerVariation('_ufin')).toBe('_perm');
		expect(partnerVariation('_perm')).toBe('_ufin');
	});

	it('has no partner for the temporary profiles', () => {
		expect(partnerVariation('_midl')).toBeNull();
		expect(partnerVariation('_blip')).toBeNull();
	});
});

describe('financingLine', () => {
	const base = { yearStart: YEAR_START, firstYear: 2030, scale: 1 };

	it('names the closure-tax move and sets the two BNP effects side by side', () => {
		expect(financingLine({ ...pair(-0.2, 0.01, -2.1258), ...base })).toBe(
			'Forskellen er finansieringen: den finansierede variant sænker samtidig lukkeskatten – et beregningsteknisk ' +
				'tillæg til husholdningernes direkte skatter – med 2,13 pct.-point. Efter 3 år er BNP +0,01 pct. ' +
				'finansieret mod −0,2 pct. ufinansieret.'
		);
	});

	it('says a raise as a raise', () => {
		expect(financingLine({ ...pair(0.1, -0.05, 1.34), ...base })).toContain('hæver samtidig lukkeskatten');
	});

	it('scales and mirrors with the slider', () => {
		const line = financingLine({ ...pair(-0.2, 0.01, -2.1258), ...base, scale: -0.5 });
		expect(line).toContain('hæver samtidig lukkeskatten');
		expect(line).toContain('med 1,06 pct.-point');
		expect(line).toContain('BNP −0,01 pct. finansieret mod +0,1 pct. ufinansieret');
	});

	it('says a negligible closure-tax move as such', () => {
		expect(financingLine({ ...pair(0.1, 0.1, 0.001), ...base })).toContain(
			'den finansierede variant kræver ingen nævneværdig ændring af lukkeskatten'
		);
	});

	it('is null when a series is missing', () => {
		const p = pair(0.1, 0.1, 1);
		delete (p.perm.deviations as Record<string, unknown>).tLukning;
		expect(financingLine({ ...p, ...base })).toBeNull();
	});
});

describe('compareFilenameVariant', () => {
	it('marks a comparison export in the filename', () => {
		expect(compareFilenameVariant).toBe('_ufin_og_perm');
	});
});

describe('published pairs', () => {
	it('every shock solved in one permanent variant is solved in both', () => {
		for (const shock of readMeta().shocks) {
			const permanent = shock.available.filter((v) => partnerVariation(v) != null);
			if (permanent.length) expect(permanent.sort(), shock.name).toEqual(['_perm', '_ufin']);
		}
	});

	it('explains the financed Bundskat against the unfinanced one', () => {
		const line = financingLine({
			ufin: readScenario('Bundskat_ufin'), perm: readScenario('Bundskat_perm'),
			yearStart: readMeta().yearStart, firstYear: 2030, scale: 1
		});
		expect(line).toMatch(/sænker samtidig lukkeskatten .* med 2,13 pct\.-point\. Efter 3 år er BNP \+0,01 pct\. finansieret mod −0,2 pct\. ufinansieret\.$/);
	});
});
