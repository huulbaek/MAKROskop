/** Proposal presets (makroskop-48o): a published proposal's Finance Ministry figures turned into a
 *  package by one method for every proposal — see docs/superpowers/specs/2026-09-28-proposal-presets-design.md.
 *  kr is the static saldo effect in mia. kr. in the price year, positive = strengthens the balance. */

import type { ProposalCheck, Sizing } from './data';
import { formatSigned, formatValue } from './format';
import { formatScale, packageQuery, type PackageComponent } from './package';

export type ProposalStatus = 'vedtaget' | 'forslag';
export interface ProposalSource { labelDa: string; url: string }
export interface ProposalElement {
	shock: string;
	labelDa: string;
	kr: number;
	priceYear: number;
	/** Index into Proposal.sources. */
	source: number;
	/** Set when MAKRO lacks the element's own instrument and it is regnet on the nearest one. */
	mappedDa?: string;
}
export interface Proposal {
	id: string;
	titleDa: string;
	proposerDa: string;
	status: ProposalStatus;
	date: string;
	sources: ProposalSource[];
	elements: ProposalElement[];
	structural: { fte: number; source: number } | null;
	financing: ProposalElement[];
	omittedDa: string[];
	revisions: { date: string; noteDa: string }[];
}
export const PROPOSAL_KEYS: readonly string[] = [
	'id', 'titleDa', 'proposerDa', 'status', 'date', 'sources', 'elements', 'structural', 'financing',
	'omittedDa', 'revisions'
];

export interface ChainRow {
	role: 'element' | 'financing' | 'structural';
	shock: string;
	labelDa: string;
	kr: number | null;
	priceYear: number | null;
	gdpPct: number | null;
	fte: number | null;
	scale: number;
	mappedDa?: string;
}
export interface ProposalPackage { components: PackageComponent[]; chain: ChainRow[]; problems: string[] }

export const STRUCTURAL_SHOCK = 'Arbejdsudbud_beskaeftigelse';
export const PROPOSAL_VARIANT = '_ufin';

/** Scales are rounded to 4 decimals, so a query is stable and readable. */
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function proposalPackage(p: Proposal, sizing: Sizing): ProposalPackage {
	const problems: string[] = [];
	const chain: ChainRow[] = [];
	const sourceOk = (i: number, what: string) => {
		if (!Number.isInteger(i) || i < 0 || i >= p.sources.length) problems.push(`${what}: ukendt kilde ${i}`);
	};
	const sizeRow = (e: ProposalElement, role: 'element' | 'financing') => {
		sourceOk(e.source, e.labelDa);
		const gdp = sizing.vBNP[String(e.priceYear)];
		const unit = sizing.staticSaldoPct[e.shock];
		if (gdp == null) problems.push(`${e.labelDa}: prisår ${e.priceYear} findes ikke i BNP-tabellen`);
		if (unit == null || unit === 0) problems.push(`${e.labelDa}: ${e.shock} har ingen statisk provenuvirkning`);
		if (gdp == null || unit == null || unit === 0) return;
		const gdpPct = (e.kr / gdp) * 100;
		chain.push({ role, shock: e.shock, labelDa: e.labelDa, kr: e.kr, priceYear: e.priceYear, gdpPct,
			fte: null, scale: round4(gdpPct / unit), mappedDa: e.mappedDa });
	};
	for (const e of p.elements) sizeRow(e, 'element');
	if (p.structural == null) {
		problems.push('Finansministeriets skøn over den strukturelle beskæftigelse mangler');
	} else {
		sourceOk(p.structural.source, 'Strukturel virkning');
		if (p.structural.fte !== 0) {
			chain.push({ role: 'structural', shock: STRUCTURAL_SHOCK, labelDa: 'Strukturel virkning', kr: null,
				priceYear: null, gdpPct: null, fte: p.structural.fte,
				scale: round4(p.structural.fte / (0.01 * sizing.snL2030 * 1000)) });
		}
	}
	for (const e of p.financing) sizeRow(e, 'financing');

	const scales = new Map<string, number>();
	for (const row of chain) scales.set(row.shock, (scales.get(row.shock) ?? 0) + row.scale);
	const components = [...scales]
		.map(([name, scale]) => ({ name, scale: round4(scale) }))
		.filter((c) => c.scale !== 0);
	return { components, chain, problems };
}

export function proposalQuery(p: Proposal, sizing: Sizing): string {
	return packageQuery(proposalPackage(p, sizing).components, PROPOSAL_VARIANT);
}

const SHOCK_SHORT: Record<string, string> = { [STRUCTURAL_SHOCK]: 'Arbejdsudbud' };
const minus = (s: string) => s.replace('-', '−');

export function chainLineDa(row: ChainRow): string {
	const target = `${SHOCK_SHORT[row.shock] ?? row.shock.replaceAll('_', ' ')} ×${minus(formatScale(row.scale))}`;
	if (row.role === 'structural') {
		return `Strukturel virkning – Finansministeriets skøn: ${formatSigned(row.fte ?? 0)} fuldtidspersoner → ${target}`;
	}
	return `${row.labelDa}: ${minus(formatSigned(row.kr ?? 0))} mia. kr. (${row.priceYear}) = ${minus(formatSigned(row.gdpPct ?? 0))} pct. af BNP → ${target}`;
}

export function verificationLineDa(maxGapPct: number): string {
	return `Den lineære sum afviger højst ${formatValue(Math.round(maxGapPct * 10) / 10)} pct. fra en samlet modelkørsel af hele forslaget.`;
}

export function statusDa(status: ProposalStatus): string {
	return status === 'vedtaget' ? 'Vedtaget' : 'Forslag';
}

export const MAX_GAP_PCT = 10;

/** Listed and prerendered only when the joint solve is of the current query and agrees within 10 %. */
export function isPublishable(p: Proposal, sizing: Sizing, checks: Record<string, ProposalCheck>): boolean {
	const check = checks[p.id];
	return check != null && check.query === proposalQuery(p, sizing) && check.maxGapPct <= MAX_GAP_PCT
		&& proposalPackage(p, sizing).problems.length === 0;
}
