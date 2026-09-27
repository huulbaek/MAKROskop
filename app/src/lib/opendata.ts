/** Open data (makroskop-gko): the downloadable files behind /aabne-data/. This module is pure and
 *  browser-safe (the page imports it); file I/O, checksums and the zip live in
 *  server/opendata-files.ts. Design: docs/superpowers/specs/2026-09-27-open-data-design.md. */
import { devUnit, type Meta, type SeriesMeta } from './data';
import { SITE_URL } from './site';

/** 'intl': comma, decimal point, UTF-8. 'da': semicolon, decimal comma, UTF-8 with BOM (Danish Excel). */
export type Dialect = 'intl' | 'da';
export const BOM = '﻿';
const SEPARATOR: Record<Dialect, string> = { intl: ',', da: ';' };

/** A value with 4 decimals in the dialect; empty for null or non-finite, never -0 or an exponent. */
export function csvNumber(value: number | null | undefined, dialect: Dialect): string {
	if (value == null || !Number.isFinite(value)) return '';
	const rounded = Number(value.toFixed(4));
	const text = (rounded === 0 ? 0 : rounded).toString();
	return dialect === 'da' ? text.replace('.', ',') : text;
}

function cell(text: string, dialect: Dialect): string {
	return text.includes(SEPARATOR[dialect]) || text.includes('"') || text.includes('\n')
		? `"${text.replaceAll('"', '""')}"`
		: text;
}

function csv(rows: string[][], dialect: Dialect): string {
	const body = rows.map((row) => row.map((c) => cell(c, dialect)).join(SEPARATOR[dialect])).join('\n') + '\n';
	return dialect === 'da' ? BOM + body : body;
}

/** The series the open data publishes: those whose deviations are pct. or pct.-point. The 'gdp_pp'
 *  series (vSaldo, vPrimSaldo, vOff13Net) are raw level differences ×100 in the scenario JSON, which
 *  no unit describes; their ratios to BNP (saldo2bnp, primsaldo2bnp, nettoformue2bnp) are published. */
export function publishedSeries(series: SeriesMeta[]): SeriesMeta[] {
	return series.filter((s) => s.devMode === 'pct' || s.devMode === 'pp');
}

/** One scenario (or the baseline) as one row per year and one column per series. */
export function wideCsv(p: {
	years: number[];
	series: SeriesMeta[];
	values: Record<string, (number | null)[]>;
	dialect: Dialect;
}): string {
	const header =
		p.dialect === 'intl' ? ['year', ...p.series.map((s) => s.key)] : ['år', ...p.series.map((s) => `${s.labelDa} [${s.key}]`)];
	const rows = p.years.map((year, i) => [String(year), ...p.series.map((s) => csvNumber(p.values[s.key]?.[i], p.dialect))]);
	return csv([header, ...rows], p.dialect);
}

export interface ScenarioRef {
	file: string;
	shock: string;
	variation: string;
	deviations: Record<string, (number | null)[]>;
}

/** Every scenario in one tidy file: one row per non-null value. */
export function longCsv(p: { years: number[]; series: SeriesMeta[]; scenarios: ScenarioRef[]; dialect: Dialect }): string {
	const header =
		p.dialect === 'intl'
			? ['scenario', 'shock', 'variant', 'series', 'year', 'value']
			: ['scenarie', 'stød', 'variant', 'serie', 'år', 'værdi'];
	const rows: string[][] = [header];
	for (const scenario of p.scenarios) {
		for (const s of p.series) {
			const values = scenario.deviations[s.key] ?? [];
			p.years.forEach((year, i) => {
				const text = csvNumber(values[i], p.dialect);
				if (text !== '') rows.push([scenario.file, scenario.shock, scenario.variation, s.key, String(year), text]);
			});
		}
	}
	return csv(rows, p.dialect);
}

