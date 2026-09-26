export interface SeriesMeta {
	key: string;
	labelDa: string;
	labelEn: string;
	group: string;
	unit: string;
	devMode: 'pct' | 'pp' | 'gdp_pp';
	sector: string | null;
}

export interface ShockMeta {
	name: string;
	labelDa: string;
	labelEn: string;
	group: string;
	/** variation suffixes for which a solved GDX has been ingested */
	available: string[];
}

export interface VariationMeta {
	suffix: string;
	labelDa: string;
	labelEn: string;
}

export interface Meta {
	model: { name: string; commit: string; fingerprint?: string; dataBasisDa?: string };
	yearStart: number;
	yearEnd: number;
	lastDataYear: number;
	defaultShockYear: number;
	sectors: Record<string, string>;
	series: SeriesMeta[];
	shocks: ShockMeta[];
	variations: VariationMeta[];
}

export interface Baseline {
	years: number[];
	series: Record<string, (number | null)[]>;
	indicators: { rHBI: number | null };
}

/** How the free solver implemented the shock (written by etl/extract.py from catalog.SHOCK_RUNS). */
export interface ScenarioDefinition {
	instrument: string;
	instrumentDa: string;
	changeDa: string;
	factor: number;
	delta: number;
	firstYear: number;
	lastYear: number;
	profileDa: string;
	closureDa: string;
	dreamDa: string;
	seriesKey: string | null;
	solver: string;
	linearityDa: string;
	/** Largest |scale| the slider may offer, where the model has a boundary the solver
	 *  could not cross. null = the UI default. */
	maxScale: number | null;
	maxScaleDa: string | null;
	/** Plain-language mechanism text for readers, when the catalog has one. */
	explainerDa?: string | null;
	/** The shock's channel on the mechanism map: chains of series keys, "a>b>c" (mechanism.ts). */
	channel?: string[] | null;
}

/** Which MAKRO version a scenario was solved on. `source` is "gdx" when the solver
 *  stamped the result file, "assumed" when an unstamped file was taken to match the
 *  MAKRO checkout at extract time. */
export interface ScenarioModelVersion {
	name: string;
	commit: string;
	fingerprint: string;
	source: 'gdx' | 'assumed';
}

/** The shock as the solver ran it, from the GDX stamp (makroskop_meta). etl/extract.py refuses
 *  to publish a scenario whose stamp disagrees with the catalog `definition` (makroskop-gnp.1). */
export interface ScenarioSolved {
	/** freesolver --shock-name, e.g. "tMoms_y,tMoms_m". */
	shock: string;
	factor: number;
	delta: number;
	profile: string;
	closure: string;
	endogenized: string;
	fromYear: number;
	shockYears: string;
	/** ISO date the solution was exported. */
	exported: string;
}

export interface Scenario {
	shock: string;
	variation: string;
	synthetic: boolean;
	labelDa?: string;
	hbi: number | null;
	definition?: ScenarioDefinition | null;
	/** null for an unstamped GDX. */
	solved?: ScenarioSolved | null;
	modelVersion?: ScenarioModelVersion | null;
	deviations: Record<string, (number | null)[]>;
}

export async function loadMeta(fetcher: typeof fetch): Promise<Meta> {
	const response = await fetcher('/data/meta.json');
	return response.json();
}

export async function loadBaseline(fetcher: typeof fetch): Promise<Baseline> {
	const response = await fetcher('/data/baseline.json');
	return response.json();
}

export async function loadScenario(fetcher: typeof fetch, file: string): Promise<Scenario | null> {
	const response = await fetcher(`/data/shocks/${file}.json`);
	if (!response.ok) return null;
	return response.json();
}

/** Unfinanced first: that is how DREAM presents its shock reactions, and a financed run's
 *  closure-tax reaction can swamp the shock itself (Rente, makroskop-cak). */
const VARIATION_PREFERENCE = ['_ufin', '_perm', '_midl', '_blip'];

/** The variant a shock opens on in the explorer; undefined when it is not solved yet. */
export function defaultVariation(shock: ShockMeta): string | undefined {
	return VARIATION_PREFERENCE.find((v) => shock.available.includes(v)) ?? shock.available[0];
}

export function seriesByKey(meta: Meta): Map<string, SeriesMeta> {
	return new Map(meta.series.map((s) => [s.key, s]));
}
