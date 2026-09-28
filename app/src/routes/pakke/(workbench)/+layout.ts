import { loadBaseline, loadProposalChecks } from '$lib/data';
import type { LayoutLoad } from './$types';

/** /pakke/ and /pakke/forslag/<id>/ share one workbench (this group's layout), so it survives the
 *  hand-over from a proposal page to /pakke/ on the first edit. The baseline levels turn the
 *  package's pct. deviations into kr. and persons; the proposal checks decide what is listed. */
export const load: LayoutLoad = async ({ fetch }) => {
	return { baseline: await loadBaseline(fetch), checks: await loadProposalChecks(fetch) };
};
