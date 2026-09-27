/** Compare mode on the scenario page (makroskop-q43): the financed (_perm) and unfinanced
 *  (_ufin) runs of one shock drawn together, because the financing choice is usually the
 *  whole policy story. The two runs differ only in the closure: the financed one moves the
 *  closure tax (tLukning), so that is what the one-line explanation names. */
import { CLOSURE_TAX_DA } from './answer';
import { formatTileValue } from './card';
import type { Scenario, ScenarioDefinition } from './data';
import { formatValue } from './format';

/** The other permanent variant, or null for the temporary profiles (they have no financed twin). */
export function partnerVariation(variation: string): '_perm' | '_ufin' | null {
	if (variation === '_ufin') return '_perm';
	if (variation === '_perm') return '_ufin';
	return null;
}

/** The variant part of an export filename in compare mode. */
export const compareFilenameVariant = '_ufin_og_perm';

/** "Forskellen er finansieringen: den finansierede variant sænker samtidig lukkeskatten … med
 *  2,13 pct.-point. Efter 3 år er BNP +0,01 pct. finansieret mod −0,2 pct. ufinansieret."
 *  Scaled with the slider; BNP in year 3 and rounded as the tiles. null when a series is missing. */
export function financingLine(input: {
	ufin: Pick<Scenario, 'deviations'>;
	perm: Pick<Scenario, 'deviations'>;
	yearStart: number;
	firstYear: number;
	scale: number;
}): string | null {
	const { ufin, perm, yearStart, firstYear, scale } = input;
	const at = (s: Pick<Scenario, 'deviations'>, key: string, year: number) => {
		const value = s.deviations[key]?.[year - yearStart];
		return value == null ? null : value * scale;
	};
	const tax = at(perm, 'tLukning', firstYear);
	const gdpPerm = at(perm, 'qBNP', firstYear + 2);
	const gdpUfin = at(ufin, 'qBNP', firstYear + 2);
	if (tax == null || gdpPerm == null || gdpUfin == null) return null;

	const rounded = roundedTax(tax);
	const closure =
		rounded === 0
			? 'den finansierede variant kræver ingen nævneværdig ændring af lukkeskatten.'
			: `den finansierede variant ${rounded > 0 ? 'hæver' : 'sænker'} samtidig ${CLOSURE_TAX_DA} med ${formatValue(Math.abs(rounded))} pct.-point.`;
	return (
		`Forskellen er finansieringen: ${closure} ` +
		`Efter 3 år er BNP ${formatTileValue(gdpPerm)} pct. finansieret mod ${formatTileValue(gdpUfin)} pct. ufinansieret.`
	);
}

/** The lukkeskat move as both lines state it: 2 decimals, and 0 means "no noticeable change". */
function roundedTax(tax: number): number {
	return Math.round(tax * 100) / 100;
}

/** The Finansiering row's lukkeskat for a financed run (makroskop-gnp.8), scaled with the slider:
 *  "I denne beregning sænker lukkeskatten husholdningernes direkte skatter med 2,13 pct.-point –
 *  ca. 0,55 pct. af BNP i 2030." Same units and rounding as financingLine. null without the series. */
export function closureTaxLine(input: {
	perm: Pick<Scenario, 'deviations'> & {
		definition?: Pick<ScenarioDefinition, 'firstYear' | 'lukningShare'> | null;
	};
	yearStart: number;
	scale: number;
}): string | null {
	const { perm, yearStart, scale } = input;
	const firstYear = perm.definition?.firstYear;
	const value = firstYear == null ? null : perm.deviations.tLukning?.[firstYear - yearStart];
	if (value == null) return null;
	const rounded = roundedTax(value * scale);
	if (rounded === 0) return 'I denne beregning kræver finansieringen ingen nævneværdig ændring af lukkeskatten.';

	const move = `I denne beregning ${rounded > 0 ? 'hæver' : 'sænker'} lukkeskatten husholdningernes direkte skatter med ${formatValue(Math.abs(rounded))} pct.-point`;
	const share = perm.definition?.lukningShare;
	if (share == null) return `${move}.`;
	const size = Math.abs(share * scale);
	return `${move} – ${size < 0.005 ? 'under 0,01' : `ca. ${formatValue(size >= 1 ? Math.round(size * 10) / 10 : Math.round(size * 100) / 100)}`} pct. af BNP i ${firstYear}.`;
}
