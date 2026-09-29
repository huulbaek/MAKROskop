/** Share-card content for one scenario view (shock, closure variant, scale): the copy behind
 *  <title>, the meta description and the og:image, the three headline tiles the page shows,
 *  and the view's URL and image names. Pure and alias-free (relative imports only) so
 *  `scripts/og-images.ts` — bun, outside SvelteKit — computes exactly what the pages carry.
 *  Wording rules: docs/superpowers/specs/2026-09-10-share-cards-design.md. */
import type { Meta, Scenario, ScenarioDefinition, ShockMeta } from './data';
import { signedDa } from './format';

/** Slider steps offered for every solved scenario. Negative steps mirror the shock. */
export const ALL_SCALE_STEPS = [-1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** Steps a scenario allows: a catalog cap (`definition.maxScale`) trims the magnitude. */
export function scaleSteps(maxScale: number | null | undefined): number[] {
	const steps = maxScale == null ? ALL_SCALE_STEPS : ALL_SCALE_STEPS.filter((s) => Math.abs(s) <= maxScale);
	return steps.includes(1) ? steps : [...steps, 1].sort((a, b) => a - b);
}

export interface SolvedScenario {
	shock: ShockMeta;
	variation: string;
	/** the scenario file stem, `<name><variation>` */
	file: string;
}

/** Every solved scenario the catalog lists, in catalog order. */
export function solvedScenarios(meta: Pick<Meta, 'shocks'>): SolvedScenario[] {
	return meta.shocks.flatMap((shock) =>
		shock.available.map((variation) => ({ shock, variation, file: `${shock.name}${variation}` }))
	);
}

/** Every view that gets a page and an image: each solved scenario at each allowed step. */
export function solvedViews(
	meta: Pick<Meta, 'shocks'>, maxScales: Record<string, number | null>
): (SolvedScenario & { scale: number })[] {
	return solvedScenarios(meta).flatMap((solved) =>
		scaleSteps(maxScales[solved.file]).map((scale) => ({ ...solved, scale }))
	);
}

export interface CardLevels {
	/** baseline structural employment in the shock year, thousand persons */
	nL: number;
	/** baseline nominal GDP in the shock year, mia. kr. */
	vBNP: number;
}

export interface CardTile {
	key: 'nL' | 'qBNP' | 'saldo2bnp';
	label: string;
	/** year counted from the shock year (1 = the shock year) */
	year: number;
	/** formatted, or null when the series or the levels are missing */
	value: string | null;
	unit: string;
}

const TILE_WORD: Record<CardTile['key'], string> = { nL: 'beskæftigelse', qBNP: 'BNP', saldo2bnp: 'offentlig saldo' };

/** The tiles in words for page and card descriptions ("BNP −0,6 pct. efter 3 år"); null where a
 *  value is missing. Each caller picks its own order. */
export function tilePhrases(tiles: CardTile[]): Record<CardTile['key'], string | null> {
	const phrases = { nL: null, qBNP: null, saldo2bnp: null } as Record<CardTile['key'], string | null>;
	for (const t of tiles) {
		if (t.value == null) continue;
		const when = t.key === 'qBNP' ? `efter ${t.year} år` : `i år ${t.year}`;
		phrases[t.key] = `${TILE_WORD[t.key]} ${t.value} ${t.unit} ${when}`;
	}
	return phrases;
}

export interface CardData {
	name: string;
	variation: string;
	scale: number;
	path: string;
	image: string;
	title: string;
	description: string;
	imageAlt: string;
	headline: string;
	subline: string;
	kicker: string;
	closure: string;
	tiles: CardTile[];
	/** qBNP deviation in years 0..15 after the shock, scaled */
	sparkline: (number | null)[];
	model: string;
}

/** What a prerendered view page hands the layout and the explorer. */
export interface CardHead {
	title: string;
	description: string;
	imageAlt: string;
	image: string;
	url: string;
	initial: { name: string; variation: string; scale: number };
	tiles: CardTile[];
	/** The view's answer sentence (answer.ts), shown until the scenario JSON has loaded. */
	answer: { lead: string; body: string };
}

const MINUS = '−';
const da1 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const da2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const da0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const daScale = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 });

