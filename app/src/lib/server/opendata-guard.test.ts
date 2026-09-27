/** The data guard (makroskop-gko): the site must not serve changed numbers under an old version.
 *  buildProblems covers changed data, format and zip (the build step runs the same check). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProblems } from '../opendata';
import { dataChecksums, dataFilesOnDisk, loadDataSet, readManifest, releaseZip, sha256 } from './opendata-files';

const manifest = readManifest();

describe('the released data', () => {
	it('has a manifest', () => {
		expect(manifest, 'static/data/udgivelse.json mangler: kør bun run data:release').not.toBeNull();
	});

	it('lists every data file on disk', () => {
		expect(Object.keys(manifest!.files).sort(), 'en scenariefil på disken er ikke med i kataloget').toEqual(dataFilesOnDisk());
	});

	it('builds the zip that was released, as the build step checks too', { timeout: 30_000 }, () => {
		const ds = loadDataSet();
		const zipSha = sha256(releaseZip(ds, manifest!));
		expect(buildProblems({ manifest, checksums: dataChecksums(ds), onDisk: dataFilesOnDisk(), zipSha })).toEqual([]);
	});

	it('is the version CITATION.cff cites', () => {
		const cff = readFileSync(join(process.cwd(), '..', 'CITATION.cff'), 'utf8');
		expect(cff).toContain(`version: "${manifest!.version}"`);
	});
});
