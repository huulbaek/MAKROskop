/** Open data (makroskop-gko): the downloadable files behind /aabne-data/. This module is pure and
 *  browser-safe (the page imports it); file I/O, checksums and the zip live in
 *  server/opendata-files.ts. Design: docs/superpowers/specs/2026-09-27-open-data-design.md. */
import { devUnit, type SeriesMeta } from './data';

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
