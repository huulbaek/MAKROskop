import { describe, expect, it } from 'vitest';
import { cardTiles } from './card';
import { QUESTIONS, buildAnswer, countWord, fiveYearLine, homeHead, trimScenario, type TrimmedScenario } from './frontpage';
import { RECOMPUTING } from './notices';
import { levelsAt, readBaseline, readMeta, readScenario } from './server/scenarios';

describe('QUESTIONS', () => {
	it('opens on the ECB rate', () => {
		expect(QUESTIONS[0].file).toBe('Rente_ufin');
	});

	it('asks nothing whose scenario is being recomputed', () => {
		for (const q of QUESTIONS) expect(RECOMPUTING[q.file.replace(/_ufin$/, '')], q.file).toBeUndefined();
	});

	it('every question points at a solved unfinanced scenario', () => {
		const meta = readMeta();
		for (const q of QUESTIONS) {
			const name = q.file.replace(/_ufin$/, '');
			expect(q.file, q.chip).toMatch(/_ufin$/);
			expect(meta.shocks.find((s) => s.name === name)?.available, q.file).toContain('_ufin');
		}
	});

	it('every question was written against the size the scenario was solved at', () => {
		for (const q of QUESTIONS) {
			expect(readScenario(q.file).definition?.changeDa, q.file).toBe(q.solvedAs);
		}
	});

	it('pins the catalog move (factor, delta) each question was written for', () => {
		for (const q of QUESTIONS) {
			const def = readScenario(q.file).definition;
			expect({ factor: def?.factor, delta: def?.delta }, q.file).toEqual(q.solvedMove);
		}
	});

	it('the instrument moved by exactly that much, where the scenario carries its series', () => {
		const yearStart = readMeta().yearStart;
		let checked = 0;
		for (const q of QUESTIONS) {
			const scenario = readScenario(q.file);
			const def = scenario.definition!;
			if (!def.seriesKey) continue;
			const expected = def.delta !== 0 ? def.delta * 100 : (def.factor - 1) * 100;
			expect(scenario.deviations[def.seriesKey]?.[def.firstYear - yearStart], q.file).toBeCloseTo(expected, 6);
			checked++;
		}
		expect(checked).toBeGreaterThan(0);
	});

	it('states the export shock as a larger market, not a growth rate', () => {
		expect(QUESTIONS.find((q) => q.file === 'Eksportmarkedsvaekst_ufin')?.question).toBe('eksportmarkederne bliver 1 pct. større?');
	});
});

/** 1985-based series with values only where the test sets them. */
function series(yearStart: number, values: Record<number, number>): (number | null)[] {
	return Array.from({ length: 50 }, (_, i) => values[yearStart + i] ?? 0);
}

const fake = (nL: Record<number, number>): TrimmedScenario => ({
	shock: 'X',
	variation: '_ufin',
	definition: { firstYear: 2030, changeDa: '+1 pct.' },
	deviations: {
		qBNP: series(1985, { 2032: -1.16 }),
		nL: series(1985, nL),
		saldo2bnp: series(1985, { 2030: -0.97 })
	}
});

describe('fiveYearLine', () => {
	it('says the effect has faded when at most a fifth is left', () => {
		expect(fiveYearLine(-10942, -129)).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (−130 personer).');
		expect(fiveYearLine(-2176, 108)).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (+110 personer).');
	});

	it('says the effect has grown when it is larger with the same sign', () => {
		expect(fiveYearLine(17427, 30714)).toBe('Efter 5 år er effekten vokset til +30.700 personer.');
	});

	it('states the number otherwise', () => {
		expect(fiveYearLine(3000, 1500)).toBe('Efter 5 år: +1.500 personer i beskæftigelse i forhold til grundforløbet.');
	});

	it('handles a zero first-year effect without dividing', () => {
		expect(fiveYearLine(0, 0)).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (0 personer).');
		expect(fiveYearLine(0, 500)).toBe('Efter 5 år: +500 personer i beskæftigelse i forhold til grundforløbet.');
	});
});

