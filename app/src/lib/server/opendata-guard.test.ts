/** The data guard (makroskop-gko): the site must not serve changed numbers under an old version. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, changedFiles } from '../opendata';
import { dataChecksums, dataFilesOnDisk, loadDataSet, readManifest } from './opendata-files';

const manifest = readManifest();

describe('the released data', () => {
	it('has a manifest', () => {
		expect(manifest, 'static/data/udgivelse.json mangler: kør bun run data:release').not.toBeNull();
	});

	it('matches the committed data', () => {
		const changed = changedFiles(manifest!.files, dataChecksums(loadDataSet()));
		expect(changed, `Data er ændret siden version ${manifest!.version}: kør bun run data:release`).toEqual([]);
	});

	it('lists every data file on disk', () => {
		expect(Object.keys(manifest!.files).sort(), 'en scenariefil på disken er ikke med i kataloget').toEqual(dataFilesOnDisk());
	});

	it('was built with the current file format', () => {
		expect(manifest!.format, `Filformatet er ændret (FORMAT_VERSION ${FORMAT_VERSION}): kør bun run data:release`).toBe(FORMAT_VERSION);
	});

	it('is the version CITATION.cff cites', () => {
		const cff = readFileSync(join(process.cwd(), '..', 'CITATION.cff'), 'utf8');
		expect(cff).toContain(`version: "${manifest!.version}"`);
	});
});
