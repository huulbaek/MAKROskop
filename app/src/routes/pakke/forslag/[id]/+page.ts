import { loadBaseline, loadProposalChecks } from '$lib/data';
import type { PageLoad } from './$types';

/** Same data as /pakke/, plus the proposal id and head from the server load. */
export const load: PageLoad = async ({ data, fetch }) => ({
	...data,
	baseline: await loadBaseline(fetch),
	checks: await loadProposalChecks(fetch)
});
