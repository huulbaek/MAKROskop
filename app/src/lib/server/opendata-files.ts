/** Build-time side of the open data (makroskop-gko): read the committed data, checksum it, derive
 *  the CSVs and build the release zip. Relative imports only: the bun scripts import this. */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync, type Zippable } from 'fflate';
import { solvedScenarios } from '../card';
import type { Baseline, Meta } from '../data';
import { dictionaryCsv, longCsv, manifestText, publishedSeries, readme, wideCsv, zipManifest, type Dialect, type Manifest, type ScenarioRef } from '../opendata';

export const DATA_DIR = join(process.cwd(), 'static', 'data');
const MANIFEST = 'udgivelse.json';
const DIALECT_DIR: Record<Dialect, string> = { intl: 'csv', da: 'csv-da' };

export function sha256(data: string | Uint8Array): string {
	return createHash('sha256').update(data).digest('hex');
}

export interface DataSet {
	/** The committed data files as text, by path under static/data/. */
	raw: Record<string, string>;
	meta: Meta;
	baseline: Baseline;
	scenarios: ScenarioRef[];
}

export function loadDataSet(dir: string = DATA_DIR): DataSet {
	const read = (path: string) => readFileSync(join(dir, path), 'utf8');
	const raw: Record<string, string> = { 'meta.json': read('meta.json'), 'baseline.json': read('baseline.json') };
	const meta = JSON.parse(raw['meta.json']) as Meta;
	const scenarios = solvedScenarios(meta).map(({ shock, variation, file }) => {
		raw[`shocks/${file}.json`] = read(`shocks/${file}.json`);
		const parsed = JSON.parse(raw[`shocks/${file}.json`]) as { deviations: ScenarioRef['deviations'] };
		return { file, shock: shock.name, variation, deviations: parsed.deviations };
	});
	return { raw, meta, baseline: JSON.parse(raw['baseline.json']) as Baseline, scenarios };
}

export function dataChecksums(ds: DataSet): Record<string, string> {
	return Object.fromEntries(Object.keys(ds.raw).sort().map((path) => [path, sha256(ds.raw[path])]));
}

/** The CSVs and dictionaries, by path under /data/. */
export function derivedFiles(ds: DataSet): Record<string, string> {
	const years = Array.from({ length: ds.meta.yearEnd - ds.meta.yearStart + 1 }, (_, i) => ds.meta.yearStart + i);
	const series = publishedSeries(ds.meta.series);
	const out: Record<string, string> = {};
	for (const dialect of ['intl', 'da'] as const) {
		const dir = DIALECT_DIR[dialect];
		for (const s of ds.scenarios) out[`${dir}/${s.file}.csv`] = wideCsv({ years, series, values: s.deviations, dialect });
		out[`${dir}/alle-scenarier.csv`] = longCsv({ years, series, scenarios: ds.scenarios, dialect });
		out[`${dir}/grundforloeb.csv`] = wideCsv({ years: ds.baseline.years, series, values: ds.baseline.series, dialect });
	}
	out['ordbog.csv'] = dictionaryCsv(series, 'intl');
	out['ordbog-da.csv'] = dictionaryCsv(series, 'da');
	return out;
}

export function zipName(version: string): string {
	return `makroskop-data-${version}.zip`;
}

export function zipEntries(ds: DataSet): string[] {
	return [...Object.keys(ds.raw), ...Object.keys(derivedFiles(ds)), MANIFEST, 'LAES-MIG.md'].sort();
}

/** The release zip: fixed entry order and a fixed timestamp (local noon of the release date, which
 *  DOS time stores as local fields), so every build of a version, in any time zone, is identical. */
export function releaseZip(ds: DataSet, m: Manifest): Uint8Array {
	const [y, mo, d] = m.date.split('-').map(Number);
	const mtime = new Date(y, mo - 1, d, 12, 0, 0);
	const contents: Record<string, string> = {
		...ds.raw,
		...derivedFiles(ds),
		[MANIFEST]: manifestText(zipManifest(m)),
		'LAES-MIG.md': readme(zipManifest(m), ds.scenarios.length)
	};
	const folder = zipName(m.version).replace('.zip', '');
	const entries: Zippable = {};
	// Level 6: a level-9 zip is ~5 % smaller and takes about twice as long to build.
	for (const path of Object.keys(contents).sort()) entries[`${folder}/${path}`] = [strToU8(contents[path]), { mtime, level: 6 }];
	return zipSync(entries);
}

export function readManifest(dir: string = DATA_DIR): Manifest | null {
	const path = join(dir, MANIFEST);
	return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Manifest) : null;
}

/** Every committed data file on disk, for the guard (a shock file the catalog no longer lists counts). */
export function dataFilesOnDisk(dir: string = DATA_DIR): string[] {
	const shocks = readdirSync(join(dir, 'shocks')).filter((f) => f.endsWith('.json')).map((f) => `shocks/${f}`);
	return ['meta.json', 'baseline.json', ...shocks].sort();
}
