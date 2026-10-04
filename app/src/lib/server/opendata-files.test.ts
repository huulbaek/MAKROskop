import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { BOM, FORMAT_VERSION, publishedSeries, type Manifest } from '../opendata';
import { dataChecksums, derivedFiles, loadDataSet, releaseZip, zipEntries, zipName } from './opendata-files';

const ds = loadDataSet();
const files = derivedFiles(ds);
const manifest: Manifest = {
	version: '2026.09.27', date: '2026-09-27', format: FORMAT_VERSION, model: ds.meta.model, license: 'CC-BY-4.0',
	changelog: 'Test', files: dataChecksums(ds), earlier: []
};

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i]);
const parse = (text: string, sep: string) => text.replace(BOM, '').trimEnd().split('\n').map((line) => line.split(sep));

describe('loadDataSet and checksums', () => {
	it('covers meta, baseline and every solved scenario', () => {
		const paths = Object.keys(dataChecksums(ds));
		expect(paths).toContain('meta.json');
		expect(paths).toContain('baseline.json');
		expect(paths.filter((p) => p.startsWith('shocks/'))).toHaveLength(ds.scenarios.length);
		expect(ds.scenarios.length).toBe(84); // +2: KapitalProd, both variants (makroskop-ba1.5)
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
			(sum, s) => sum + publishedSeries(ds.meta.series).reduce((n, se) => n + (s.deviations[se.key] ?? []).filter((v) => v != null).length, 0), 0
		);
		expect(files['csv/alle-scenarier.csv'].trimEnd().split('\n')).toHaveLength(values + 1);
	});

	it('explains every series in the data', () => {
		const keys = new Set(parse(files['ordbog.csv'], ',').slice(1).map((r) => r[0]));
		for (const se of publishedSeries(ds.meta.series)) expect(keys.has(se.key), se.key).toBe(true);
	});
});

// Each zip compresses ~43 MB of CSV and JSON (about 1.5 s); the CSVs are derived once, above.
describe('releaseZip', { timeout: 30_000 }, () => {
	it('is byte-identical when built twice', () => {
		expect(same(releaseZip(ds, manifest, files), releaseZip(ds, manifest, files))).toBe(true);
	});

	it('is byte-identical in another time zone', () => {
		const tz = process.env.TZ;
		try {
			process.env.TZ = 'UTC';
			const utc = releaseZip(ds, manifest, files);
			process.env.TZ = 'Pacific/Auckland';
			const nz = releaseZip(ds, manifest, files);
			expect(same(utc, nz)).toBe(true);
		} finally {
			process.env.TZ = tz;
		}
	});

	it('does not change when the DOI or the zip checksum is added to the manifest', () => {
		const later = { ...manifest, doi: '10.5281/zenodo.1', zip: { name: 'x.zip', bytes: 1, sha256: 'ab' } };
		expect(same(releaseZip(ds, manifest, files), releaseZip(ds, later, files))).toBe(true);
	});

	it('holds exactly the data, the CSVs, the manifest and the read-me', () => {
		const names = Object.keys(unzipSync(releaseZip(ds, manifest, files)));
		const folder = zipName('2026.09.27').replace('.zip', '');
		const entries = zipEntries(ds, files);
		expect(names).toEqual(entries.map((p) => `${folder}/${p}`));
		expect(entries).toEqual(
			[...Object.keys(dataChecksums(ds)), ...Object.keys(files), 'udgivelse.json', 'LAES-MIG.md'].sort()
		);
	});
});

describe('published series', () => {
	it('publishes only series whose deviations are pct. or pct.-point', () => {
		// vSaldo, vPrimSaldo, vOff13Net ('gdp_pp') are raw ×100 level differences, not pct.-points;
		// their ratio series (saldo2bnp, primsaldo2bnp, nettoformue2bnp) are the published ones.
		const dictionary = parse(files['ordbog.csv'], ',').slice(1).map((r) => r[0]);
		const header = parse(files['csv/Rente_ufin.csv'], ',')[0];
		const long = new Set(parse(files['csv/alle-scenarier.csv'], ',').slice(1).map((r) => r[3]));
		for (const s of ds.meta.series.filter((s) => s.devMode === 'gdp_pp')) {
			expect(dictionary, s.key).not.toContain(s.key);
			expect(header, s.key).not.toContain(s.key);
			expect(long.has(s.key), s.key).toBe(false);
		}
		expect(dictionary).toContain('saldo2bnp');
	});
});
