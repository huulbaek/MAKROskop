/** The front page: six curated "Hvad sker der, hvis …" questions, each answered by a solved
 *  unfinanced scenario exactly as solved — no scaling, no mirroring. Spec:
 *  docs/superpowers/specs/2026-09-25-front-page-design.md (makroskop-169). */
import { cardTiles, formatPersons, type CardLevels, type CardTile } from './card';
import type { Scenario, ScenarioDefinition } from './data';

export interface Question {
	/** Short form on the chip. */
	chip: string;
	/** The question after "Hvad sker der, hvis …". */
	question: string;
	/** Scenario file stem in static/data/shocks. */
	file: string;
	/** The scenario's definition.changeDa the wording was written against; a test pins it,
	 *  so a re-solve at another size fails instead of shipping a wrong question. */
	solvedAs: string;
}

/** Demand shocks fade within five years as wages adjust; the labour-supply shock keeps
 *  growing — the set is chosen so that contrast shows without prose. Default first. */
export const QUESTIONS: Question[] = [
	{ chip: 'renten stiger', question: 'ECB hæver renten med 1 pct.-point?', file: 'Rente_ufin', solvedAs: '+1 pct.-point (100 basispoint)' },
	{ chip: 'momsen sænkes', question: 'momsen sænkes med 0,5 pct.-point?', file: 'Moms_ned_ufin', solvedAs: '−0,5 pct.-point' },
	{ chip: 'bundskatten hæves', question: 'bundskatten hæves med 1 pct.-point?', file: 'Bundskat_ufin', solvedAs: '+1 pct.-point' },
	{ chip: 'det offentlige forbrug øges', question: 'det offentlige forbrug øges med 1 pct.?', file: 'Offentligt_forbrug_ufin', solvedAs: '+1 pct.' },
	{ chip: 'eksporten vokser', question: 'eksportmarkederne vokser 1 pct.?', file: 'Eksportmarkedsvaekst_ufin', solvedAs: '+1 pct.' },
	{ chip: 'flere vil arbejde', question: '1 pct. flere vil arbejde?', file: 'Arbejdsudbud_beskaeftigelse_ufin', solvedAs: '+1 pct.' }
];

const ANSWER_SERIES = ['qBNP', 'nL', 'saldo2bnp'] as const;

export interface TrimmedScenario {
	shock: string;
	variation: string;
	definition: Pick<ScenarioDefinition, 'firstYear' | 'changeDa'>;
	deviations: Record<string, (number | null)[]>;
}

/** Only what the answer uses: ~3 KB instead of the 54 KB scenario file, times six in the page. */
export function trimScenario(scenario: Scenario): TrimmedScenario {
	const def = scenario.definition;
	if (!def) throw new Error(`${scenario.shock}${scenario.variation}: scenario has no definition`);
	return {
		shock: scenario.shock,
		variation: scenario.variation,
		definition: { firstYear: def.firstYear, changeDa: def.changeDa },
		deviations: Object.fromEntries(ANSWER_SERIES.map((key) => [key, scenario.deviations[key] ?? []]))
	};
}

/** Employment five years on (shock year + 4), in persons, against year 1. */
export function fiveYearLine(y1: number, y5: number): string {
	const persons = `${formatPersons(y5)} personer`;
	if (Math.abs(y5) <= 0.2 * Math.abs(y1)) return `Efter 5 år er beskæftigelseseffekten næsten væk (${persons}).`;
	if (Math.sign(y5) === Math.sign(y1) && Math.abs(y5) > Math.abs(y1)) return `Efter 5 år er effekten vokset til ${persons}.`;
	return `Efter 5 år: ${persons} i beskæftigelse i forhold til grundforløbet.`;
}

export interface Answer {
	question: Question;
	tiles: CardTile[];
	/** null when a deviation or a baseline level is missing */
	fiveYear: string | null;
	chart: { key: string; label: string; values: (number | null)[] }[];
	/** The scenario's own page (share card, full explorer). */
	href: string;
}

export function buildAnswer(input: {
	question: Question;
	scenario: TrimmedScenario;
	yearStart: number;
	/** baseline levels in the shock year */
	levels: CardLevels | null;
	/** baseline employment (thousand persons) in the shock year + 4 */
	nL5: number | null;
}): Answer {
	const { question, scenario, yearStart, levels, nL5 } = input;
	const y1 = scenario.definition.firstYear;
	const nL = scenario.deviations.nL;
	const d1 = nL?.[y1 - yearStart];
	const d5 = nL?.[y1 + 4 - yearStart];
	const fiveYear =
		d1 == null || d5 == null || levels == null || nL5 == null
			? null
			: fiveYearLine((d1 / 100) * levels.nL * 1000, (d5 / 100) * nL5 * 1000);
	return {
		question,
		tiles: cardTiles({ scenario, definition: scenario.definition, yearStart, levels, scale: 1 }),
		fiveYear,
		chart: [
			{ key: 'qBNP', label: 'BNP', values: scenario.deviations.qBNP ?? [] },
			{ key: 'nL', label: 'Beskæftigelse', values: nL ?? [] }
		],
		href: `/scenarier/${question.file}/`
	};
}

export interface PageHead {
	title: string;
	description: string;
}

/** The front page's <title> and description; the description carries the default answer. */
export function homeHead(answer: Answer): PageHead {
	const [persons, bnp, saldo] = answer.tiles;
	const numbers = [
		persons.value == null ? null : `beskæftigelse ${persons.value} personer i år 1`,
		bnp.value == null ? null : `BNP ${bnp.value} pct. efter 3 år`,
		saldo.value == null ? null : `offentlig saldo ${saldo.value} pct. af BNP i år 1`
	].filter(Boolean);
	return {
		title: 'MAKROskop – spørg Finansministeriets model, hvad der sker, hvis …',
		description:
			`Hvad sker der, hvis ${answer.question.question}` +
			(numbers.length ? ` MAKRO: ${numbers.join(', ')}.` : '') +
			' Seks spørgsmål til Finansministeriets model, besvaret med MAKROskops frie løser.'
	};
}