describe('trimScenario', () => {
	it('keeps exactly the three answer series and the definition fields the page uses', () => {
		const trimmed = trimScenario(readScenario('Rente_ufin'));
		expect(Object.keys(trimmed.deviations).sort()).toEqual(['nL', 'qBNP', 'saldo2bnp']);
		expect(Object.keys(trimmed.definition).sort()).toEqual(['changeDa', 'firstYear']);
		expect(JSON.stringify(trimmed).length).toBeLessThan(8000);
	});
});

describe('buildAnswer', () => {
	const question = QUESTIONS[0];
	const levels = { nL: 3000, vBNP: 3000 };

	it('uses the share cards’ tiles', () => {
		const scenario = fake({ 2030: -0.4, 2034: -0.004 });
		const answer = buildAnswer({ question, scenario, yearStart: 1985, levels, nL5: 3000 });
		expect(answer.tiles).toEqual(cardTiles({ scenario, definition: scenario.definition, yearStart: 1985, levels, scale: 1 }));
		expect(answer.href).toBe('/scenarier/Rente_ufin/');
	});

	it('builds the five-year line from employment in the shock year + 4', () => {
		// −0,4 % of 3.000.000 = −12.000 in year 1; −0,004 % of 3.000.000 = −120 in year 5
		const answer = buildAnswer({ question, scenario: fake({ 2030: -0.4, 2034: -0.004 }), yearStart: 1985, levels, nL5: 3000 });
		expect(answer.fiveYear).toBe('Efter 5 år er beskæftigelseseffekten næsten væk (−120 personer).');
	});

	it('leaves the five-year line out when a level is missing', () => {
		const answer = buildAnswer({ question, scenario: fake({ 2030: -0.4 }), yearStart: 1985, levels, nL5: null });
		expect(answer.fiveYear).toBeNull();
	});

	it('says the shock is permanent and unfinanced, and from when', () => {
		const answer = buildAnswer({ question, scenario: fake({ 2030: -0.4 }), yearStart: 1985, levels, nL5: 3000 });
		expect(answer.framing).toBe('Varigt, ufinansieret stød fra 2030 · tallene er afvigelser fra grundforløbet');
	});

	it('charts BNP and employment', () => {
		const answer = buildAnswer({ question, scenario: fake({ 2030: -0.4 }), yearStart: 1985, levels, nL5: 3000 });
		expect(answer.chart.map((s) => [s.key, s.label])).toEqual([['qBNP', 'BNP'], ['nL', 'Beskæftigelse']]);
	});

	it('answers the real default question with the published numbers', () => {
		const baseline = readBaseline();
		const scenario = trimScenario(readScenario('Rente_ufin'));
		const y1 = scenario.definition.firstYear;
		const answer = buildAnswer({
			question, scenario, yearStart: readMeta().yearStart,
			levels: levelsAt(baseline, y1), nL5: levelsAt(baseline, y1 + 4)?.nL ?? null
		});
		expect(answer.tiles.map((t) => t.value)).toEqual(['−10.900', '−1,2', '−1,0']);
		expect(answer.fiveYear).toMatch(/^Efter 5 år er beskæftigelseseffekten næsten væk/);
	});
});

describe('homeHead', () => {
	it('puts the default question and its numbers in the description', () => {
		const answer = buildAnswer({ question: QUESTIONS[0], scenario: fake({ 2030: -0.4 }), yearStart: 1985, levels: { nL: 3000, vBNP: 3000 }, nL5: 3000 });
		const head = homeHead(answer);
		expect(head.title).toBe('MAKROskop – spørg Finansministeriets model, hvad der sker, hvis …');
		expect(head.description).toBe(
			'Hvad sker der, hvis ECB hæver renten med 1 pct.-point? MAKRO, varigt og ufinansieret: beskæftigelse −12.000 personer i år 1, BNP −1,2 pct. efter 3 år, offentlig saldo −1,0 pct. af BNP i år 1. Seks spørgsmål til Finansministeriets model, besvaret med MAKROskops frie løser.'.replace('Seks', countWord(QUESTIONS.length))
		);
	});
});
