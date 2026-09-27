/** nginx.conf serves the built site. Embeds run in sandboxed iframes (WordPress wraps discovered
 *  oEmbed iframes in sandbox="allow-scripts"), where the page has an opaque origin and its own
 *  scripts and data are cross-origin requests: every location that serves them must allow CORS. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONF = readFileSync(join(process.cwd(), 'nginx.conf'), 'utf8');

/** The body of `location <path> { … }` (no nested blocks in this config). */
function location(path: string): string {
	const match = CONF.match(new RegExp(`location ${path.replace(/[/]/g, '\\/')} \\{([^}]*)\\}`));
	if (!match) throw new Error(`no location ${path} in nginx.conf`);
	return match[1];
}

describe('nginx.conf', () => {
	it('lets sandboxed embeds load the app and the data', () => {
		// add_header is not inherited into a location that sets its own, so each block needs it
		for (const path of ['/_app/immutable/', '/']) {
			expect(location(path), path).toMatch(/add_header Access-Control-Allow-Origin "\*";/);
		}
	});
});