/** What every column means: labels, group, level unit and the unit of its deviations. */
export function dictionaryCsv(series: SeriesMeta[], dialect: Dialect): string {
	const header =
		dialect === 'intl'
			? ['key', 'label_da', 'label_en', 'group', 'unit', 'deviation_unit']
			: ['nøgle', 'betegnelse', 'betegnelse_en', 'gruppe', 'enhed', 'afvigelsesenhed'];
	const rows = series.map((s) => [s.key, s.labelDa, s.labelEn, s.group, s.unit, devUnit(s.devMode)]);
	return csv([header, ...rows], dialect);
}

/** Bumped whenever a CSV or zip layout changes, so a published version's zip never changes. */
export const FORMAT_VERSION = 1;
export const DATA_LICENSE = 'CC-BY-4.0';
export const REPO_URL = 'https://github.com/huulbaek/makroskop';

export interface ReleaseRef {
	version: string;
	date: string;
	changelog: string;
	url: string;
}

/** static/data/udgivelse.json: what the current data is, its checksums, and the earlier versions. */
export interface Manifest {
	version: string;
	date: string;
	format: number;
	model: Meta['model'];
	license: string;
	doi?: string;
	changelog: string;
	/** SHA-256 of each committed data file, by path under static/data/. */
	files: Record<string, string>;
	earlier: ReleaseRef[];
	/** The release zip as data:release built it; every later build must give the same bytes. Not in
	 *  the zip's own copy of the manifest (zipManifest). */
	zip?: { name: string; bytes: number; sha256: string };
}

/** The manifest inside the zip: without the zip's own checksum and without the DOI, which Zenodo
 *  mints after the release, so adding either never changes a published zip. */
export function zipManifest(m: Manifest): Manifest {
	const { doi: _doi, zip: _zip, ...rest } = m;
	return rest;
}

export function manifestText(m: Manifest): string {
	return JSON.stringify(m, null, '\t') + '\n';
}

export function releaseTag(version: string): string {
	return `data-${version}`;
}

export function releaseUrl(version: string): string {
	return `${REPO_URL}/releases/tag/${releaseTag(version)}`;
}

/** `YYYY.MM.DD` from the release date; a second release that day is `.2`, then `.3`, … */
export function nextVersion(date: string, current: string | null): string {
	const base = date.replaceAll('-', '.');
	if (!current || (current !== base && !current.startsWith(`${base}.`))) return base;
	const n = current === base ? 1 : Number(current.slice(base.length + 1));
	return `${base}.${n + 1}`;
}

export function changedFiles(before: Record<string, string>, after: Record<string, string>): string[] {
	const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
	return [...paths].filter((p) => before[p] !== after[p]).sort();
}

/** The next manifest, or why there is none. */
export function planRelease(p: {
	current: Manifest | null;
	/** The current version has a GitHub Release (earlier versions link there, and its zip leaves the site). */
	currentPublished: boolean;
	/** Rebuilding the current version's zip gives other bytes than it was released with (wording, format). */
	zipChanged?: boolean;
	files: Record<string, string>;
	model: Meta['model'];
	date: string;
	changelog: string;
}): { manifest: Manifest } | { refused: string } {
	const { current } = p;
	if (current && changedFiles(current.files, p.files).length === 0 && current.format === FORMAT_VERSION && !p.zipChanged) {
		return { refused: `Ingen ændringer i data, format eller zip siden version ${current.version}.` };
	}
	if (!p.changelog.trim()) return { refused: 'Skriv hvad der er ændret: bun run data:release --changelog "…"' };
	if (current && !p.currentPublished) {
		return { refused: `Version ${current.version} er ikke udgivet på GitHub endnu: kør bun run data:publish først.` };
	}
	return {
		manifest: {
			version: nextVersion(p.date, current?.version ?? null),
			date: p.date,
			format: FORMAT_VERSION,
			model: p.model,
			license: DATA_LICENSE,
			changelog: p.changelog.trim(),
			files: p.files,
			earlier: current
				? [{ version: current.version, date: current.date, changelog: current.changelog, url: releaseUrl(current.version) }, ...current.earlier]
				: []
		}
	};
}

