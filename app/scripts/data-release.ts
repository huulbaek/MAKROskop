/** bun run data:release --changelog "…": writes static/data/udgivelse.json and ../CITATION.cff for a
 *  new data version (makroskop-gko). Local only; commit and push as usual. Publishing the zip to
 *  GitHub is bun run data:publish. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { citationCff, manifestText, planRelease } from '../src/lib/opendata';
import { DATA_DIR, dataChecksums, loadDataSet, readManifest } from '../src/lib/server/opendata-files';

const flag = process.argv.indexOf('--changelog');
const changelog = flag > 0 ? (process.argv[flag + 1] ?? '') : (prompt('Hvad er ændret i denne version?') ?? '');
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const ds = loadDataSet();
const plan = planRelease({ current: readManifest(), files: dataChecksums(ds), model: ds.meta.model, date, changelog });
if ('refused' in plan) {
	console.error(`data:release: ${plan.refused}`);
	process.exit(1);
}
writeFileSync(join(DATA_DIR, 'udgivelse.json'), manifestText(plan.manifest));
writeFileSync(join(process.cwd(), '..', 'CITATION.cff'), citationCff(plan.manifest));
console.log(`data:release: version ${plan.manifest.version} — commit app/static/data/udgivelse.json and CITATION.cff`);
