import { describe, expect, it } from 'vitest';
import { closureTaxLine, compareFilenameVariant, financingLine, partnerVariation } from './compare';
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

describe('closureTaxLine', () => {
	const financed = (tLukning: number, lukningShare: number | null) => ({
		deviations: { tLukning: series({ 2030: tLukning }) },
		definition: { firstYear: 2030, lukningShare }
	});
	const base = { yearStart: YEAR_START, scale: 1 };

	it('states the lukkeskat in the units of the compare line, with its share of BNP', () => {
		expect(closureTaxLine({ perm: financed(-2.1258, -0.5513), ...base })).toBe(
			'I denne beregning sænker lukkeskatten husholdningernes direkte skatter med 2,13 pct.-point – ca. 0,55 pct. af BNP i 2030.'
		);
	});

	it('scales and mirrors with the slider', () => {
		const line = closureTaxLine({ perm: financed(-2.1258, -0.5513), ...base, scale: -2 });
		expect(line).toContain('hæver lukkeskatten husholdningernes direkte skatter med 4,25 pct.-point');
		expect(line).toContain('ca. 1,1 pct. af BNP');
	});

	it('says a negligible move as such, as the compare line does', () => {
		expect(closureTaxLine({ perm: financed(0.003, 0.0008), ...base })).toBe(
			'I denne beregning kræver finansieringen ingen nævneværdig ændring af lukkeskatten.'
		);
	});

	it('says a small share as under 0,01 pct.', () => {
		expect(closureTaxLine({ perm: financed(0.019, 0.0048), ...base })).toContain('– under 0,01 pct. af BNP i 2030.');
	});

	it('leaves the share out when the data has none, and is null without the lukkeskat', () => {
		expect(closureTaxLine({ perm: financed(-2.1258, null), ...base })).toBe(
			'I denne beregning sænker lukkeskatten husholdningernes direkte skatter med 2,13 pct.-point.'
		);
		expect(closureTaxLine({ perm: { deviations: {}, definition: { firstYear: 2030 } }, ...base })).toBeNull();
	});

	it('agrees with the shipped financed Bundskat', () => {
		const perm = readScenario('Bundskat_perm');
		expect(closureTaxLine({ perm, yearStart: readMeta().yearStart, scale: 1 })).toBe(
			'I denne beregning sænker lukkeskatten husholdningernes direkte skatter med 2,13 pct.-point – ca. 0,55 pct. af BNP i 2030.'
		);
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
