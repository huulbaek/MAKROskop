/** Writes the open-data files into build/data/ after vite build (makroskop-gko): both CSV dialects,
 *  the dictionaries and the release zip (also as makroskop-data.zip). Derived from the committed
 *  JSON; only static/data/udgivelse.json is committed. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { derivedFiles, loadDataSet, readManifest, releaseZip, zipName } from '../src/lib/server/opendata-files';

const out = join(process.cwd(), 'build', 'data');
const manifest = readManifest();
if (!manifest) {
	console.error('data-files: static/data/udgivelse.json mangler — kør bun run data:release');
	process.exit(1);
}
const ds = loadDataSet();
const files = derivedFiles(ds);
for (const [path, text] of Object.entries(files)) {
	mkdirSync(dirname(join(out, path)), { recursive: true });
	writeFileSync(join(out, path), text);
}
const zip = releaseZip(ds, manifest);
writeFileSync(join(out, zipName(manifest.version)), zip);
writeFileSync(join(out, 'makroskop-data.zip'), zip);
console.log(`data-files: ${Object.keys(files).length} CSV files and ${zipName(manifest.version)} (${(zip.length / 1e6).toFixed(1)} MB) → build/data/`);
