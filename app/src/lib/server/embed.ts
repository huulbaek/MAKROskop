/** Build-time lookup of one embed (scenario file stem + series key) for the embed page and its
 *  oEmbed file: null for anything the prerender list would not contain. */
import { splitView } from '../card';
import { embeddableSeries, embedHead, type EmbedHead } from '../embed';
import { readMeta, readScenario, scenarioExists } from './scenarios';

export function resolveEmbed(scenarioParam: string, serie: string): EmbedHead | null {
	const meta = readMeta();
	const view = splitView(scenarioParam, meta.variations.map((v) => v.suffix));
	const shock = view && meta.shocks.find((s) => s.name === view.name);
	if (!view || !shock || !shock.available.includes(view.variation) || !scenarioExists(scenarioParam)) return null;
	const scenario = readScenario(scenarioParam);
	if (!scenario.definition || !embeddableSeries(scenario, view.variation).includes(serie)) return null;
	return embedHead({ series: meta.series, shock, scenario: scenarioParam, variation: view.variation, serie, definition: scenario.definition });
}
