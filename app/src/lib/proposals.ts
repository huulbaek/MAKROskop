import type { Proposal } from './proposal';

/** Published proposals as the Finance Ministry costed them (makroskop-48o). Figures are copied
 *  verbatim from the sources; scales are computed (proposal.ts), never written here. Inclusion
 *  rule and method: /pakke/metode/. Ordered by date.
 *  Shortlist research and the owner's gate: docs/superpowers/specs/2026-09-28-proposal-shortlist.md. */
export const PROPOSALS: Proposal[] = [
	{
		id: 'personskattereform-2025',
		titleDa: 'Personskattereform 2025/26',
		proposerDa:
			'Regeringen (S, V, M), Danmarksdemokraterne, Det Konservative Folkeparti, Radikale Venstre og Nye Borgerlige',
		status: 'vedtaget',
		date: '2023-12-14',
		sources: [
			{
				// [A]
				labelDa: 'Aftale om Reform af personskat, 14. december 2023 (Tabel 7, s. 9)',
				url: 'https://fm.dk/media/aqgjhsug/aftale-om-reform-af-personskat-a.pdf'
			},
			{
				// [B]
				labelDa: 'L 138 (2023-24) som fremsat, almindelige bemærkninger (Tabel 6)',
				url: 'https://www.ft.dk/samling/20231/lovforslag/l138/20231_l138_som_fremsat.htm'
			},
			{
				// [C]
				labelDa: 'L 138 svar på spm. 2, finansministeren, 1.-2. maj 2024 (s. 1)',
				url: 'https://www.ft.dk/samling/20231/lovforslag/L138/spm/2/svar/2044703/2859698.pdf'
			},
			{
				// [D]
				labelDa: 'L 138 svar på spm. 1, finansministeren, 1. maj 2024 (Tabel 1, Anm. 1)',
				url: 'https://www.ft.dk/samling/20231/lovforslag/L138/spm/2/svar/2044703/2859699.pdf'
			}
		],
		// Umiddelbar provenuvirkning, 2023-niveau, fuldt indfaset 2030, [A] Tabel 7 s. 9 / [B] Tabel 6.
		elements: [
			{
				shock: 'Beskaeftigelsesfradrag',
				labelDa: 'Forhøjelse af beskæftigelsesfradraget',
				kr: -6.8,
				priceYear: 2023,
				source: 0
			},
			{
				shock: 'Beskaeftigelsesfradrag',
				labelDa: 'Det ekstra beskæftigelsesfradrag for enlige forsørgere',
				kr: -0.5,
				priceYear: 2023,
				source: 0,
				mappedDa: 'MAKRO har ét beskæftigelsesfradrag; regnet som det generelle fradrag med samme provenu'
			},
			{
				shock: 'Beskaeftigelsesfradrag',
				labelDa: 'Nyt ekstra beskæftigelsesfradrag til seniorer',
				kr: -0.215,
				priceYear: 2023,
				source: 0,
				mappedDa: 'Målrettet seniorer; i MAKRO regnet som det generelle beskæftigelsesfradrag med samme provenu'
			},
			{
				shock: 'Topskat',
				labelDa: 'Ny mellemskat samt ny topskat',
				kr: -3.7,
				priceYear: 2023,
				source: 0,
				mappedDa: 'MAKRO har i denne udgave ét topskattetrin; regnet som topskat med samme provenu'
			},
			{
				shock: 'Topskat',
				labelDa: 'Ny top-topskat',
				kr: 1.0,
				priceYear: 2023,
				source: 0,
				mappedDa: 'MAKRO har i denne udgave ét topskattetrin; regnet som topskat med samme provenu'
			}
		],
		// 5.300 fuldtidspersoner i alt ([A] s. 10; [B] Tabel 6) minus seniorpræmiens 100 ([B] Tabel 6),
		// som ikke har noget MAKRO-instrument og derfor er udeladt (se omittedDa).
		structural: { fte: 5300 - 100, source: 1 },
		// 6,7 mia. kr. (2024-priser) i 2026, finansieret via råderummet ([C] s. 1), fordelt 1/3 realt
		// offentligt varekøb og 2/3 offentlig beskæftigelse — Finansministeriets egen konvention ([D] Anm. 1).
		financing: [
			{
				shock: 'Offentlig_varekoeb',
				labelDa: 'Lavere offentligt forbrug – realt offentligt varekøb',
				kr: 6.7 / 3,
				split: { of: 6.7, fractionDa: '1/3' },
				priceYear: 2024,
				source: 2,
				mappedDa: 'Fordelt med 1/3 offentligt varekøb og 2/3 offentlig beskæftigelse som i Finansministeriets svar på L 138, spm. 1 (anm. 1)'
			},
			{
				shock: 'Offentlig_Beskaeftigelse',
				labelDa: 'Lavere offentligt forbrug – offentlig beskæftigelse',
				kr: (6.7 * 2) / 3,
				split: { of: 6.7, fractionDa: '2/3' },
				priceYear: 2024,
				source: 2,
				mappedDa: 'Fordelt med 1/3 offentligt varekøb og 2/3 offentlig beskæftigelse som i Finansministeriets svar på L 138, spm. 1 (anm. 1)'
			}
		],
		omittedDa: [
			'Seniorpræmien (−0,23 mia. kr., 100 fuldtidspersoner) er en skattefri engangspræmie uden noget MAKRO-instrument, så den strukturelle række er 5.200 af reformens 5.300 fuldtidspersoner.',
			'Bundfradraget i boafgiften (−0,16 mia. kr.) og tillægsboafgiften ved arv til søskende (−0,04 mia. kr.) er udeladt, da MAKRO ikke har nogen boafgift.',
			'Bonus til udsatte unge uden uddannelse eller beskæftigelse (−0,055 mia. kr.) er udeladt, da der ikke findes noget passende instrument i MAKRO.'
		],
		revisions: []
	}
];
