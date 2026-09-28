/** Post-build assertions for the share pages: every view has a page and an image, the
 *  sample page carries exactly one of each tag, the bare page keeps the generic ones.
 *  Run after `bun run build` (package.json "verify:build"); exits 1 on any failure. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shareViews } from '../src/lib/card';
import { QUESTIONS } from '../src/lib/frontpage';
import { unzipSync } from 'fflate';
import { derivedFiles, loadDataSet, readManifest, sha256, zipEntries, zipName } from '../src/lib/server/opendata-files';
import { embedEntries } from '../src/lib/embed';
import { maxScales, readMeta, readScenario } from '../src/lib/server/scenarios';
import { PROPOSALS } from '../src/lib/proposals';
import { isPublishable } from '../src/lib/proposal';
import type { ProposalCheck } from '../src/lib/data';

const build = join(process.cwd(), 'build');
const failures: string[] = [];
const check = (ok: boolean, message: string) => { if (!ok) failures.push(message); };
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;

const meta = readMeta();
const views = shareViews(meta, maxScales(meta));
for (const view of views) {
	const dir = join(build, 'scenarier', view.scenario, view.skala ?? '');
	check(existsSync(join(dir, 'index.html')), `missing page ${dir}/index.html`);
	const image = `${view.scenario}${view.skala ? `_${view.skala}` : ''}.png`;
	check(existsSync(join(build, 'og', image)), `missing image build/og/${image}`);
}

const sample = readFileSync(join(build, 'scenarier', 'Rente_ufin', '0.5', 'index.html'), 'utf8');
check(count(sample, /<title>/g) === 1, 'sample: not exactly one <title>');
check(sample.includes('<title>ECB-renten +0,5 pct.-point: BNP −0,6 pct. efter 3 år · MAKROskop</title>'), 'sample: <title> is not the card title');
for (const tag of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'og:url']) {
	check(count(sample, new RegExp(`property="${tag}"`, 'g')) === 1, `sample: not exactly one ${tag}`);
}
check(sample.includes('content="https://makroskop.nodalit.com/og/Rente_ufin_0.5.png"'), 'sample: og:image is not the view image');
check(sample.includes('<link rel="canonical" href="https://makroskop.nodalit.com/scenarier/Rente_ufin/0.5/"'), 'sample: canonical missing');
check(sample.includes('vist som år efter stødet, lineært skaleret'), 'sample: honesty line missing from description');
check(sample.includes('key-figures'), 'sample: prerendered HTML is missing the key-figures tiles');
check(!sample.includes('Endnu ikke beregnet'), 'sample: prerendered HTML still shows the pending-scenario card');

const bare = readFileSync(join(build, 'scenarier', 'index.html'), 'utf8');
check(bare.includes('content="Scenarier · MAKROskop"'), 'bare page lost its generic og:title');
check(bare.includes('<title>Scenarier · MAKROskop</title>'), 'bare page: <title> is not the page name');
check(bare.includes('content="https://makroskop.nodalit.com/og.png"'), 'bare page lost the site og:image');
check(count(bare, /property="og:url"/g) === 0, 'bare page must not carry og:url');
check(/<h2[^>]*>Rente \(ECB\)<\/h2>/.test(bare), 'bare page: does not open on the default scenario (Rente_ufin)');
check(bare.includes('key-figures') && !bare.includes('Henter scenariet'), 'bare page: default scenario is not prerendered with its tiles');
check(!/Syntetisk|synthetic demo/i.test(bare), 'bare page still mentions the synthetic demo');

const home = readFileSync(join(build, 'index.html'), 'utf8');
check(home.includes('ECB hæver renten med 1 pct.-point?'), 'front page: default question missing');
check(count(home, /class="chip[^"]*"[^>]*aria-pressed/g) === QUESTIONS.length, `front page: expected ${QUESTIONS.length} question chips`);
check(home.includes('<title>MAKROskop – spørg Finansministeriets model, hvad der sker, hvis …</title>'), 'front page: <title> is not its own');
check(/content="Hvad sker der, hvis ECB hæver renten[^"]*beskæftigelse −/.test(home), 'front page: description lacks the default answer');
check(home.includes('href="/grundforloeb/"'), 'front page: no doorway to the baseline');
check(home.includes('Varigt, ufinansieret stød fra 2030'), 'front page: does not say the shock is permanent and unfinanced');
check(home.includes('href="/scenarier/Rente_ufin/"'), 'front page: default answer does not link to its scenario page');

const grund = readFileSync(join(build, 'grundforloeb', 'index.html'), 'utf8');
check(grund.includes('Dansk økonomi, beregnet et århundrede frem'), '/grundforloeb/: baseline heading missing');
check(grund.includes('<title>Grundforløb · MAKROskop</title>'), '/grundforloeb/: <title> is not the page name');
check(grund.includes('MAKROs grundforløb for dansk økonomi'), '/grundforloeb/: lost the baseline description');

const embeds = embedEntries(meta, readScenario);
for (const embed of embeds) {
	const page = join(build, 'indlejr', embed.scenario, embed.serie, 'index.html');
	check(existsSync(page), `missing embed page ${page}`);
	// every page's oEmbed discovery link names its own file
	const discovery = `href="https://makroskop.nodalit.com/oembed/${embed.scenario}/${embed.serie}.json"`;
	if (existsSync(page)) check(readFileSync(page, 'utf8').includes(discovery), `embed ${embed.scenario}/${embed.serie}: oEmbed discovery link is not its own`);
}
const builtEmbeds = readdirSync(join(build, 'indlejr'), { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.flatMap((d) => readdirSync(join(build, 'indlejr', d.name)));
check(builtEmbeds.length === embeds.length, `embed pages: ${builtEmbeds.length} built, ${embeds.length} expected`);

const embedPage = readFileSync(join(build, 'indlejr', 'Rente_ufin', 'qBNP', 'index.html'), 'utf8');
check(count(embedPage, /<title>/g) === 1, 'embed: not exactly one <title>');
check(embedPage.includes('<meta name="robots" content="noindex"'), 'embed: noindex missing');
check(embedPage.includes('<link rel="canonical" href="https://makroskop.nodalit.com/scenarier/Rente_ufin/"'), 'embed: canonical missing');
check(!embedPage.includes('Hovednavigation') && !embedPage.includes('property="og:title"'), 'embed: carries the site chrome or share tags');
check(embedPage.includes('ECB-renten +1 pct.-point, varigt og ufinansieret'), 'embed: prerendered headline missing');
check(/<main[ >]/.test(embedPage), 'embed: no <main> landmark');
check(existsSync(join(build, 'indlejr', 'resize.js')), 'embed: resize.js missing');

for (const embed of embeds) {
	const file = join(build, 'oembed', embed.scenario, `${embed.serie}.json`);
	check(existsSync(file), `missing oEmbed file ${file}`);
}
const builtOembeds = readdirSync(join(build, 'oembed'), { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.flatMap((d) => readdirSync(join(build, 'oembed', d.name)));
check(builtOembeds.length === embeds.length, `oEmbed files: ${builtOembeds.length} built, ${embeds.length} expected`);
const oembed = JSON.parse(readFileSync(join(build, 'oembed', 'Rente_ufin', 'qBNP.json'), 'utf8'));
check(oembed.version === '1.0' && oembed.type === 'rich', 'oEmbed: not a 1.0 rich response');
check(String(oembed.html).includes('src="https://makroskop.nodalit.com/indlejr/Rente_ufin/qBNP/"'), 'oEmbed: html does not embed its page');
check(typeof oembed.width === 'number' && typeof oembed.height === 'number', 'oEmbed: width/height missing');

const release = readManifest();
check(release != null, 'open data: static/data/udgivelse.json missing');
const dataSet = loadDataSet();
const derivedData = derivedFiles(dataSet);
const derived = Object.keys(derivedData);
for (const path of derived) check(existsSync(join(build, 'data', path)), `open data: missing build/data/${path}`);
const zipPath = release ? join(build, 'data', zipName(release.version)) : null;
const zipBytes = zipPath && existsSync(zipPath) ? readFileSync(zipPath) : null;
check(zipBytes != null, `open data: missing ${zipPath}`);
if (release && zipBytes) {
	const folder = zipName(release.version).replace('.zip', '');
	const names = Object.keys(unzipSync(new Uint8Array(zipBytes)));
	check(JSON.stringify(names) === JSON.stringify(zipEntries(dataSet, derivedData).map((p) => `${folder}/${p}`)), 'open data: zip entries differ from zipEntries()');
	const latest = join(build, 'data', 'makroskop-data.zip');
	check(existsSync(latest) && readFileSync(latest).equals(zipBytes), 'open data: makroskop-data.zip is not the current zip');
}

const dataPagePath = join(build, 'aabne-data', 'index.html');
check(existsSync(dataPagePath), 'open data: missing build/aabne-data/index.html');
if (existsSync(dataPagePath) && release) {
	const dataPage = readFileSync(dataPagePath, 'utf8');
	const hrefs = [...dataPage.matchAll(/href="(\/data\/[^"]+)"/g)].map((m) => m[1]);
	const perScenario = hrefs.filter((h) => /^\/data\/(shocks|csv|csv-da)\/(?!alle-scenarier|grundforloeb)[^/]+\.(json|csv)$/.test(h));
	check(new Set(perScenario).size === dataSet.scenarios.length * 3, `open data page: ${new Set(perScenario).size} per-scenario links, expected ${dataSet.scenarios.length * 3}`);
	if (zipBytes) check(dataPage.includes(sha256(zipBytes)), 'open data page: the SHA-256 shown is not the built zip\'s');
	check(count(dataPage, /<title>/g) === 1 && dataPage.includes('<title>Data · MAKROskop</title>'), 'open data page: <title>');
}

// Every link into /data/ on every built page: the prerender crawler skips them (rel="external",
// the files are written after vite build), so a broken one would otherwise ship silently.
const htmlFiles = (readdirSync(build, { recursive: true, encoding: 'utf8' }) as string[]).filter((f) => f.endsWith('.html'));
const dataLinks = new Map<string, string>();
for (const file of htmlFiles) {
	for (const m of readFileSync(join(build, file), 'utf8').matchAll(/href="(\/data\/[^"?#]+)/g)) {
		if (!dataLinks.has(m[1])) dataLinks.set(m[1], file);
	}
}
for (const [href, file] of dataLinks) check(existsSync(join(build, href)), `${file}: link to missing ${href}`);

// Proposal pages (makroskop-48o): exactly the publishable proposals are prerendered, each with its own <title>.
const proposalChecks: Record<string, ProposalCheck> = JSON.parse(readFileSync(join(process.cwd(), 'static/data/proposals.json'), 'utf8'));
for (const p of PROPOSALS) {
	const file = join(build, 'pakke', 'forslag', p.id, 'index.html');
	const listed = meta.sizing != null && isPublishable(p, meta.sizing, proposalChecks);
	check(existsSync(file) === listed, `/pakke/forslag/${p.id}/: page ${listed ? 'missing' : 'must not exist (not publishable)'}`);
	if (listed && existsSync(file)) check(readFileSync(file, 'utf8').includes(`<title>${p.titleDa} regnet i MAKRO · MAKROskop</title>`), `/pakke/forslag/${p.id}/: <title>`);
}

if (failures.length) {
	console.error(`verify-build: ${failures.length} problem(s)\n` + failures.slice(0, 20).join('\n'));
	process.exit(1);
}
console.log(`verify-build: ${views.length} views, ${embeds.length} embeds and ${derived.length} data files, pages and images present, tags correct, ${dataLinks.size} data links in ${htmlFiles.length} pages resolve`);
