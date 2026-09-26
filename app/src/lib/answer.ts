/** The scenario page's answer in plain Danish, in persons and kroner (makroskop-glk):
 *  "ECB-renten +1 pct.-point fra 2030, varigt og ufinansieret: Beskæftigelsen falder med
 *  10.900 personer det første år, men efter 5 år er effekten næsten væk. …"
 *  Built from the same series, years and rounding as the headline tiles (card.ts), so the
 *  sentence and the tiles never disagree, and scaled with the slider. Pure and alias-free
 *  (relative imports only) like card.ts: the view pages prerender it on the server. */
import { changeText, closureWord, formatPersons, formatTileValue, PROFILE_WORD, type CardLevels } from './card';
import type { Scenario, ScenarioDefinition } from './data';
import { formatValue } from './format';

export interface AnswerInput {
	/** What moved, as the share-card headline says it (card.ts cardSubject). */
	subject: string;
	definition: Pick<ScenarioDefinition, 'firstYear' | 'factor' | 'delta' | 'changeDa'>;
	variation: string;
	scenario: Pick<Scenario, 'deviations'>;
	yearStart: number;
	/** Baseline employment (thousand persons) and nominal GDP (mia. kr.) in a year, or null. */
	levelsAt: (year: number) => CardLevels | null;
	scale: number;
}

export interface AnswerSentence {
	/** The shock, bold on the page: "ECB-renten +1 pct.-point fra 2030, varigt og ufinansieret:" */
	lead: string;
	/** What happens; a part whose series or baseline level is missing is left out. */
	body: string;
}

/** Below this many persons an employment effect is "stort set uændret". */
const MIN_PERSONS = 100;
/** A fifth-year effect at most this share of the first year's has "næsten" faded (as on the front page). */
const FADED_SHARE = 0.2;
/** Saldo effects below this many mia. kr. (50 mio.) are "stort set upåvirkede". */
const MIN_MIA_KR = 0.05;

/** A tile-rounded number without its sign; the sentence carries the direction in words. */
function magnitude(text: string): string {
	return text.replace(/^[+−]/, '');
}

function persons(value: number): string {
	return `${magnitude(formatPersons(Math.abs(value)))} personer`;
}

/** Mia. kr.: whole numbers from 10 upwards, one decimal below. */
function miaKr(value: number): string {
	const abs = Math.abs(value);
	const text = new Intl.NumberFormat('da-DK', {
		minimumFractionDigits: abs >= 10 ? 0 : 1, maximumFractionDigits: abs >= 10 ? 0 : 1
	}).format(abs);
	return `ca. ${text} mia. kr.`;
}

function employmentSentence(p1: number, p5: number): string {
	const verb = p1 > 0 ? 'stiger' : 'falder';
	const side = (p: number) => (p > 0 ? 'over' : 'under');
	if (Math.abs(p1) < MIN_PERSONS && Math.abs(p5) < MIN_PERSONS) {
		return 'Beskæftigelsen er stort set uændret de første fem år.';
	}
	if (Math.abs(p1) < MIN_PERSONS) {
		return `Beskæftigelsen ændres kun lidt det første år, men efter 5 år ligger den ${persons(p5)} ${side(p5)} grundforløbet.`;
	}
	const first = `Beskæftigelsen ${verb} med ${persons(p1)} det første år`;
	if (Math.abs(p5) < MIN_PERSONS || Math.abs(p5) <= FADED_SHARE * Math.abs(p1)) {
		return `${first}, men efter 5 år er effekten næsten væk.`;
	}
	if (Math.sign(p5) === Math.sign(p1)) return `${first} og med ${persons(p5)} efter 5 år.`;
	return `${first}, men efter 5 år ligger den ${persons(p5)} ${side(p5)} grundforløbet.`;
}

function gdpSentence(pct: number): string {
	const shown = formatTileValue(pct);
	if (!/[1-9]/.test(shown)) return 'BNP er stort set uændret efter 3 år.';
	return `BNP er ${magnitude(shown)} pct. ${pct > 0 ? 'højere' : 'lavere'} efter 3 år.`;
}

function saldoSentence(pp: number, kr: number): string {
	if (Math.abs(kr) < MIN_MIA_KR) return 'De offentlige finanser er stort set upåvirkede det første år.';
	const share = formatTileValue(pp);
	const ofGdp = /[1-9]/.test(share) ? ` (${share} pct. af BNP)` : '';
	return `De offentlige finanser ${kr < 0 ? 'svækkes' : 'styrkes'} med ${miaKr(kr)} det første år${ofGdp}.`;
}

/** The financed closure moves the closure tax, the same amount every year (tLukning[t] =
 *  tLukning[2129]); it pins long-run net worth, not the yearly saldo, so the sentence says
 *  what the tax does rather than a saldo that is not the shock's cost. Rounded as /pakke/. */
function closureTaxSentence(pp: number): string {
	const rounded = Math.round(pp * 100) / 100;
	if (rounded === 0) return 'Finansieringen kræver ingen nævneværdig ændring af lukkeskatten.';
	const size = formatValue(Math.abs(rounded));
	// tLukning is a rate on households' direct taxes (vtLukning = tLukning · (vtHhx − vtLukning)):
	// without its base the pct.-point says nothing to a reader.
	const tax = 'Lukkeskatten – et beregningsteknisk tillæg til husholdningernes direkte skatter –';
	return rounded > 0
		? `${tax} skal hæves ${size} pct.-point, for at de offentlige finanser forbliver holdbare.`
		: `${tax} kan sænkes ${size} pct.-point, og de offentlige finanser forbliver holdbare.`;
}

export function buildAnswerSentence(input: AnswerInput): AnswerSentence {
	const { subject, definition: def, variation, scenario, yearStart, levelsAt, scale } = input;
	const y1 = def.firstYear;
	const at = (key: string, year: number): number | null => {
		const value = scenario.deviations[key]?.[year - yearStart];
		return value == null ? null : value * scale;
	};

	const scaling = scale === 1 ? '' : scale < 0 ? ' (spejlet stød, lineær tilnærmelse)' : ' (lineært skaleret)';
	const profile = PROFILE_WORD[variation] ?? 'varigt';
	const lead = `${subject} ${changeText(def, scale)} fra ${y1}, ${profile} og ${closureWord(variation)}${scaling}:`;

	const parts: string[] = [];
	const [levels1, levels5] = [levelsAt(y1), levelsAt(y1 + 4)];
	const [n1, n5] = [at('nL', y1), at('nL', y1 + 4)];
	if (n1 != null && n5 != null && levels1 && levels5) {
		parts.push(employmentSentence((n1 / 100) * levels1.nL * 1000, (n5 / 100) * levels5.nL * 1000));
	}
	const gdp = at('qBNP', y1 + 2);
	if (gdp != null) parts.push(gdpSentence(gdp));
	if (variation === '_perm') {
		const tax = at('tLukning', y1);
		if (tax != null) parts.push(closureTaxSentence(tax));
	} else {
		const saldo = at('saldo2bnp', y1);
		if (saldo != null && levels1) parts.push(saldoSentence(saldo, (saldo / 100) * levels1.vBNP));
	}
	return { lead, body: parts.join(' ') };
}

/** The whole answer as one quotable paragraph. */
export function answerText(answer: AnswerSentence): string {
	return `${answer.lead} ${answer.body}`;
}
