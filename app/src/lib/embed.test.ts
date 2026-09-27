import { describe, expect, it } from 'vitest';
import {
	EMBED_HEIGHT, RESIZE_SCRIPT, embedCode, embedHeight, embedPath, embedTarget, embedUrl, escapeHtml, oembedJson,
	readEmbedQuery, scaleNote
} from './embed';

const SITE = 'https://makroskop.nodalit.com';

describe('embedUrl', () => {
	it('leaves the defaults out', () => {
		expect(embedPath('Rente_ufin', 'qBNP')).toBe('/indlejr/Rente_ufin/qBNP/');
		expect(embedUrl({ scenario: 'Rente_ufin', serie: 'qBNP', scale: 1, compare: false })).toBe(`${SITE}/indlejr/Rente_ufin/qBNP/`);
	});

	it('carries the scale and compare state', () => {
		expect(embedUrl({ scenario: 'Rente_ufin', serie: 'qBNP', scale: -0.5, compare: true })).toBe(
			`${SITE}/indlejr/Rente_ufin/qBNP/?skala=-0.5&sammenlign`
		);
	});
});

describe('embedTarget', () => {
	it('points the lukkeskat chart of an unfinanced view at the financed run', () => {
		expect(embedTarget({ name: 'Rente', variation: '_ufin', serie: 'tLukning' })).toEqual({ scenario: 'Rente_perm', variation: '_perm' });
	});

	it('keeps every other chart on the view it came from', () => {
		expect(embedTarget({ name: 'Rente', variation: '_ufin', serie: 'qBNP' })).toEqual({ scenario: 'Rente_ufin', variation: '_ufin' });
		expect(embedTarget({ name: 'Rente', variation: '_perm', serie: 'tLukning' })).toEqual({ scenario: 'Rente_perm', variation: '_perm' });
	});
});

describe('embedCode', () => {
	const base = { url: `${SITE}/indlejr/Rente_ufin/qBNP/?skala=0.5&sammenlign`, title: 'ECB-renten +0,5 pct.-point — BNP', height: 470, fallback: `${SITE}/scenarier/Rente_ufin/` };

	it('is a responsive, lazy, borderless iframe with a fallback link', () => {
		expect(embedCode({ ...base, script: false })).toBe(
			`<iframe src="${SITE}/indlejr/Rente_ufin/qBNP/?skala=0.5&amp;sammenlign" title="ECB-renten +0,5 pct.-point — BNP" ` +
				'width="100%" height="470" style="border:0" loading="lazy" data-makroskop-embed>' +
				`<a href="${SITE}/scenarier/Rente_ufin/">ECB-renten +0,5 pct.-point — BNP – MAKROskop</a></iframe>`
		);
	});

	it('appends the resize script on request', () => {
		const code = embedCode({ ...base, script: true });
		expect(code.split('\n')[1]).toBe(`<script async src="${RESIZE_SCRIPT}"></script>`);
		expect(RESIZE_SCRIPT).toBe(`${SITE}/indlejr/resize.js`);
	});

	it('escapes characters that would break the attributes', () => {
		expect(escapeHtml(`a "b" & <c> 'd'`)).toBe('a &quot;b&quot; &amp; &lt;c&gt; &#39;d&#39;');
		expect(embedCode({ ...base, title: 'Say "hi" & <go>', script: false })).toContain('title="Say &quot;hi&quot; &amp; &lt;go&gt;"');
	});
});

describe('embedHeight', () => {
	it('adds room for the financing sentence in compare mode', () => {
		expect(embedHeight(false)).toBe(EMBED_HEIGHT.single);
		expect(embedHeight(true)).toBe(EMBED_HEIGHT.compare);
		expect(EMBED_HEIGHT.compare).toBeGreaterThan(EMBED_HEIGHT.single);
	});
});

describe('oembedJson', () => {
	it('is an oEmbed 1.0 rich response for the ×1 embed, with the resize script', () => {
		const head = { url: `${SITE}/indlejr/Rente_ufin/qBNP/`, title: 'ECB-renten +1 pct.-point — BNP', height: 430, canonical: `${SITE}/scenarier/Rente_ufin/` };
		const json = oembedJson(head);
		expect(json).toMatchObject({
			version: '1.0', type: 'rich', provider_name: 'MAKROskop', provider_url: `${SITE}/`,
			title: head.title, width: 640, height: 430
		});
		expect(json.html).toContain(`src="${SITE}/indlejr/Rente_ufin/qBNP/"`);
		expect(json.html).toContain(RESIZE_SCRIPT);
		expect(json.cache_age).toBeGreaterThan(0);
	});
});

describe('readEmbedQuery', () => {
	const steps = [-1, -0.5, 0.5, 1, 2];
	const q = (search: string) => new URLSearchParams(search);

	it('reads an allowed scale and the compare flag', () => {
		expect(readEmbedQuery(q('skala=-0.5&sammenlign'), steps, true)).toEqual({ scale: -0.5, compare: true });
	});

	it('falls back to ×1 for a missing, mangled or disallowed scale', () => {
		expect(readEmbedQuery(q(''), steps, true).scale).toBe(1);
		expect(readEmbedQuery(q('skala=abc'), steps, true).scale).toBe(1);
		expect(readEmbedQuery(q('skala=1.5'), steps, true).scale).toBe(1);
		expect(readEmbedQuery(q('skala='), steps, true).scale).toBe(1);
	});

	it('ignores sammenlign without a partner run', () => {
		expect(readEmbedQuery(q('sammenlign'), steps, false).compare).toBe(false);
	});
});

describe('scaleNote', () => {
	it('says nothing at the solved size and names scaled and mirrored views', () => {
		expect(scaleNote(1)).toBeNull();
		expect(scaleNote(0.5)).toBe('×0,5 af det beregnede stød, lineær tilnærmelse');
		expect(scaleNote(-1)).toBe('×−1 af det beregnede stød, spejlet');
	});
});
