import { describe, expect, it } from 'vitest';
import {
	EMBED_HEIGHT, RESIZE_SCRIPT, embedCode, embedHeight, embedPath, embedTarget, embedUrl, escapeHtml, oembedJson,
	readEmbedQuery, scaleNote, EMBED_SERIES, chartUnit, embedEntries, embedHead, embedHeadline, embedSeries, embeddableSeries
} from './embed';
import { readMeta, readScenario } from './server/scenarios';

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
		// the largest embeds measured at 375 px width, rounded up (2026-09-27): 508 and 636 px
		expect(EMBED_HEIGHT).toEqual({ single: 510, compare: 640 });
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

describe('embeddableSeries', () => {
	const scenario = (keys: string[], seriesKey: string | null = null) => ({
		deviations: Object.fromEntries(keys.map((k) => [k, [null, 0.1]])),
		definition: { seriesKey } as never
	});

	it('leads with the instrument and closes with the lukkeskat for a financed run', () => {
		const all = [...EMBED_SERIES, 'rRenteECB', 'tLukning'];
		expect(embeddableSeries(scenario(all, 'rRenteECB'), '_perm')).toEqual(['rRenteECB', ...EMBED_SERIES, 'tLukning']);
		expect(embeddableSeries(scenario(all, 'rRenteECB'), '_ufin')).toEqual(['rRenteECB', ...EMBED_SERIES]);
	});

	it('skips series without data and does not list the instrument twice', () => {
		const keys = embeddableSeries({ deviations: { qBNP: [0.1], nL: [null, null] }, definition: { seriesKey: 'qBNP' } as never }, '_ufin');
		expect(keys).toEqual(['qBNP']);
	});
});

describe('chartUnit', () => {
	it('names the deviation unit as the page does', () => {
		expect(chartUnit('pct')).toBe('afvigelse fra grundforløb, pct.');
		expect(chartUnit('pp')).toBe('afvigelse, pct.-point');
	});
});

describe('embedSeries', () => {
	const ufin = { deviations: { qBNP: [1, 2], rRenteECB: [1, 1] } };
	const perm = { deviations: { qBNP: [3, 4], rRenteECB: [1, 1] } };
	const base = { key: 'qBNP', label: 'BNP (realt)', instrument: 'rRenteECB', scale: 1 };

	it('draws one line for a single run, scaled', () => {
		expect(embedSeries({ ...base, main: ufin, partner: null, variation: '_ufin', scale: 0.5 })).toEqual([
			{ key: 'qBNP', label: 'BNP (realt)', values: [0.5, 1] }
		]);
	});

	it('draws unfinanced then financed in compare mode, whichever run the embed is on', () => {
		const fromPerm = embedSeries({ ...base, main: perm, partner: ufin, variation: '_perm' });
		expect(fromPerm.map((s) => [s.label, s.values])).toEqual([['Ufinansieret', [1, 2]], ['Finansieret', [3, 4]]]);
	});

	it('keeps the instrument as one line even in compare mode', () => {
		expect(embedSeries({ ...base, key: 'rRenteECB', main: ufin, partner: perm, variation: '_ufin' })).toHaveLength(1);
	});
});

describe('shipped data', () => {
	const meta = readMeta();

	it('lists one embed per series with data, lukkeskat only for financed runs', () => {
		const entries = embedEntries(meta, readScenario);
		expect(entries.length).toBeGreaterThan(900);
		expect(entries).toContainEqual({ scenario: 'Rente_ufin', serie: 'qBNP' });
		expect(entries).toContainEqual({ scenario: 'Rente_perm', serie: 'tLukning' });
		expect(entries).not.toContainEqual({ scenario: 'Rente_ufin', serie: 'tLukning' });
		expect(new Set(entries.map((e) => `${e.scenario}/${e.serie}`)).size).toBe(entries.length);
	});

	it('words the headline as the share cards do, scaled, mirrored and compared', () => {
		const shock = meta.shocks.find((s) => s.name === 'Rente')!;
		const definition = readScenario('Rente_ufin').definition!;
		const headline = (scale: number, variation = '_ufin', compare = false) =>
			embedHeadline({ shock, definition, variation, scale, compare });
		expect(headline(1)).toBe('ECB-renten +1 pct.-point, varigt og ufinansieret');
		expect(headline(0.5)).toBe('ECB-renten +0,5 pct.-point, varigt og ufinansieret');
		expect(headline(-1)).toBe('ECB-renten −1 pct.-point, varigt og ufinansieret');
		expect(headline(1, '_perm')).toBe('ECB-renten +1 pct.-point, varigt og finansieret via lukkeskat');
		expect(headline(1, '_ufin', true)).toBe('ECB-renten +1 pct.-point, varigt, finansieret og ufinansieret');
	});

	it('builds the head of the Rente BNP embed', () => {
		const shock = meta.shocks.find((s) => s.name === 'Rente')!;
		const head = embedHead({
			series: meta.series, shock, scenario: 'Rente_ufin', variation: '_ufin', serie: 'qBNP',
			definition: readScenario('Rente_ufin').definition!
		});
		expect(head).toMatchObject({
			scenario: 'Rente_ufin', name: 'Rente', variation: '_ufin', serie: 'qBNP',
			headline: 'ECB-renten +1 pct.-point, varigt og ufinansieret',
			chartTitle: 'BNP (realt)',
			title: 'ECB-renten +1 pct.-point, varigt og ufinansieret — BNP (realt)',
			url: 'https://makroskop.nodalit.com/indlejr/Rente_ufin/qBNP/',
			height: 510,
			canonical: 'https://makroskop.nodalit.com/scenarier/Rente_ufin/',
			oembed: 'https://makroskop.nodalit.com/oembed/Rente_ufin/qBNP.json'
		});
	});
});
