/** One prerendered embed page per (scenario, series) (makroskop-64y). Only head data is returned;
 *  the scenario JSON is fetched on the client, which also reads ?skala= and ?sammenlign. */
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { embedEntries, type EmbedHead } from '$lib/embed';
import { resolveEmbed } from '$lib/server/embed';
import { readMeta, readScenario } from '$lib/server/scenarios';

export const prerender = true;

export const entries: EntryGenerator = () => embedEntries(readMeta(), readScenario);

export const load: PageServerLoad = ({ params }): { embed: EmbedHead } => {
	const embed = resolveEmbed(params.scenario, params.serie);
	if (!embed) error(404, 'Ukendt graf');
	return { embed };
};
