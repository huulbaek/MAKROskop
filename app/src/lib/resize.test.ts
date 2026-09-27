/** static/indlejr/resize.js runs on newsroom pages; it is loaded here with stub window/document. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(join(process.cwd(), 'static', 'indlejr', 'resize.js'), 'utf8');

interface Frame { src: string; contentWindow: object; style: { height?: string } }

function host(frames: Frame[]) {
	const handlers: ((event: unknown) => void)[] = [];
	const win: Record<string, unknown> = {
		addEventListener: (type: string, handler: (event: unknown) => void) => {
			if (type === 'message') handlers.push(handler);
		}
	};
	const doc = { querySelectorAll: () => frames };
	const load = () => new Function('window', 'document', SOURCE)(win, doc);
	load();
	return { handlers, load, send: (event: unknown) => handlers.forEach((h) => h(event)) };
}

const EMBED = 'https://makroskop.nodalit.com';

describe('resize.js', () => {
	it('sets the height of the iframe that sent the message', () => {
		const a = { src: `${EMBED}/indlejr/Rente_ufin/qBNP/`, contentWindow: {}, style: {} };
		const b = { src: `${EMBED}/indlejr/Rente_ufin/nL/`, contentWindow: {}, style: {} };
		const { send } = host([a, b]);
		send({ origin: EMBED, source: b.contentWindow, data: { type: 'makroskop:height', height: 512.4 } });
		expect(b.style.height).toBe('512px');
		expect(a.style.height).toBeUndefined();
	});

	it('clamps the height to 200–1200 px', () => {
		const a = { src: `${EMBED}/indlejr/x/qBNP/`, contentWindow: {}, style: {} };
		const { send } = host([a]);
		send({ origin: EMBED, source: a.contentWindow, data: { type: 'makroskop:height', height: 5000 } });
		expect(a.style.height).toBe('1200px');
		send({ origin: EMBED, source: a.contentWindow, data: { type: 'makroskop:height', height: 10 } });
		expect(a.style.height).toBe('200px');
	});

	it('ignores messages from another origin, another window or of another shape', () => {
		const a = { src: `${EMBED}/indlejr/x/qBNP/`, contentWindow: {}, style: {} };
		const { send } = host([a]);
		send({ origin: 'https://evil.example', source: a.contentWindow, data: { type: 'makroskop:height', height: 500 } });
		send({ origin: EMBED, source: {}, data: { type: 'makroskop:height', height: 500 } });
		send({ origin: EMBED, source: a.contentWindow, data: { type: 'other', height: 500 } });
		send({ origin: EMBED, source: a.contentWindow, data: { type: 'makroskop:height', height: '500' } });
		send({ origin: EMBED, source: a.contentWindow, data: null });
		expect(a.style.height).toBeUndefined();
	});

	it('registers one listener however often the script is included', () => {
		const { handlers, load } = host([]);
		load();
		load();
		expect(handlers).toHaveLength(1);
	});
});
