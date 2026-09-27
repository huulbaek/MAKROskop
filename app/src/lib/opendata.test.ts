import { describe, expect, it } from 'vitest';
import type { SeriesMeta } from './data';
import {
	BOM, FORMAT_VERSION, changedFiles, citation, citationCff, csvNumber, dictionaryCsv, longCsv, manifestText, nextVersion, planRelease,
	buildProblems, publishProblems, readme, releaseNotes, wideCsv, zipManifest, type Manifest
} from './opendata';

const series: SeriesMeta[] = [
	{ key: 'qBNP', labelDa: 'BNP (realt)', labelEn: 'GDP (real)', group: 'Nationalregnskab', unit: 'mia. 2020-kr.', devMode: 'pct', sector: null },
	{ key: 'saldo2bnp', labelDa: 'Offentlig saldo, andel af BNP', labelEn: 'Public balance, share of GDP', group: 'Offentlige finanser', unit: 'pct. af BNP', devMode: 'pp', sector: null }
] as SeriesMeta[];

describe('csvNumber', () => {
	it('rounds to 4 decimals in the dialect', () => {
		expect(csvNumber(-1.234567, 'intl')).toBe('-1.2346');
		expect(csvNumber(-1.234567, 'da')).toBe('-1,2346');
		expect(csvNumber(2750.5, 'da')).toBe('2750,5');
	});

	it('never writes -0, exponents or NaN', () => {
		expect(csvNumber(-0.00001, 'intl')).toBe('0');
		expect(csvNumber(1e-7, 'da')).toBe('0');
		expect(csvNumber(null, 'intl')).toBe('');
		expect(csvNumber(undefined, 'intl')).toBe('');
		expect(csvNumber(Number.NaN, 'intl')).toBe('');
		expect(csvNumber(Number.POSITIVE_INFINITY, 'da')).toBe('');
	});
});

describe('wideCsv', () => {
	const values = { qBNP: [null, -0.8421], saldo2bnp: [null, 0.5] };

	it('writes keys as headers in the international dialect', () => {
		expect(wideCsv({ years: [2029, 2030], series, values, dialect: 'intl' })).toBe(
			'year,qBNP,saldo2bnp\n2029,,\n2030,-0.8421,0.5\n'
		);
	});

	it('writes labels, semicolons, decimal commas and a BOM in the Danish dialect', () => {
		expect(wideCsv({ years: [2029, 2030], series, values, dialect: 'da' })).toBe(
			`${BOM}år;BNP (realt) [qBNP];Offentlig saldo, andel af BNP [saldo2bnp]\n2029;;\n2030;-0,8421;0,5\n`
		);
	});
});

describe('longCsv', () => {
	it('writes one row per non-null value', () => {
		const csv = longCsv({
			years: [2029, 2030],
			series,
			scenarios: [{ file: 'Rente_ufin', shock: 'Rente', variation: '_ufin', deviations: { qBNP: [null, -0.84], saldo2bnp: [null, null] } }],
			dialect: 'intl'
		});
		expect(csv).toBe('scenario,shock,variant,series,year,value\nRente_ufin,Rente,_ufin,qBNP,2030,-0.84\n');
	});

	it('has Danish headers in the Danish dialect', () => {
		const csv = longCsv({ years: [2030], series, scenarios: [], dialect: 'da' });
		expect(csv).toBe(`${BOM}scenarie;stød;variant;serie;år;værdi\n`);
	});
});

describe('dictionaryCsv', () => {
	it('quotes labels that contain the separator', () => {
		expect(dictionaryCsv(series, 'intl').split('\n')[2]).toBe(
			'saldo2bnp,"Offentlig saldo, andel af BNP","Public balance, share of GDP",Offentlige finanser,pct. af BNP,pct.-point'
		);
	});

	it('has Danish headers and the deviation unit', () => {
		const lines = dictionaryCsv(series, 'da').split('\n');
		expect(lines[0]).toBe(`${BOM}nøgle;betegnelse;betegnelse_en;gruppe;enhed;afvigelsesenhed`);
		expect(lines[1]).toBe('qBNP;BNP (realt);GDP (real);Nationalregnskab;mia. 2020-kr.;pct.');
	});
});

const model = { name: 'MAKRO 2026-June', commit: '01f2a43', fingerprint: '7ef41d4943c0', dataBasisDa: 'Nationalregnskabsdata fra marts 2026' };
const manifest = (over: Partial<Manifest> = {}): Manifest => ({
	version: '2026.09.27', date: '2026-09-27', format: FORMAT_VERSION, model, license: 'CC-BY-4.0',
	changelog: 'Første udgivelse', files: { 'meta.json': 'aa', 'shocks/Rente_ufin.json': 'bb' }, earlier: [], ...over
});

