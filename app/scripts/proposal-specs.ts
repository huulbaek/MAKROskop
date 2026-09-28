/** Writes etl/proposal_specs.json: each proposal's package as the joint solve takes it
 *  (freesolver solve-export --package), computed by the same function the page uses (makroskop-48o). */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageQuery } from '../src/lib/package';
import { PROPOSAL_VARIANT, proposalPackage } from '../src/lib/proposal';
import { PROPOSALS } from '../src/lib/proposals';
import { readMeta } from '../src/lib/server/scenarios';

const meta = readMeta();
if (!meta.sizing) throw new Error('meta.json has no sizing block — run etl/extract.py first');
const specs: Record<string, { package: string; query: string }> = {};
for (const p of PROPOSALS) {
	const pkg = proposalPackage(p, meta.sizing);
	if (pkg.problems.length) throw new Error(`${p.id}: ${pkg.problems.join('; ')}`);
	const query = packageQuery(pkg.components, PROPOSAL_VARIANT);
	specs[p.id] = { package: query.replace(/&?variant=[^&]*/, ''), query };
}
writeFileSync(join(process.cwd(), '..', 'etl', 'proposal_specs.json'), JSON.stringify(specs, null, '\t') + '\n');
console.log(`wrote etl/proposal_specs.json (${Object.keys(specs).length} proposals)`);
