import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { listedProposals, proposalDescriptionDa } from '$lib/proposal';
import { PROPOSALS } from '$lib/proposals';
import { readMeta, readProposalChecks } from '$lib/server/scenarios';

export const prerender = true;

/** The same gate the page list uses: only proposals whose joint solve is current and within 10 %. */
function publishable() {
	const meta = readMeta();
	return meta.sizing ? listedProposals(PROPOSALS, meta.sizing, readProposalChecks()) : [];
}

export const entries: EntryGenerator = () => publishable().map((p) => ({ id: p.id }));

export const load: PageServerLoad = ({ params }) => {
	const p = publishable().find((x) => x.id === params.id);
	if (!p) error(404, 'Ukendt forslag');
	return {
		proposalId: p.id,
		head: { title: `${p.titleDa} regnet i MAKRO · MAKROskop`, description: proposalDescriptionDa(p, readMeta().sizing!) }
	};
};
