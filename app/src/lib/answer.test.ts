import { describe, expect, it } from 'vitest';
import { answerText, buildAnswerSentence, type AnswerInput } from './answer';
import { levelsAt, readBaseline, readMeta, readScenario } from './server/scenarios';

const YEAR_START = 2025;

/** Deviations indexed from 2025, with values only where the test sets them. */
function series(values: Record<number, number>): (number | null)[] {
	return Array.from({ length: 20 }, (_, i) => values[YEAR_START + i] ?? 0);
}

/** 3.000 thousand persons and 3.000 mia. kr. in every year. */
const flatLevels = () => ({ nL: 3000, vBNP: 3000 });

function input(overrides: Partial<AnswerInput> & { nL?: Record<number, number>; qBNP?: Record<number, number>; saldo?: Record<number, number>; tLukning?: Record<number, number> } = {}): AnswerInput {
	const { nL = {}, qBNP = {}, saldo = {}, tLukning, ...rest } = overrides;
	return {
		subject: 'Bundskattesats',
		definition: { firstYear: 2030, factor: 1, delta: 0.01, changeDa: '+1 pct.-point' },
		variation: '_ufin',
		scenario: {
			deviations: {
				nL: series(nL), qBNP: series(qBNP), saldo2bnp: series(saldo),
				...(tLukning ? { tLukning: series(tLukning) } : {})
			}
		},
		yearStart: YEAR_START,
		levelsAt: flatLevels,
		scale: 1,
		...rest
	};
}

describe('lead', () => {
	it('names the shock, its size, the year, the profile and the financing', () => {
		expect(buildAnswerSentence(input()).lead).toBe('Bundskattesats +1 pct.-point fra 2030, varigt og ufinansieret:');
		expect(buildAnswerSentence(input({ variation: '_perm' })).lead).toBe(
			'Bundskattesats +1 pct.-point fra 2030, varigt og finansieret via lukkeskat:'
		);
	});

	it('says when the numbers are scaled or mirrored, and scales the change', () => {
		expect(buildAnswerSentence(input({ scale: 0.5 })).lead).toBe(
			'Bundskattesats +0,5 pct.-point fra 2030, varigt og ufinansieret (lineært skaleret):'
		);
		expect(buildAnswerSentence(input({ scale: -1 })).lead).toBe(
			'Bundskattesats −1 pct.-point fra 2030, varigt og ufinansieret (spejlet stød, lineær tilnærmelse):'
		);
	});
});

describe('employment', () => {
	// 0,1 % of 3.000 thousand = 3.000 persons
	it('says a first-year effect that has faded after five years', () => {
		const { body } = buildAnswerSentence(input({ nL: { 2030: -0.4, 2034: -0.004 } }));
		expect(body).toContain('Beskæftigelsen falder med 12.000 personer det første år, men efter 5 år er effekten næsten væk.');
	});

	it('gives both numbers when the effect persists or grows with the same sign', () => {
		const { body } = buildAnswerSentence(input({ nL: { 2030: 0.1, 2034: 1 } }));
		expect(body).toContain('Beskæftigelsen stiger med 3.000 personer det første år og med 30.000 personer efter 5 år.');
	});

	it('says a small start and a large fifth year as a build-up', () => {
		const { body } = buildAnswerSentence(input({ nL: { 2030: 0.001, 2034: 1 } }));
		expect(body).toContain('Beskæftigelsen ændres kun lidt det første år, men efter 5 år ligger den 30.000 personer over grundforløbet.');
	});

	it('says a reversal against the baseline', () => {
		const { body } = buildAnswerSentence(input({ nL: { 2030: 0.2, 2034: -0.1 } }));
		expect(body).toContain('Beskæftigelsen stiger med 6.000 personer det første år, men efter 5 år ligger den 3.000 personer under grundforløbet.');
	});

	it('says an effect below a hundred persons both years as unchanged', () => {
		const { body } = buildAnswerSentence(input({ nL: { 2030: 0.001, 2034: -0.002 } }));
		expect(body).toContain('Beskæftigelsen er stort set uændret de første fem år.');
	});

	it('leaves employment out when a baseline level is missing', () => {
		const { body } = buildAnswerSentence(input({ nL: { 2030: -0.4 }, levelsAt: (year) => (year === 2030 ? flatLevels() : null) }));
		expect(body).not.toContain('Beskæftigelsen');
	});
});

