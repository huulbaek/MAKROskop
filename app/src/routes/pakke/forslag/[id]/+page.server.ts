import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EntryGenerator, PageServerLoad } from './$types';
import type { ProposalCheck } from '$lib/data';
import { isPublishable, proposalPackage } from '$lib/proposal';
import { PROPOSALS } from '$lib/proposals';
import { readMeta } from '$lib/server/scenarios';

export const prerender = true;

/** The same gate the page list uses: only proposals whose joint solve is current and within 10 %. */
function publishable() {
	const meta = readMeta();
	const checks: Record<string, ProposalCheck> = JSON.parse(
		readFileSync(join(process.cwd(), 'static/data/proposals.json'), 'utf8')
	);
	return meta.sizing ? PROPOSALS.filter((p) => isPublishable(p, meta.sizing!, checks)) : [];
}

export const entries: EntryGenerator = () => publishable().map((p) => ({ id: p.id }));

export const load: PageServerLoad = ({ params }) => {
	const p = publishable().find((x) => x.id === params.id);
	if (!p) error(404, 'Ukendt forslag');
	const rows = proposalPackage(p, readMeta().sizing!).chain.length;
	return {
		proposalId: p.id,
		head: {
			title: `${p.titleDa} regnet i MAKRO · MAKROskop`,
			description: `${p.titleDa} (${p.proposerDa}) regnet i MAKRO med samme metode som alle forslag: ${rows} elementer sat i størrelse efter Finansministeriets tal, inkl. strukturel virkning, ufinansieret.`
		}
	};
};
