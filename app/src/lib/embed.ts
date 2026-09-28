/** Embeddable charts for newsrooms (makroskop-64y): one live chart of one scenario view in an
 *  iframe, the code that embeds it, its oEmbed JSON and the prerender list. Pure and alias-free
 *  (relative imports only) like card.ts, because scripts/verify-build.ts imports it.
 *  Design: docs/superpowers/specs/2026-09-27-embeds-design.md. */
import { cardSubject, changeText, closureWord, formatScale, PROFILE_WORD, solvedScenarios } from './card';
import type { Meta, Scenario, ScenarioDefinition, ShockMeta } from './data';
import { SITE_URL } from './site';

/** The code's default iframe heights: the tallest embeds at 375 px width (phones), so nothing is cut
 *  off without the resize script; wider columns get some space below. The script fits them exactly. */
export const EMBED_HEIGHT = { single: 510, compare: 640 } as const;
export const OEMBED_WIDTH = 640;
export const RESIZE_SCRIPT = `${SITE_URL}/indlejr/resize.js`;
/** A day: the embed shows live data, so consumers may refetch the oEmbed JSON daily. */
const OEMBED_CACHE_AGE = 86400;

export function embedPath(scenario: string, serie: string): string {
	return `/indlejr/${scenario}/${serie}/`;
}

/** The embed's address; the solved size and a single run are the defaults and stay out of it. */
export function embedUrl(p: { scenario: string; serie: string; scale: number; compare: boolean }): string {
	const query = [p.scale !== 1 ? `skala=${p.scale}` : null, p.compare ? 'sammenlign' : null].filter(Boolean);
	return `${SITE_URL}${embedPath(p.scenario, p.serie)}${query.length ? `?${query.join('&')}` : ''}`;
}

export function embedHeight(compare: boolean): number {
	return compare ? EMBED_HEIGHT.compare : EMBED_HEIGHT.single;
}

/** Which scenario a chart's embed shows. The lukkeskat chart appears on an unfinanced view only in
 *  compare mode, and only the financed run has it. */
export function embedTarget(p: { name: string; variation: string; serie: string }): { scenario: string; variation: string } {
	const variation = p.serie === 'tLukning' && p.variation === '_ufin' ? '_perm' : p.variation;
	return { scenario: `${p.name}${variation}`, variation };
}

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

/** The code a journalist pastes: a fixed-height responsive iframe (works where a CMS strips
 *  scripts), optionally followed by the resize script. */
export function embedCode(p: { url: string; title: string; height: number; script: boolean }): string {
	const iframe =
		`<iframe src="${escapeHtml(p.url)}" title="${escapeHtml(p.title)}" width="100%" height="${p.height}" style="border:0" ` +
		'loading="lazy" data-makroskop-embed></iframe>';
	return p.script ? `${iframe}\n<script async src="${RESIZE_SCRIPT}"></script>` : iframe;
}

export interface OEmbed {
	version: '1.0';
	type: 'rich';
	provider_name: string;
	provider_url: string;
	title: string;
	html: string;
	width: number;
	height: number;
	cache_age: number;
}

/** The static oEmbed response for one embed page (always the solved size, single run). */
export function oembedJson(head: { url: string; title: string; height: number }): OEmbed {
	return {
		version: '1.0',
		type: 'rich',
		provider_name: 'MAKROskop',
		provider_url: `${SITE_URL}/`,
		title: head.title,
		html: embedCode({ url: head.url, title: head.title, height: head.height, script: true }),
		width: OEMBED_WIDTH,
		height: head.height,
		cache_age: OEMBED_CACHE_AGE
	};
}

/** The embed's query: an allowed scale step (else ×1) and compare only when a partner run exists. */
export function readEmbedQuery(params: URLSearchParams, steps: number[], hasPartner: boolean): { scale: number; compare: boolean } {
	const raw = params.get('skala');
	const value = raw == null || raw === '' ? 1 : Number(raw);
	return {
		scale: Number.isFinite(value) && steps.includes(value) ? value : 1,
		compare: hasPartner && params.has('sammenlign')
	};
}

/** The footer note for a scaled view; null at the solved size. */
export function scaleNote(scale: number): string | null {
	if (scale === 1) return null;
	return `×${formatScale(scale)} af det beregnede stød, ${scale < 0 ? 'spejlet' : 'lineær tilnærmelse'}`;
}

/** The scenario page's charts after the instrument, in page order. The page imports this list,
 *  so the page and the embeds cannot drift apart. */
export const EMBED_SERIES: readonly string[] = [
	'qBNP', 'nL', 'ledighedsgrad',
	'qC', 'qX', 'qM',
	'qI', 'vhW', 'pC',
	'pBolig', 'saldo2bnp', 'primsaldo2bnp'
];

/** The charts of one scenario that can be embedded: the instrument first, the lukkeskat last for a
 *  financed run, each only when the series has data. */