describe('BNP', () => {
	it('states the third-year effect without a sign, as higher or lower', () => {
		expect(buildAnswerSentence(input({ qBNP: { 2032: -1.16 } })).body).toContain('BNP er 1,2 pct. lavere efter 3 år.');
		expect(buildAnswerSentence(input({ qBNP: { 2032: 0.054 } })).body).toContain('BNP er 0,05 pct. højere efter 3 år.');
	});

	it('says an effect that rounds to zero as unchanged', () => {
		expect(buildAnswerSentence(input({ qBNP: { 2032: 0.004 } })).body).toContain('BNP er stort set uændret efter 3 år.');
	});
});

describe('public finances', () => {
	it('puts the unfinanced first-year saldo in kroner and pct. of BNP', () => {
		// −1,0 pct. of 3.000 mia. kr.
		expect(buildAnswerSentence(input({ saldo: { 2030: -0.97 } })).body).toContain(
			'De offentlige finanser svækkes med ca. 29 mia. kr. det første år (−1,0 pct. af BNP).'
		);
		expect(buildAnswerSentence(input({ saldo: { 2030: 0.1 } })).body).toContain(
			'De offentlige finanser styrkes med ca. 3,0 mia. kr. det første år (+0,1 pct. af BNP).'
		);
	});

	it('leaves out a pct. of BNP that rounds to zero', () => {
		// 0,003 pct. of 3.000 mia. kr. = 0,09 mia. kr.
		expect(buildAnswerSentence(input({ saldo: { 2030: -0.003 } })).body).toContain(
			'De offentlige finanser svækkes med ca. 0,1 mia. kr. det første år.'
		);
	});

	it('says a saldo effect below 50 mio. kr. as unaffected', () => {
		expect(buildAnswerSentence(input({ saldo: { 2030: 0.001 } })).body).toContain(
			'De offentlige finanser er stort set upåvirkede det første år.'
		);
	});

	it('states the closure-tax move for a financed run instead of the saldo', () => {
		const financed = input({ variation: '_perm', saldo: { 2030: 0.3 }, tLukning: { 2030: -2.1258 } });
		const { body } = buildAnswerSentence(financed);
		expect(body).toContain('Lukkeskatten – et beregningsteknisk tillæg til husholdningernes direkte skatter – kan sænkes 2,13 pct.-point, og de offentlige finanser forbliver holdbare.');
		expect(body).not.toContain('mia. kr.');
		const raised = buildAnswerSentence(input({ variation: '_perm', tLukning: { 2030: 0.4 } })).body;
		expect(raised).toContain('Lukkeskatten – et beregningsteknisk tillæg til husholdningernes direkte skatter – skal hæves 0,4 pct.-point, for at de offentlige finanser forbliver holdbare.');
	});

	it('scales the kroner with the slider', () => {
		expect(buildAnswerSentence(input({ saldo: { 2030: -0.97 }, scale: -0.5 })).body).toContain(
			'De offentlige finanser styrkes med ca. 15 mia. kr. det første år (+0,5 pct. af BNP).'
		);
	});
});

describe('answerText', () => {
	it('joins lead and body into one quotable paragraph', () => {
		expect(answerText({ lead: 'A:', body: 'B.' })).toBe('A: B.');
	});
});

describe('published scenarios', () => {
	const meta = readMeta();
	const baseline = readBaseline();
	const answerFor = (file: string, subject: string) => {
		const scenario = readScenario(file);
		return answerText(buildAnswerSentence({
			subject, definition: scenario.definition!, variation: scenario.variation, scenario,
			yearStart: meta.yearStart, levelsAt: (year) => levelsAt(baseline, year), scale: 1
		}));
	};

	it('answers the ECB rate with the numbers its tiles show', () => {
		expect(answerFor('Rente_ufin', 'ECB-renten')).toMatch(
			/^ECB-renten \+1 pct\.-point fra 2030, varigt og ufinansieret: Beskæftigelsen falder med 10\.900 personer det første år, men efter 5 år er effekten næsten væk\. BNP er 1,2 pct\. lavere efter 3 år\. De offentlige finanser svækkes med ca\. \d+ mia\. kr\. det første år \(−1,0 pct\. af BNP\)\.$/
		);
	});

	it('shows the labour-supply shock building up', () => {
		expect(answerFor('Arbejdsudbud_beskaeftigelse_ufin', 'Strukturel beskæftigelse')).toMatch(/og med [\d.]+ personer efter 5 år|ligger den [\d.]+ personer over grundforløbet/);
	});

	it('answers a financed run with the closure tax', () => {
		expect(answerFor('Bundskat_perm', 'Bundskattesats')).toContain('direkte skatter – kan sænkes');
	});
});
