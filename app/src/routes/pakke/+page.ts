import { loadBaseline, loadProposalChecks } from '$lib/data';
import type { PageLoad } from './$types';

/** The baseline levels turn the package's pct. deviations into kr. and persons; the proposal
 *  checks decide which proposals the list offers. */
export const load: PageLoad = async ({ fetch }) => {
	return { baseline: await loadBaseline(fetch), checks: await loadProposalChecks(fetch) };
};
