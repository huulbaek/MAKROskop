/** Compare mode on the scenario page (makroskop-q43): the financed (_perm) and unfinanced
 *  (_ufin) runs of one shock drawn together, because the financing choice is usually the
 *  whole policy story. The two runs differ only in the closure: the financed one moves the
 *  closure tax (tLukning), so that is what the one-line explanation names. */
import { CLOSURE_TAX_DA } from './answer';
import { formatTileValue } from './card';
import type { Scenario } from './data';
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

	const rounded = Math.round(tax * 100) / 100;
	const closure =
		rounded === 0
			? 'den finansierede variant kræver ingen nævneværdig ændring af lukkeskatten.'
			: `den finansierede variant ${rounded > 0 ? 'hæver' : 'sænker'} samtidig ${CLOSURE_TAX_DA} med ${formatValue(Math.abs(rounded))} pct.-point.`;
	return (
		`Forskellen er finansieringen: ${closure} ` +
		`Efter 3 år er BNP ${formatTileValue(gdpPerm)} pct. finansieret mod ${formatTileValue(gdpUfin)} pct. ufinansieret.`
	);
}
