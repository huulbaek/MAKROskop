/** The front page's six answers, read and trimmed at build time (prerendered): the page ships
 *  ~3 KB per answer instead of six 54 KB scenario files, and switching needs no fetch. A missing
 *  scenario file throws in readScenario, so the build fails instead of shipping a gap. */
import { QUESTIONS, buildAnswer, homeHead, trimScenario } from '$lib/frontpage';
import { levelsAt, readBaseline, readMeta, readScenario } from '$lib/server/scenarios';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const meta = readMeta();
	const baseline = readBaseline();
	const answers = QUESTIONS.map((question) => {
		const scenario = trimScenario(readScenario(question.file));
		const y1 = scenario.definition.firstYear;
		return buildAnswer({
			question,
			scenario,
			yearStart: meta.yearStart,
			levels: levelsAt(baseline, y1),
			nL5: levelsAt(baseline, y1 + 4)?.nL ?? null
		});
	});
	return { answers, head: homeHead(answers[0]) };
};
