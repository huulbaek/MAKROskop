/** Static oEmbed JSON per embed page (makroskop-64y), found through the page's discovery link.
 *  Always the solved size and a single run; scaled or compared embeds use the copied code. */
import { error, json } from '@sveltejs/kit';
import type { EntryGenerator, RequestHandler } from './$types';
import { embedEntries, oembedJson } from '$lib/embed';
import { resolveEmbed } from '$lib/server/embed';
import { readMeta, readScenario } from '$lib/server/scenarios';

export const prerender = true;
export const trailingSlash = 'never';

export const entries: EntryGenerator = () => embedEntries(readMeta(), readScenario);

export const GET: RequestHandler = ({ params }) => {
	const embed = resolveEmbed(params.scenario, params.serie);
	if (!embed) error(404, 'Ukendt graf');
	return json(oembedJson(embed));
};