const signed = signedDa;

/** One decimal from 0.1 upwards, two below; signed; true minus. */
export function formatTileValue(value: number): string {
	return signed((Math.abs(value) >= 0.1 ? da1 : da2).format(value), value);
}

/** Persons: nearest 100, nearest 10 below a thousand. */
export function formatPersons(value: number): string {
	const unit = Math.abs(value) >= 1000 ? 100 : 10;
	const rounded = Math.round(value / unit) * unit;
	return signed(da0.format(rounded), rounded);
}

/** The scale as a bare Danish number with the true minus ("0,5", "−1"). */
export function formatScale(scale: number): string {
	return daScale.format(scale).replace('-', MINUS);
}

/** Up to three decimals: the smallest size times the smallest step (0,1 × 0,25) stays exact. */
const daChange = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 3 });

/** The shock size in the instrument's own unit at a slider scale, as the catalog words it
 *  (etl/catalog.py change_display): "+0,5 pct.-point", "+5 mia. kr. årligt (2020-niveau)". */
export function changeText(def: Pick<ScenarioDefinition, 'changeSize' | 'changeUnitDa'>, scale: number): string {
	const size = def.changeSize * scale;
	return `${size > 0 ? '+' : ''}${daChange.format(size).replace('-', MINUS)} ${def.changeUnitDa}`;
}

export const PROFILE_WORD: Record<string, string> = { _perm: 'varigt', _ufin: 'varigt', _midl: 'midlertidigt', _blip: 'i ét år' };
const PROFILE_SUBLINE: Record<string, string> = {
	_perm: 'Varigt stød', _ufin: 'Varigt stød', _midl: 'Midlertidigt stød (AR-profil)', _blip: '1-årigt stød'
};
const MAX_INSTRUMENT_CHARS = 24;

/** What the headline says moved: the catalog's shortDa where it has one (e.g. Loen, whose catalog
 *  label names the workers' side while the instrument is the employers' weight), else the model's
 *  own label when it is short, else the catalog name. */
export function cardSubject(shock: Pick<ShockMeta, 'labelDa'>, def: Pick<ScenarioDefinition, 'instrumentDa' | 'shortDa'>): string {
	return def.shortDa ?? (def.instrumentDa.length <= MAX_INSTRUMENT_CHARS ? def.instrumentDa : shock.labelDa);
}