export function embeddableSeries(scenario: Pick<Scenario, 'deviations' | 'definition'>, variation: string): string[] {
	const instrument = scenario.definition?.seriesKey;
	const keys = instrument && !EMBED_SERIES.includes(instrument) ? [instrument, ...EMBED_SERIES] : [...EMBED_SERIES];
	if (variation === '_perm') keys.push('tLukning');
	return keys.filter((key) => scenario.deviations[key]?.some((v) => v != null));
}

/** The prerender list for the embed pages and their oEmbed files. */
export function embedEntries(
	meta: Pick<Meta, 'shocks'>, read: (file: string) => Pick<Scenario, 'deviations' | 'definition'>
): { scenario: string; serie: string }[] {
	return solvedScenarios(meta).flatMap(({ file, variation }) =>
		embeddableSeries(read(file), variation).map((serie) => ({ scenario: file, serie }))
	);
}

/** A chart's unit line, as on the scenario page. */
export function chartUnit(devMode: string | undefined): string {
	return devMode === 'pct' ? 'afvigelse fra grundforløb, pct.' : 'afvigelse, pct.-point';
}

/** "ECB-renten +0,5 pct.-point, varigt og ufinansieret" — the share cards' subject and change. */
export function embedHeadline(p: {
	shock: Pick<ShockMeta, 'name' | 'labelDa'>;
	definition: Pick<ScenarioDefinition, 'instrumentDa' | 'delta' | 'factor' | 'changeDa'>;
	variation: string;
	scale: number;
	compare: boolean;
}): string {
	const closure = p.compare ? ', finansieret og ufinansieret' : ` og ${closureWord(p.variation)}`;
	return `${cardSubject(p.shock, p.definition)} ${changeText(p.definition, p.scale)}, ${PROFILE_WORD[p.variation] ?? ''}${closure}`;
}

/** The chart's lines: one for a single run or the instrument, unfinanced then financed in compare mode. */
export function embedSeries(p: {
	key: string;
	label: string;
	instrument: string | null | undefined;
	main: Pick<Scenario, 'deviations'>;
	partner: Pick<Scenario, 'deviations'> | null;
	variation: string;
	scale: number;
}): { key: string; label: string; values: (number | null)[] }[] {
	const scaled = (run: Pick<Scenario, 'deviations'>) => (run.deviations[p.key] ?? []).map((v) => (v == null ? null : v * p.scale));
	if (!p.partner || p.key === p.instrument) return [{ key: p.key, label: p.label, values: scaled(p.main) }];
	const [ufin, perm] = p.variation === '_ufin' ? [p.main, p.partner] : [p.partner, p.main];
	return [
		{ key: 'ufin', label: 'Ufinansieret', values: scaled(ufin) },
		{ key: 'perm', label: 'Finansieret', values: scaled(perm) }
	];
}

/** What the prerendered embed page knows before the data loads: head tags and the ×1 headline. */
export interface EmbedHead {
	scenario: string;
	name: string;
	variation: string;
	serie: string;
	headline: string;
	chartTitle: string;
	/** `<headline> — <chart title>`: the tab title, the iframe title and the oEmbed title. */
	title: string;
	/** The ×1 embed URL. */
	url: string;
	height: number;
	canonical: string;
	oembed: string;
}

export function embedHead(p: {
	series: Meta['series'];
	shock: Pick<ShockMeta, 'name' | 'labelDa'>;
	scenario: string;
	variation: string;
	serie: string;
	definition: ScenarioDefinition;
}): EmbedHead {
	const headline = embedHeadline({ shock: p.shock, definition: p.definition, variation: p.variation, scale: 1, compare: false });
	const chartTitle = p.series.find((s) => s.key === p.serie)?.labelDa ?? p.serie;
	return {
		scenario: p.scenario,
		name: p.shock.name,
		variation: p.variation,
		serie: p.serie,
		headline,
		chartTitle,
		title: `${headline} — ${chartTitle}`,
		url: embedUrl({ scenario: p.scenario, serie: p.serie, scale: 1, compare: false }),
		height: embedHeight(false),
		canonical: `${SITE_URL}/scenarier/${p.scenario}/`,
		oembed: `${SITE_URL}/oembed/${p.scenario}/${p.serie}.json`
	};
}

/** The embed's data: its run and, in compare mode, the partner run. A run that cannot be fetched
 *  or read gives null (the embed says so instead of waiting forever); a partner that cannot be
 *  fetched leaves one line. */
export async function loadEmbedRuns(p: {
	load: (file: string) => Promise<Scenario | null>;
	scenario: string;
	partner: string | null;
}): Promise<{ main: Scenario; partner: Scenario | null } | null> {
	const main = await p.load(p.scenario).catch(() => null);
	if (!main?.definition) return null;
	const partner = p.partner ? await p.load(p.partner).catch(() => null) : null;
	return { main, partner };
}