function modelLine(m: Manifest): string {
	const version = m.model.commit ? `${m.model.name} (${m.model.commit})` : m.model.name;
	return m.model.dataBasisDa ? `${version}, ${m.model.dataBasisDa}` : version;
}

export function citation(m: Manifest, lang: 'da' | 'en'): string {
	const year = m.date.slice(0, 4);
	const title =
		lang === 'da'
			? `Scenarieberegninger med MAKRO, dataversion ${m.version} [datasæt]`
			: `Scenario calculations with MAKRO, data version ${m.version} [dataset]`;
	const doi = m.doi ? ` https://doi.org/${m.doi}` : '';
	return `MAKROskop (${year}). ${title}. Model: ${modelLine(m)}. ${SITE_URL}/aabne-data/${doi}`;
}

/** LAES-MIG.md in the zip. */
export function readme(m: Manifest, scenarioCount: number): string {
	return `# MAKROskop – data, version ${m.version}

Version ${m.version} (${m.date}) · ${modelLine(m)} · ${scenarioCount} scenarier.
${m.changelog}

## Hvad tallene er

Hvert scenarie er ét stød til MAKRO – DREAM-gruppens makroøkonomiske model af Danmark – løst med
MAKROskops frie løser over hele modellens horisont (til 2129; filerne går til 2100). Tallene er
afvigelser fra modellens kalibrerede referenceforløb: pct. for mængder og priser, pct.-point for
satser, andele og saldi (se \`ordbog.csv\`). Stødet sættes ind i 2030. Varianterne:
_ufin = permanent og ufinansieret; _perm = permanent og finansieret med den beregningstekniske
lukkeskat, så den offentlige nettoformue i 2129 udgør samme andel af BNP som i grundforløbet.
Løseren er efterprøvet mod GAMS: ${SITE_URL}/validering/

## Filer

- \`shocks/<scenarie>.json\`, \`meta.json\`, \`baseline.json\`: de samme filer som hjemmesiden bruger.
  JSON-filerne indeholder også vSaldo, vPrimSaldo og vOff13Net som interne niveauforskelle ×100;
  brug i stedet saldo2bnp, primsaldo2bnp og nettoformue2bnp (pct.-point af BNP), som CSV-filerne har.
- \`csv/\`: kommasepareret, decimalpunktum, UTF-8 (R, Python, Stata).
- \`csv-da/\`: semikolonsepareret, decimalkomma, UTF-8 med BOM (dansk Excel).
- \`csv*/<scenarie>.csv\`: én række pr. år, én kolonne pr. serie.
- \`csv*/alle-scenarier.csv\`: alle scenarier i langt format (scenarie, stød, variant, serie, år, værdi).
- \`csv*/grundforloeb.csv\`: grundforløbets niveauer.
- \`ordbog.csv\`, \`ordbog-da.csv\`: seriernes betegnelser, enheder og afvigelsesenheder.
- \`udgivelse.json\`: version, model og SHA-256 for hver datafil.

## Citér

${citation(m, 'da')}

${citation(m, 'en')}

## Licens

Data: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) – kreditér MAKROskop.
Modellen er DREAM-gruppens MAKRO (https://github.com/DREAM-DK/MAKRO, MIT). MAKROskop er en
uafhængig prototype og ikke et produkt fra DREAM eller Finansministeriet.

## English

Scenario results from DREAM's MAKRO model of Denmark, solved with MAKROskop's free solver.
Values are deviations from the calibrated reference path (pct. or pct.-points, see \`ordbog.csv\`),
shock year 2030. Licence CC BY 4.0; please cite as above.
`;
}

