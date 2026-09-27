import { describe, expect, it } from 'vitest';
import { DATA_PAGE, DATA_VERSION } from './release';
import { readManifest } from './server/opendata-files';

describe('release', () => {
	it('is the committed manifest version', () => {
		expect(DATA_VERSION).toBe(readManifest()!.version);
		expect(DATA_PAGE).toBe('/aabne-data/');
	});
});
