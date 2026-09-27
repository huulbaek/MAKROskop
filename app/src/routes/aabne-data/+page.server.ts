/** /aabne-data/ (makroskop-gko): the download page. Zip size and checksum are computed here with
 *  the same builder as scripts/data-files.ts, so the page states the zip it links to. */
import type { PageServerLoad } from './$types';
import { devUnit } from '$lib/data';
import { citation, publishedSeries, type Manifest } from '$lib/opendata';
import { loadDataSet, readManifest, releaseZip, sha256, zipName } from '$lib/server/opendata-files';

export const prerender = true;

export interface OpenDataPage {
	manifest: Manifest;
	zip: { name: string; bytes: number; sha256: string };
	scenarioCount: number;
	groups: { group: string; shocks: { name: string; labelDa: string; variants: { suffix: string; labelDa: string; file: string }[] }[] }[];
	series: { key: string; labelDa: string; group: string; unit: string; deviationUnit: string }[];
	citationDa: string;
	citationEn: string;
}

export const load: PageServerLoad = (): { opendata: OpenDataPage } => {
	const manifest = readManifest();
	if (!manifest) throw new Error('static/data/udgivelse.json mangler: kør bun run data:release');
	const ds = loadDataSet();
	const zip = releaseZip(ds, manifest);
	const variationLabel = new Map(ds.meta.variations.map((v) => [v.suffix, v.labelDa]));
	const groups: OpenDataPage['groups'] = [];
	for (const shock of ds.meta.shocks) {
		if (shock.available.length === 0) continue;
		let group = groups.find((g) => g.group === shock.group);
		if (!group) groups.push((group = { group: shock.group, shocks: [] }));
		group.shocks.push({
			name: shock.name,
			labelDa: shock.labelDa,
			variants: shock.available.map((suffix) => ({ suffix, labelDa: variationLabel.get(suffix) ?? suffix, file: `${shock.name}${suffix}` }))
		});
	}
	return {
		opendata: {
			manifest,
			zip: { name: zipName(manifest.version), bytes: zip.length, sha256: sha256(zip) },
			scenarioCount: ds.scenarios.length,
			groups,
			series: publishedSeries(ds.meta.series).map((s) => ({ key: s.key, labelDa: s.labelDa, group: s.group, unit: s.unit, deviationUnit: devUnit(s.devMode) })),
			citationDa: citation(manifest, 'da'),
			citationEn: citation(manifest, 'en')
		}
	};
};
