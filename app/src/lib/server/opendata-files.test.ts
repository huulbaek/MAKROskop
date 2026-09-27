import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { BOM, FORMAT_VERSION, type Manifest } from '../opendata';
import { dataChecksums, derivedFiles, loadDataSet, releaseZip, zipEntries, zipName } from './opendata-files';

const ds = loadDataSet();
const files = derivedFiles(ds);
const manifest: Manifest = {
	version: '2026.09.27', date: '2026-09-27', format: FORMAT_VERSION, model: ds.meta.model, license: 'CC-BY-4.0',
	changelog: 'Test', files: dataChecksums(ds), earlier: []
};

const parse = (text: string, sep: string) => text.replace(BOM, '').trimEnd().split('\n').map((line) => line.split(sep));

describe('loadDataSet and checksums', () => {
	it('covers meta, baseline and every solved scenario', () => {
		const paths = Object.keys(dataChecksums(ds));
		expect(paths).toContain('meta.json');
		expect(paths).toContain('baseline.json');
		expect(paths.filter((p) => p.startsWith('shocks/'))).toHaveLength(ds.scenarios.length);
		expect(ds.scenarios.length).toBe(78);
	});
});

describe('derivedFiles', () => {
	it('round-trips Rente_ufin through the international CSV to 4 decimals', () => {
		const rows = parse(files['csv/Rente_ufin.csv'], ',');
		const header = rows[0];
		const scenario = ds.scenarios.find((s) => s.file === 'Rente_ufin')!;
		const years = rows.slice(1).map((r) => Number(r[0]));
		expect(years[0]).toBe(ds.meta.yearStart);
		expect(years.at(-1)).toBe(ds.meta.yearEnd);
		for (const [col, key] of header.entries()) {
			if (col === 0) continue;
			rows.slice(1).forEach((row, i) => {
				const want = scenario.deviations[key][i];
				if (want == null) expect(row[col]).toBe('');
				// rounded to 4 decimals: off by at most half a unit in the last place
				else expect(Math.abs(Number(row[col]) - want)).toBeLessThanOrEqual(0.00005 + 1e-12);
			});
		}
	});

	it('writes the same numbers in the Danish dialect', () => {
		expect(files['csv-da/Rente_ufin.csv'].startsWith(BOM)).toBe(true);
		const intl = parse(files['csv/Rente_ufin.csv'], ',');
		const da = parse(files['csv-da/Rente_ufin.csv'], ';');
		expect(da[0][1]).toMatch(/\[qBNP\]$/);
		expect(da.slice(1).map((r) => r.map((c) => c.replace(',', '.')))).toEqual(intl.slice(1));
	});

	it('writes one long row per non-null value over all scenarios', () => {
		const values = ds.scenarios.reduce(
			(sum, s) => sum + ds.meta.series.reduce((n, se) => n + (s.deviations[se.key] ?? []).filter((v) => v != null).length, 0), 0
		);
		expect(files['csv/alle-scenarier.csv'].trimEnd().split('\n')).toHaveLength(values + 1);
	});

	it('explains every series in the data', () => {
		const keys = new Set(parse(files['ordbog.csv'], ',').slice(1).map((r) => r[0]));
		for (const s of ds.scenarios) for (const key of Object.keys(s.deviations)) expect(keys.has(key), key).toBe(true);
	});
});

// Each zip compresses ~45 MB of files (about 2 s).
describe('releaseZip', { timeout: 30_000 }, () => {
	it('is byte-identical when built twice', () => {
		expect(Buffer.from(releaseZip(ds, manifest)).equals(Buffer.from(releaseZip(ds, manifest)))).toBe(true);
	});

	it('is byte-identical in another time zone', () => {
		const tz = process.env.TZ;
		try {
			process.env.TZ = 'UTC';
			const utc = releaseZip(ds, manifest);
			process.env.TZ = 'Pacific/Auckland';
			const nz = releaseZip(ds, manifest);
			expect(Buffer.from(utc).equals(Buffer.from(nz))).toBe(true);
		} finally {
			process.env.TZ = tz;
		}
	});

	it('holds exactly the data, the CSVs, the manifest and the read-me', () => {
		const names = Object.keys(unzipSync(releaseZip(ds, manifest)));
		const folder = zipName('2026.09.27').replace('.zip', '');
		expect(names).toEqual(zipEntries(ds).map((p) => `${folder}/${p}`));
		expect(zipEntries(ds)).toEqual(
			[...Object.keys(dataChecksums(ds)), ...Object.keys(files), 'udgivelse.json', 'LAES-MIG.md'].sort()
		);
	});
});
