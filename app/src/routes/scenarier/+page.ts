import { loadBaseline, loadScenario } from '$lib/data';
import type { PageLoad } from './$types';

/** The bare page opens on a real, easy-to-read scenario, prerendered with its charts and tiles:
 *  the ECB rate, unfinanced (the financed run's closure-tax cut dominates the rate effect). */
const DEFAULT_SCENARIO = 'Rente_ufin';

export const load: PageLoad = async ({ fetch }) => {
	const [initialScenario, baseline] = await Promise.all([loadScenario(fetch, DEFAULT_SCENARIO), loadBaseline(fetch)]);
	return { initialScenario, baseline };
};
