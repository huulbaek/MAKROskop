import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EntryGenerator, PageServerLoad } from './$types';
import type { ProposalCheck } from '$lib/data';
import { listedProposals, proposalDescriptionDa } from '$lib/proposal';
import { PROPOSALS } from '$lib/proposals';
import { readMeta } from '$lib/server/scenarios';

export const prerender = true;

/** The same gate the page list uses: only proposals whose joint solve is current and within 10 %. */
function publishable() {
	const meta = readMeta();
	const checks: Record<string, ProposalCheck> = JSON.parse(
		readFileSync(join(process.cwd(), 'static/data/proposals.json'), 'utf8')
	);
	return meta.sizing ? listedProposals(PROPOSALS, meta.sizing, checks) : [];
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
