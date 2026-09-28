/** bun run data:publish: creates the GitHub Release data-<version> with the zip (makroskop-gko).
 *  Outward-facing — run only when the owner has said so. Refuses unless the manifest is committed,
 *  pushed and matches the data, gh is logged in, and the tag is new. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFiles, publishProblems, releaseNotes, releaseTag } from '../src/lib/opendata';
import { dataChecksums, loadDataSet, readManifest, releaseExists, releaseZip, remoteTagExists, zipName } from '../src/lib/server/opendata-files';

const manifest = readManifest();
const ds = loadDataSet();
const ok = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
const revList = spawnSync('git', ['rev-list', '--count', '@{u}..HEAD'], { encoding: 'utf8' });
const unpushed = revList.status === 0 ? Number(revList.stdout.trim()) : null;
const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const status = spawnSync('git', ['status', '--porcelain', '--', 'static/data', '../CITATION.cff'], { encoding: 'utf8' });
const uncommitted = status.stdout.split('\n').filter(Boolean).map((line) => line.slice(3));
// A bare tag (pushed by hand, or a release deleted without its tag) counts as taken too.
const tagExists = manifest ? (releaseExists(manifest.version) || remoteTagExists(manifest.version)) : false;
const problems = publishProblems({
	manifest,
	ghAuthed: ok('gh', ['auth', 'status']),
	tagExists,
	changed: manifest ? changedFiles(manifest.files, dataChecksums(ds)) : [],
	unpushed,
	uncommitted
});
if (problems.length || !manifest) {
	console.error(`data:publish:\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), 'makroskop-data-'));
const zipPath = join(dir, zipName(manifest.version));
writeFileSync(zipPath, releaseZip(ds, manifest));
execFileSync(
	'gh',
	['release', 'create', releaseTag(manifest.version), zipPath, '--target', head, '--title', `Data ${manifest.version}`, '--notes', releaseNotes(manifest)],
	{ stdio: 'inherit' }
);
console.log(`data:publish: ${releaseTag(manifest.version)} created`);
