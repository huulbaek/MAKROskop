/** Scenarios under recomputation, by catalog shock name. The explorer shows the text as a
 *  banner; the front page leaves their questions out. Remove an entry once its re-solve is
 *  ingested. */
export const RECOMPUTING: Record<string, string> = {};

const VAT =
	'Stødet flytter alle momssatser med det samme antal procentpoint — også satserne på eksport og ' +
	'på virksomhedernes køb, der i virkeligheden er nul, fordi momsen dér er fradragsberettiget. Det ' +
	'giver en momsrabat (eller -byrde) på eksport og input, som en rigtig momsændring ikke har, så ' +
	'tallene viser ikke en rigtig momsændring. Scenariet løses igen med forholdsmæssigt ændrede satser, som i DREAMs ' +
	'egne beregninger (25 → 24,5 pct.).';

RECOMPUTING.Moms = VAT;
RECOMPUTING.Moms_ned = VAT;