export function closureWord(variation: string): string {
	return variation === '_perm' ? 'finansieret via lukkeskat' : 'ufinansieret';
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

export function viewPath(name: string, variation: string, scale: number): string {
	return `/scenarier/${name}${variation}/${scale === 1 ? '' : `${scale}/`}`;
}

export function imageFile(name: string, variation: string, scale: number): string {
	return `${name}${variation}${scale === 1 ? '' : `_${scale}`}.png`;
}

/** The `[[skala]]` route param: absent = solved size; otherwise a canonical, allowed step. */
export function parseSkala(param: string | undefined): number | null {
	if (param === undefined) return 1;
	const value = Number(param);
	if (!Number.isFinite(value) || String(value) !== param || value === 1) return null;
	return ALL_SCALE_STEPS.includes(value) ? value : null;
}

/** `Offentligt_forbrug_ufin` → name + variation suffix; shock names may contain underscores. */
export function splitView(param: string, suffixes: string[]): { name: string; variation: string } | null {
	for (const variation of suffixes) {
		if (param.endsWith(variation) && param.length > variation.length) {
			return { name: param.slice(0, -variation.length), variation };
		}
	}
	return null;
}

/** The prerender entry list: one `{ scenario, skala? }` per view (`skala` absent at the solved size). */
export function shareViews(
	meta: Pick<Meta, 'shocks'>, maxScales: Record<string, number | null>
): { scenario: string; skala?: string }[] {
	return solvedViews(meta, maxScales).map(({ file, scale }) =>
		scale === 1 ? { scenario: file } : { scenario: file, skala: String(scale) }
	);
}

/** Scaled deviation of a series in a calendar year, null where the series has no value. */
function deviationAt(scenario: Pick<Scenario, 'deviations'>, yearStart: number, scale: number) {
	return (key: string, year: number): number | null => {
		const value = scenario.deviations[key]?.[year - yearStart];
		return value == null ? null : value * scale;
	};
}

export interface TileInput {
	scenario: Pick<Scenario, 'deviations'>;
	definition: Pick<ScenarioDefinition, 'firstYear'>;
	yearStart: number;
	levels: CardLevels | null;
	scale: number;
	/** Read all three figures at this year (the explorer's scrubber); levels must be that year's. */
	year?: number | null;
}

/** The three fixed headline figures, in layout order: Beskæftigelse år 1 (persons), BNP år 3,
 *  Offentlig saldo år 1. Cheap enough for the page to recompute on every slider step. */
export function cardTiles({ scenario, definition, yearStart, levels, scale, year }: TileInput): CardTile[] {
	const at = deviationAt(scenario, yearStart, scale);
	const y1 = definition.firstYear;
	// The share card's years (år 1 / år 3), unless the reader scrubbed to one year.
	const first = year ?? y1;
	const third = year ?? y1 + 2;
	const nth = (y: number) => y - y1 + 1;
	const employment = at('nL', first);
	const gdp = at('qBNP', third);
	const balance = at('saldo2bnp', first);
	return [
		{ key: 'nL', label: 'Beskæftigelse', year: nth(first), unit: 'personer',
			value: employment == null || levels == null ? null : formatPersons((employment / 100) * levels.nL * 1000) },
		{ key: 'qBNP', label: 'BNP', year: nth(third), unit: 'pct.', value: gdp == null ? null : formatTileValue(gdp) },
		{ key: 'saldo2bnp', label: 'Offentlig saldo', year: nth(first), unit: 'pct. af BNP', value: balance == null ? null : formatTileValue(balance) }
	];
}

export function buildCard(input: {
	shock: ShockMeta; scenario: Scenario; definition: ScenarioDefinition; yearStart: number; modelName: string;
	levels: CardLevels | null; scale: number;
}): CardData {
	const { shock, scenario, definition: def, yearStart, levels, scale } = input;
	const at = deviationAt(scenario, yearStart, scale);
	const y1 = def.firstYear;
	const tiles = cardTiles({ scenario, definition: def, yearStart, levels, scale });
	const bnp = tiles[1];

	const instrument = cardSubject(shock, def);
	const change = changeText(def, scale);
	const headline = `${instrument} ${change}`;
	const subline = PROFILE_SUBLINE[scenario.variation] ?? 'Varigt stød';
	const closure = closureWord(scenario.variation);
	const question = `Hvad sker der i MAKRO, hvis ${instrument} ${PROFILE_WORD[scenario.variation] ?? 'varigt'} ændres med ${change}?`;
	const said = tilePhrases(tiles);
	const numbers = [said.nL, said.saldo2bnp, said.qBNP].filter((part): part is string => part != null);
	const scaling = scale === 1 ? '' : scale < 0 ? ', spejlet stød (lineær tilnærmelse)' : ', lineært skaleret';
	const honesty = `MAKROs standardstød (stødår ${y1}) vist som år efter stødet${scaling}.`;
	const description = [
		question,
		numbers.length ? `${capitalize(numbers.join(', '))}.` : null,
		`${capitalize(closure)}.`,
		honesty
	].filter((part): part is string => part != null).join(' ');

	return {
		name: shock.name,
		variation: scenario.variation,
		scale,
		path: viewPath(shock.name, scenario.variation, scale),
		image: imageFile(shock.name, scenario.variation, scale),
		title: bnp.value == null ? headline : `${headline}: BNP ${bnp.value} pct. efter 3 år`,
		description,
		imageAlt: `${question} Tre nøgletal: BNP efter 3 år, beskæftigelse og offentlig saldo i år 1.`,
		headline,
		subline,
		kicker: `Scenarie · ${closure} · stødår ${y1}, vist som år efter stødet`,
		closure,
		tiles,
		sparkline: Array.from({ length: 16 }, (_, k) => at('qBNP', y1 - 1 + k)),
		model: input.modelName
	};
}