describe('nextVersion', () => {
	it('is the date, then .2, .3 on the same day', () => {
		expect(nextVersion('2026-09-27', null)).toBe('2026.09.27');
		expect(nextVersion('2026-09-27', '2026.09.20')).toBe('2026.09.27');
		expect(nextVersion('2026-09-27', '2026.09.27')).toBe('2026.09.27.2');
		expect(nextVersion('2026-09-27', '2026.09.27.2')).toBe('2026.09.27.3');
	});
});

describe('changedFiles', () => {
	it('lists changed, added and removed files', () => {
		expect(changedFiles({ a: '1', b: '2', c: '3' }, { a: '1', b: '9', d: '4' })).toEqual(['b', 'c', 'd']);
	});
});

describe('planRelease', () => {
	const files = { 'meta.json': 'aa', 'shocks/Rente_ufin.json': 'cc' };

	it('makes the first release', () => {
		const plan = planRelease({ current: null, currentPublished: false, files, model, date: '2026-09-27', changelog: 'Første udgivelse' });
		expect(plan).toEqual({ manifest: manifest({ files }) });
	});

	it('moves the current version into the earlier ones', () => {
		const plan = planRelease({ current: manifest(), currentPublished: true, files, model, date: '2026-10-02', changelog: 'Moms genberegnet' });
		if (!('manifest' in plan)) throw new Error(plan.refused);
		expect(plan.manifest.version).toBe('2026.10.02');
		expect(plan.manifest.earlier).toEqual([
			{ version: '2026.09.27', date: '2026-09-27', changelog: 'Første udgivelse', url: 'https://github.com/huulbaek/makroskop/releases/tag/data-2026.09.27' }
		]);
	});

	it('refuses when nothing changed', () => {
		const current = manifest();
		expect(planRelease({ current, currentPublished: true, files: current.files, model, date: '2026-10-02', changelog: 'x' })).toEqual({
			refused: 'Ingen ændringer i data, format eller zip siden version 2026.09.27.'
		});
	});

	it('releases when only the format changed', () => {
		const current = manifest({ format: FORMAT_VERSION - 1 });
		expect('manifest' in planRelease({ current, currentPublished: true, files: current.files, model, date: '2026-10-02', changelog: 'Nyt CSV-format' })).toBe(true);
	});

	it('refuses without a changelog line', () => {
		expect(planRelease({ current: null, currentPublished: false, files, model, date: '2026-09-27', changelog: '  ' })).toEqual({
			refused: 'Skriv hvad der er ændret: bun run data:release --changelog "…"'
		});
	});
});

describe('planRelease and publishing', () => {
	it('releases when only the zip changed (read-me or citation wording)', () => {
		const current = manifest();
		const plan = planRelease({ current, currentPublished: true, zipChanged: true, files: current.files, model, date: '2026-10-02', changelog: 'Ny tekst i LAES-MIG' });
		expect('manifest' in plan).toBe(true);
	});

	it('refuses a new version while the current one is not on GitHub', () => {
		const files = { 'meta.json': 'aa', 'shocks/Rente_ufin.json': 'cc' };
		expect(planRelease({ current: manifest(), currentPublished: false, files, model, date: '2026-10-02', changelog: 'x' })).toEqual({
			refused: 'Version 2026.09.27 er ikke udgivet på GitHub endnu: kør bun run data:publish først.'
		});
	});
});

describe('zipManifest', () => {
	it('leaves the DOI and the zip checksum out of the copy inside the zip', () => {
		const m = manifest({ doi: '10.5281/zenodo.1', zip: { name: 'x.zip', bytes: 1, sha256: 'ab' } });
		expect(zipManifest(m)).toEqual(manifest());
	});
});

describe('buildProblems', () => {
	const m = manifest({ zip: { name: 'makroskop-data-2026.09.27.zip', bytes: 10, sha256: 'z1' } });
	const ok = { manifest: m, checksums: m.files, onDisk: Object.keys(m.files), zipSha: 'z1' };

	it('has none when data, format and zip match the version', () => {
		expect(buildProblems(ok)).toEqual([]);
	});

	it('stops a build whose data, files, format or zip no longer match the version', () => {
		expect(buildProblems({ ...ok, manifest: null })).toEqual(['static/data/udgivelse.json mangler: kør bun run data:release.']);
		expect(buildProblems({ ...ok, checksums: { ...m.files, 'meta.json': 'changed' } })).toEqual([
			'Data er ændret siden version 2026.09.27 (meta.json): kør bun run data:release.'
		]);
		expect(buildProblems({ ...ok, onDisk: [...Object.keys(m.files), 'shocks/Ny_ufin.json'] })).toEqual([
			'Datafilerne på disken er ikke dem i udgivelse.json (shocks/Ny_ufin.json): kør bun run data:release.'
		]);
		expect(buildProblems({ ...ok, manifest: { ...m, format: FORMAT_VERSION + 1 } })).toEqual([
			`Filformatet er ændret (${FORMAT_VERSION + 1} → ${FORMAT_VERSION}): kør bun run data:release.`
		]);
		expect(buildProblems({ ...ok, zipSha: 'z2' })).toEqual([
			'Zip-filen for version 2026.09.27 er ikke den udgivne (SHA-256 z2, udgivet z1): tekst eller format er ændret — kør bun run data:release.'
		]);
		expect(buildProblems({ ...ok, manifest: manifest() })).toEqual(['udgivelse.json har ingen zip-kontrolsum: kør bun run data:release.']);
	});
});