/** CITATION.cff at the repository root (GitHub's "Cite this repository"). */
export function citationCff(m: Manifest): string {
	return `cff-version: 1.2.0
message: "Brug gerne tallene – citér dem sådan. / Please cite the data as below."
type: dataset
title: "MAKROskop: scenarieberegninger med MAKRO"
authors:
  - given-names: Thomas
    family-names: Titanium
version: "${m.version}"
date-released: "${m.date}"
url: "${SITE_URL}/aabne-data/"
repository-code: "${REPO_URL}"
license: ${DATA_LICENSE}
${m.doi ? `doi: "${m.doi}"\n` : ''}references:
  - type: software
    title: "MAKRO"
    authors:
      - name: "DREAM"
    url: "https://github.com/DREAM-DK/MAKRO"
    license: MIT
`;
}

/** Why data:publish must not create the GitHub Release; empty when it may. */
export function publishProblems(p: {
	manifest: Manifest | null;
	ghAuthed: boolean;
	tagExists: boolean;
	changed: string[];
	/** Commits not on the upstream; null when there is no upstream to compare with. */
	unpushed: number | null;
	/** Uncommitted changes to the manifest, the data or CITATION.cff (git status --porcelain). */
	uncommitted: string[];
}): string[] {
	const problems: string[] = [];
	if (!p.manifest) problems.push('Ingen udgivelse: kør bun run data:release først.');
	if (!p.ghAuthed) problems.push('gh er ikke logget ind: kør gh auth login.');
	if (p.manifest && p.tagExists) problems.push(`${releaseTag(p.manifest.version)} findes allerede på GitHub.`);
	if (p.manifest && p.changed.length)
		problems.push(`Data er ændret siden version ${p.manifest.version} (${p.changed.join(', ')}): kør bun run data:release.`);
	if (p.uncommitted.length) problems.push(`Ikke committet: ${p.uncommitted.join(', ')} — commit og push først.`);
	if (p.unpushed === null) problems.push('Grenen har ingen upstream: push den først, så tagget peger på manifestet.');
	else if (p.unpushed > 0) problems.push(`${p.unpushed} commit(s) er ikke pushet: push først, så tagget peger på manifestet.`);
	return problems;
}

export function releaseNotes(m: Manifest): string {
	return `${m.changelog}\n\n${modelLine(m)}\n\nCitér: ${citation(m, 'da')}\n\nLicens: CC BY 4.0 – ${SITE_URL}/aabne-data/`;
}

/** Why a build must not ship: the committed data, files, format or zip differ from the released version. */
export function buildProblems(p: {
	manifest: Manifest | null;
	checksums: Record<string, string>;
	onDisk: string[];
	zipSha: string;
}): string[] {
	const m = p.manifest;
	if (!m) return ['static/data/udgivelse.json mangler: kør bun run data:release.'];
	const problems: string[] = [];
	const changed = changedFiles(m.files, p.checksums);
	if (changed.length) problems.push(`Data er ændret siden version ${m.version} (${changed.join(', ')}): kør bun run data:release.`);
	const listed = new Set(Object.keys(m.files));
	const unlisted = p.onDisk.filter((f) => !listed.has(f));
	if (unlisted.length)
		problems.push(`Datafilerne på disken er ikke dem i udgivelse.json (${unlisted.join(', ')}): kør bun run data:release.`);
	if (m.format !== FORMAT_VERSION) problems.push(`Filformatet er ændret (${m.format} → ${FORMAT_VERSION}): kør bun run data:release.`);
	if (!m.zip) problems.push('udgivelse.json har ingen zip-kontrolsum: kør bun run data:release.');
	else if (!problems.length && m.zip.sha256 !== p.zipSha)
		problems.push(
			`Zip-filen for version ${m.version} er ikke den udgivne (SHA-256 ${p.zipSha}, udgivet ${m.zip.sha256}): tekst eller format er ændret — kør bun run data:release.`
		);
	return problems;
}
