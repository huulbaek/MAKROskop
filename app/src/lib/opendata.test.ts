import { describe, expect, it } from 'vitest';
import type { SeriesMeta } from './data';
import { BOM, csvNumber, dictionaryCsv, longCsv, wideCsv } from './opendata';

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
