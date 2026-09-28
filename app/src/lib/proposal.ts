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
	/** Set when kr is a share of one source figure: kr = fraction × of (e.g. { of: 6.7, fractionDa: '1/3' }),
	 *  so the card can show the figure the source prints. */
	split?: { of: number; fractionDa: string };
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
	split?: { of: number; fractionDa: string };
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
			fte: null, scale: round4(gdpPct / unit), mappedDa: e.mappedDa, split: e.split });
	};
	for (const e of p.elements) sizeRow(e, 'element');
	if (p.structural == null) {
		problems.push('Finansministeriets skøn over den strukturelle beskæftigelse mangler');
	} else {
		sourceOk(p.structural.source, 'Strukturel virkning');
		if (p.structural.fte !== 0) {
			chain.push({ role: 'structural', shock: STRUCTURAL_SHOCK, labelDa: 'Strukturel virkning', kr: null,
				priceYear: null, gdpPct: null, fte: p.structural.fte,
				scale: round4(p.structural.fte / (0.01 * sizing.snLHh2030 * 1000)) });
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
const signed = (s: string, value: number) => minus((value > 0 ? '+' : '') + s);

const daKr = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
const daSig3 = new Intl.NumberFormat('da-DK', { maximumSignificantDigits: 3 });

/** Mia. kr. at the source's own precision: −6,8, −0,215, +1,0. */
export function formatKrDa(kr: number): string {
	return signed(daKr.format(kr), kr);
}

/** Pct. of GDP with 3 significant digits, so a chain step can be recomputed from what is shown. */
export function formatPctDa(pct: number): string {
	return signed(daSig3.format(pct), pct);
}

/** '1/3' → 1/3, '2/3' → 2/3. */
export function splitFraction(fractionDa: string): number {
	const [num, den] = fractionDa.split('/').map(Number);
	return num / den;
}

/** One conversion step in words. `labels` (catalog name → labelDa, from meta.shocks) names the
 *  target shock as the catalog does; without it the shock name stands in. */
export function chainLineDa(row: ChainRow, labels?: Record<string, string>): string {
	const name = labels?.[row.shock] ?? SHOCK_SHORT[row.shock] ?? row.shock.replaceAll('_', ' ');
	const target = `${name} ×${minus(formatScale(row.scale))}`;
	if (row.role === 'structural') {
		return `Strukturel virkning – Finansministeriets skøn: ${formatSigned(row.fte ?? 0)} fuldtidspersoner → ${target}`;
	}
	const kr = row.split
		? `${row.split.fractionDa} af ${minus(daKr.format(row.split.of))}`
		: formatKrDa(row.kr ?? 0);
	return `${row.labelDa}: ${kr} mia. kr. (${row.priceYear}) = ${formatPctDa(row.gdpPct ?? 0)} pct. af BNP → ${target}`;
}

export function verificationLineDa(maxGapPct: number): string {
	return `Den lineære sum afviger højst ${formatValue(Math.round(maxGapPct * 10) / 10)} pct. fra en samlet modelkørsel af hele forslaget.`;
}

const MONTHS_DA = [
	'januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'
];

/** `2023-12-14` → `14. december 2023`, the same on the server and in every browser. */
export function proposalDateDa(iso: string): string {
	const [year, month, day] = iso.split('-').map(Number);
	return `${day}. ${MONTHS_DA[month - 1]} ${year}`;
}

/** The forslag page's meta description: what was sized, and only the parts the proposal has. */
export function proposalDescriptionDa(p: Proposal, sizing: Sizing): string {
	const chain = proposalPackage(p, sizing).chain;
	const sized = chain.filter((r) => r.role === 'element').length;
	const financing = chain.filter((r) => r.role === 'financing').length;
	const structural = chain.some((r) => r.role === 'structural');
	// Financing rows are the proposal's own financing figure (after tilbageløb og adfærd), not a
	// static revenue, so they are named apart from the elements.
	const extras = [
		...(financing > 0 ? [`forslagets egen finansiering (${financing} ${financing === 1 ? 'række' : 'rækker'})`] : []),
		...(structural ? ['Finansministeriets skøn over den strukturelle beskæftigelse'] : [])
	];
	return (
		`${p.titleDa} (${p.proposerDa}) regnet i MAKRO med samme metode som alle forslag: ` +
		`${sized} ${sized === 1 ? 'element' : 'elementer'} sat i størrelse efter ${sized === 1 ? 'dets' : 'deres'} statiske provenu` +
		(extras.length ? `, plus ${extras.join(' og ')}` : '') +
		'. Regnet uden lukkeskat.'
	);
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

export interface PresetState { proposal: Proposal; edited: boolean }

/** The package query (packageQuery form) against the proposal it was opened from. Any difference —
 *  a scale, a row, the closure — makes it an edited package that no longer carries the name. */
export function presetState(query: string, proposalId: string | null, sizing: Sizing,
	proposals: Proposal[]): PresetState | null {
	const proposal = proposalId ? proposals.find((p) => p.id === proposalId) : undefined;
	if (!proposal) return null;
	return { proposal, edited: query !== proposalQuery(proposal, sizing) };
}

/** The line exports lead with while the package is the proposal itself; an edited package is anonymous. */
export function exportTitle(state: PresetState | null): string | null {
	return state && !state.edited ? `Forslag: ${state.proposal.titleDa} (${state.proposal.proposerDa})` : null;
}

/** The proposals the page lists and prerenders: the publishable ones, oldest first. */
export function listedProposals(proposals: Proposal[], sizing: Sizing, checks: Record<string, ProposalCheck>): Proposal[] {
	return proposals.filter((p) => isPublishable(p, sizing, checks)).sort((a, b) => a.date.localeCompare(b.date));
}
