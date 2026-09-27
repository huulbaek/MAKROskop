/** Embeddable charts for newsrooms (makroskop-64y): one live chart of one scenario view in an
 *  iframe, the code that embeds it, its oEmbed JSON and the prerender list. Pure and alias-free
 *  (relative imports only) like card.ts, because scripts/verify-build.ts imports it.
 *  Design: docs/superpowers/specs/2026-09-27-embeds-design.md. */
import { formatScale } from './card';
import { SITE_URL } from './site';

/** The code's default iframe heights; the optional resize script fits them exactly. */
export const EMBED_HEIGHT = { single: 430, compare: 470 } as const;
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
export function embedCode(p: { url: string; title: string; height: number; script: boolean; fallback: string }): string {
	const title = escapeHtml(p.title);
	const iframe =
		`<iframe src="${escapeHtml(p.url)}" title="${title}" width="100%" height="${p.height}" style="border:0" ` +
		`loading="lazy" data-makroskop-embed><a href="${escapeHtml(p.fallback)}">${title} – MAKROskop</a></iframe>`;
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
export function oembedJson(head: { url: string; title: string; height: number; canonical: string }): OEmbed {
	return {
		version: '1.0',
		type: 'rich',
		provider_name: 'MAKROskop',
		provider_url: `${SITE_URL}/`,
		title: head.title,
		html: embedCode({ url: head.url, title: head.title, height: head.height, script: true, fallback: head.canonical }),
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