describe('manifestText', () => {
	it('is stable, indented JSON with a final newline', () => {
		expect(manifestText(manifest())).toBe(JSON.stringify(manifest(), null, '\t') + '\n');
	});
});

describe('citation', () => {
	it('names the version, the model and the page', () => {
		expect(citation(manifest(), 'da')).toBe(
			'MAKROskop (2026). Scenarieberegninger med MAKRO, dataversion 2026.09.27 [datasæt]. ' +
				'Model: MAKRO 2026-June (01f2a43), Nationalregnskabsdata fra marts 2026. https://makroskop.nodalit.com/aabne-data/'
		);
		expect(citation(manifest(), 'en')).toBe(
			'MAKROskop (2026). Scenario calculations with MAKRO, data version 2026.09.27 [dataset]. ' +
				'Model: MAKRO 2026-June (01f2a43), Nationalregnskabsdata fra marts 2026. https://makroskop.nodalit.com/aabne-data/'
		);
	});

	it('adds the DOI when there is one', () => {
		expect(citation(manifest({ doi: '10.5281/zenodo.123' }), 'da')).toMatch(/ https:\/\/doi\.org\/10\.5281\/zenodo\.123$/);
	});
});

describe('readme and CITATION.cff', () => {
	it('carries the version, the licence, the credit and the citation', () => {
		const text = readme(manifest(), 78);
		expect(text).toContain('Version 2026.09.27');
		expect(text).toContain('CC BY 4.0');
		expect(text).toContain('DREAM');
		expect(text).toContain('78 scenarier');
		expect(text).toContain(citation(manifest(), 'da'));
	});

	it('writes a CITATION.cff for the version', () => {
		const cff = citationCff(manifest());
		expect(cff).toContain('cff-version: 1.2.0');
		expect(cff).toContain('version: "2026.09.27"');
		expect(cff).toContain('date-released: "2026-09-27"');
		expect(cff).toContain('license: CC-BY-4.0');
		expect(cff).toContain('url: "https://github.com/DREAM-DK/MAKRO"');
	});
});

describe('publishProblems', () => {
	const ok = { manifest: manifest(), ghAuthed: true, tagExists: false, changed: [] as string[], unpushed: 0, uncommitted: [] as string[] };

	it('has none when everything is in place', () => {
		expect(publishProblems(ok)).toEqual([]);
	});

	it('names every reason to stop', () => {
		expect(publishProblems({ manifest: null, ghAuthed: false, tagExists: false, changed: [], unpushed: 0, uncommitted: [] })).toEqual([
			'Ingen udgivelse: kør bun run data:release først.',
			'gh er ikke logget ind: kør gh auth login.'
		]);
		expect(publishProblems({ ...ok, tagExists: true })).toEqual(['data-2026.09.27 findes allerede på GitHub.']);
		expect(publishProblems({ ...ok, changed: ['shocks/Moms_perm.json'] })).toEqual([
			'Data er ændret siden version 2026.09.27 (shocks/Moms_perm.json): kør bun run data:release.'
		]);
		expect(publishProblems({ ...ok, unpushed: 2 })).toEqual(['2 commit(s) er ikke pushet: push først, så tagget peger på manifestet.']);
		// data:release run but not committed: the tag would point at a commit with the old manifest
		expect(publishProblems({ ...ok, uncommitted: ['app/static/data/udgivelse.json', 'CITATION.cff'] })).toEqual([
			'Ikke committet: app/static/data/udgivelse.json, CITATION.cff — commit og push først.'
		]);
		// no upstream (git rev-list @{u}..HEAD fails): unknown is not zero
		expect(publishProblems({ ...ok, unpushed: null })).toEqual(['Grenen har ingen upstream: push den først, så tagget peger på manifestet.']);
	});
});

describe('releaseNotes', () => {
	it('has the changelog, the citation and the licence', () => {
		const notes = releaseNotes(manifest());
		expect(notes).toContain('Første udgivelse');
		expect(notes).toContain(citation(manifest(), 'da'));
		expect(notes).toContain('CC BY 4.0');
	});
});
