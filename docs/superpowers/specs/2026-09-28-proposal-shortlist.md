# Proposal shortlist — research draft (makroskop-48o, Task 5 steps 1–2)

Date: 2026-09-28. Status: draft for the owner's gate (Step 3). Nothing in `app/` or `etl/` was changed.

Inclusion rule (a) from the spec: the Finance Ministry (or Skatteministeriet, where the answer is the
economic ministries' costing) has published **both** the static revenue (umiddelbar provenuvirkning)
of every element **and** the structural employment effect. Figures below are quoted verbatim; a figure
no source states is marked "ikke oplyst". Sign convention: effect on the public balance (tax cut
negative, spending cut positive). "In grundforløb?" was checked in `etl/shock_gdx/_reference.gdx`.

## Reference values checked (2025 vs 2030, `_reference.gdx`)

| symbol | 2023 | 2025 | 2026 | 2030 | reading |
|---|---|---|---|---|---|
| tBeskFradrag | 0.076713 | 0.074429 | 0.074429 | 0.074429 | flat from 2025: the reform's higher fradrag is **not** in the grundforløb |
| vBeskFradrag (tot, mia. kr.) | 104.50 | 103.64 | 105.14 | 113.25 | smooth growth, no 2025/26 jump |
| tTop | 0.15 | 0.15 | 0.15 | 0.15 | old 15 % topskat kept |
| vtTop (tot, mia. kr.) | 20.75 | 21.24 | 21.47 | 22.75 | no 2026 drop: the topskat relief is **not** in the grundforløb |
| tMellem / tTopTop | 0 / 0 | 0 / 0 | 0.075 / 0.05 | 0.075 / 0.05 | set from 2026, but vtMellem = vtTopTop = 0 (zero base, inert) |
| tBund | 0.1206 | 0.1201 | 0.1201 | 0.1201 | unchanged |
| vtBund (tot) | 154.18 | | | 175.49 | |
| vtHhAM (tot) | 109.29 | | | 120.73 | |
| vBNP | 2643.03 | 2674.52 | 2675.98 | 2747.20 | price-year divisor for `elementPct` |

Consequence: MAKRO's 2030 grundforløb holds the **pre-reform** personal-tax rules on every instrument
the reform touches. The Personskattereform is therefore laid on top in full, and proposals costed
against pre-reform rules (LA 2035, below) fit the grundforløb as is.

---

## 1. Personskattereform 2025/26 — `personskattereform-2025` — ELIGIBLE

- Proposer: Regeringen (S, V, M), Danmarksdemokraterne, Det Konservative Folkeparti, Radikale Venstre
  og Nye Borgerlige (aftale 14. december 2023). Enacted as L 138 (2023-24, fremsat 20-03-2024, stadfæstet).
- Status: `vedtaget`. Date for ordering: 2023-12-14.
- Sources:
  - [A] Aftale om Reform af personskat, 14. december 2023 — https://fm.dk/media/aqgjhsug/aftale-om-reform-af-personskat-a.pdf
    (Tabel 7 "Umiddelbare provenuvirkninger ved indfasning frem mod 2030", s. 9; strukturel beskæftigelse s. 10; Tabel 8 s. 10)
  - [B] L 138 (2023-24) som fremsat, almindelige bemærkninger afsnit 3.1, Tabel 6 "Reformens samlede økonomiske
    konsekvenser (2030)" and Tabel 7 — https://www.ft.dk/samling/20231/lovforslag/l138/20231_l138_som_fremsat.htm
  - [C] L 138 svar på spm. 2 (finansministeren, 1. maj 2024, omdelt 2. maj 2024), s. 1 —
    https://www.ft.dk/samling/20231/lovforslag/L138/spm/2/svar/2044703/2859698.pdf
  - [D] L 138 svar på spm. 1 (finansministeren, 1. maj 2024), Tabel 1 —
    https://www.ft.dk/samling/20231/lovforslag/L138/spm/2/svar/2044703/2859699.pdf (filed with spm. 2's answer)
  - [E] cross-check: FIU alm. del (2024-25) svar på spm. 350 (8. oktober 2025, stillet efter ønske fra Hans Andersen (V)),
    Tabel 1 row "Reform af personskat" — https://www.ft.dk/samling/20241/almdel/fiu/spm/350/svar/2169021/3078554.pdf

### Elements (umiddelbar provenuvirkning, fully phased in = 2030 column)

| element | FM figure (mia. kr.) | price year | source + page | shock | mapped? | in grundforløb? |
|---|---|---|---|---|---|---|
| Forhøjelse af beskæftigelsesfradraget | −6,8 | 2023 | [A] Tabel 7 s. 9; [B] Tabel 6 | Beskaeftigelsesfradrag | no (own instrument) | no (tBeskFradrag flat 0.0744) |
| Det ekstra beskæftigelsesfradrag for enlige forsørgere | −0,5 | 2023 | [A] Tabel 7 s. 9; [B] Tabel 6 | Beskaeftigelsesfradrag | yes: MAKRO has one proportional fradrag; same revenue | no |
| Nyt ekstra beskæftigelsesfradrag til seniorer | −0,215 | 2023 | [A] Tabel 7 s. 9; [B] Tabel 6 | Beskaeftigelsesfradrag | yes: age-targeted in reality, spread over all wage income in MAKRO | no |
| Ny mellemskat samt ny topskat | −3,7 | 2023 | [A] Tabel 7 s. 9; [B] Tabel 6 ("Omlægning af topskatten til en mellemskat samt indførelse af ny topskat") | Topskat | yes: one working topskat step in MAKRO (tTop 15 %); the two 7,5 pct. brackets become one Topskat row at the same revenue | no (tTop 15 % on historical base; tMellem zero base) |
| Ny top-topskat | +1,0 | 2023 | [A] Tabel 7 s. 9; [B] Tabel 6 | Topskat | yes: rTopTopSkatInd = 0 in MAKRO; mapped onto Topskat at the same revenue | no (tTopTop 5 % set, zero base) |
| Seniorpræmie (skattefri) | −0,230 | 2023 | [A] Tabel 7 s. 9; [B] Tabel 6 | Ikke_skattepligtig_indkomstoverforsel (needs a STATIC_SALDO formula) — or omit | yes if kept | no instrument check possible (lump-sum premium) |
| Bundfradrag i boafgiften | −0,16 | 2023 | [A] Tabel 7 s. 9 | none | — | → `omittedDa` (no boafgift in MAKRO) |
| Tillægsboafgift ved arv til søskende | −0,04 | 2023 | [A] Tabel 7 s. 9 | none | — | → `omittedDa` |
| Bonus til udsatte unge uden uddannelse eller beskæftigelse | −0,055 | 2023 | [A] Tabel 7 s. 9 | none fitting (a spending frame) | — | → `omittedDa` |
| **I alt** | −10,7 | 2023 | [A] Tabel 7; [B] Tabel 6 | | | |

If the reform's three topskat elements become one row as the spec says: Topskat −3,7 + 1,0 = −2,7 mia. kr.
(2023-niveau) — the sum is ours; each part is quoted above. Cross-check [E]: whole reform "Umiddelbart provenu"
−11,9 mia. kr. (2026-niveau), "Provenu efter tilbageløb og adfærd" −7,6 (2026-niveau).

### Structural employment

- **5.300 fuldtidspersoner** in 2030. [A] s. 10: "Aftalen skønnes samlet set at øge den strukturelle beskæftigelse
  med 5.300 fuldtidspersoner i 2030." Same figure in [B] Tabel 6 (column "Arbejdsudbud (fuldtidspersoner)") and
  [E] Tabel 1 ("Strukturel fuldtidsbesk.").
- Per element, [B] Tabel 6: beskæftigelsesfradrag 1.950; enlige forsørgere 150; seniorer 50; seniorpræmie 100;
  mellemskat/ny topskat 3.150; top-topskat −100; boafgift 0; tillægsboafgift 0; bonus "-". If the omitted
  elements are dropped, their FTE (0, 0, "-") changes nothing; if the seniorpræmie is omitted, the 100 FTE
  question needs an owner ruling (keep the published total 5.300, or 5.200 for the modelled elements).

### Financing (as stated)

| row | figure (mia. kr.) | price year | source | shock | note |
|---|---|---|---|---|---|
| Lavere offentligt forbrug (råderummet) | +6,7 (2026) | 2024 | [C] s. 1: "mindreprovenu på 3,6 mia. kr. i 2025 og 6,7 mia. kr. (2024-priser) i 2026. Finansieringen heraf sker via råderummet og indebærer tilsvarende mindreudgifter til det offentlige forbrug." | Offentligt_forbrug, or 1/3 Offentlig_varekoeb + 2/3 Offentlig_Beskaeftigelse ([D] Anm. 1: "1/3 realt offentligt varekøb og 2/3 offentlig beskæftigelse") | sized **after** tilbageløb og adfærd, while the elements are static |
| alternative wording | "ca. 6¾ mia. kr. (2023-niveau)" finansieringsbehov efter tilbageløb og adfærd, "finansieres inden for regeringens 2030-plan" | 2023 | [A] s. 9 | same | no instrument named in [A]; [C] names offentligt forbrug |

Owner decision needed: which financing figure (6,7 in 2024 prices from [C], which names offentligt forbrug, or
6¾ in 2023 prices from [A], same price year as the elements), and whether the Offentligt_forbrug shock (all
public inputs incl. investment, `catalog.py:307`) or FM's 1/3–2/3 split is the mapping. Either way the FM
financing is sized to the after-behaviour cost; MAKRO computes its own tilbageløb from the static rows, so
the preset's saldo will not be zero by construction. The method note should say so.

### Size check (not a scale, just order of magnitude)
Beskæftigelsesfradrag rows −7,515 mia. kr. ≈ −0,28 pct. af BNP 2023; Topskat row −2,7 ≈ −0,10 pct. af BNP
(≈ −1,8 pct.-point on tTop). Both near the ladder.

**Verdict:** meets rule (a). All required figures found.

---

## 2. Liberal Alliance 2035-plan, personskattedelen — `la-2035-personskat` — ELIGIBLE FOR THE THREE PERSONAL-TAX ELEMENTS ONLY

- Proposer: Liberal Alliance ("Liberal Alliances 2035-plan. Fra tryghedsstat. Til ansvarssamfund.", april 2022).
- Status: `forslag`. Date: FM/SKM costing 2023-12-26 (plan 2022-04).
- Sources:
  - [F] SAU alm. del (2023-24) svar på spm. 133 og 134 (skatteministeren, 26. december 2023), Tabel 1, s. 2 —
    https://www.ft.dk/samling/20231/almdel/sau/spm/133/svar/2011469/2805409.pdf
    (HTML: https://www.ft.dk/samling/20231/almdel/sau/spm/133/svar/2011469/2805409/index.htm)
  - [G] the plan — https://www.liberalalliance.dk/wp-content/uploads/2022/04/Liberal-Alliances-2035-plan-1.pdf (s. 7 and s. 10: lists of "Her bruger vi penge" / "Her sparer vi penge", no kroner per item)
  - [H] SAU alm. del (2023-24) svar på spm. 267 (9. februar 2024) — static revenue of nine LA tax items, **no** arbejdsudbud —
    https://www.ft.dk/samling/20231/almdel/sau/spm/267/svar/2021611/2823456.pdf

[F] is computed on rules without the Personskattereform ("2025-regler i 2023-niveau", topskat 15 pct., loft
44.800 kr.), which is what MAKRO's grundforløb holds.

### Elements

| element | FM/SKM figure (mia. kr.) | price year | source + page | shock | mapped? | in grundforløb? |
|---|---|---|---|---|---|---|
| Afskaffelse af topskatten | −23,3 | 2023 | [F] Tabel 1, s. 2 | Topskat | no (own instrument) — but see warning | no (tTop 15 %) |
| Afskaffelse af loft over beskæftigelsesfradraget (computed after the topskat abolition) | −12,9 | 2023 | [F] Tabel 1, s. 2 | Beskaeftigelsesfradrag | yes: MAKRO's fradrag is a proportional effective rate without a cap; same revenue | no |
| Første 7.000 kr. pr. måned skattefrie (personfradrag og fradrag i arbejdsmarkedsbidrag på 84.000 kr. årligt) | −77,2 | 2023 | [F] Tabel 1, s. 2 | Bundskat (+ AM_bidrag) | yes: MAKRO has no personfradrag; the split between the personfradrag part and the AM-bidrag part is **ikke oplyst** in [F] | no |
| Samlet forslag | −113,4 | 2023 | [F] Tabel 1 | | | |

### Structural employment
[F] Tabel 1, column "Arbejdsudbud, Fuldtidspersoner" (rounded to 100): topskat **11.400**; loft **7.000**;
7.000 kr. skattefrit **−9.400**; samlet forslag **9.000**.

### Financing
- The plan's savings ([G] s. 7, s. 10: "Nulvækst i det offentlige", "Afskaffelse af efterløn", SU, dagpenge,
  kontanthjælp …) carry **no kroner per item**, and no FM costing of them was found with both figures.
  Financing size: **ikke oplyst**.
- The rest of the plan's tax side (selskabsskat 15 pct. −22,9; flad 27 pct. aktie/kapital −11,0; bo- og
  gaveafgift −5,8; registreringsafgift −18,7; arbejdsskadeafgift −0,6; fagligt fradrag +2,2; all [H] Tabel 1,
  umiddelbar virkning, 2023-niveau) has static figures but **no arbejdsudbud** → not includable under rule (a).

### Warnings for the owner
1. **Topskat abolition exceeds MAKRO's topskat revenue**: −23,3 (FM, 2023) vs vtTop 2023 = 20,75 in the
   reference. At the same revenue the mapped scale drives tTop below zero (≈ −16 pct.-point from 15 pct.). The
   FM figure includes topskat on positive nettokapitalindkomst, which MAKRO's vtTop may not carry.
2. **Size**: −113,4 mia. kr. ≈ −4,3 pct. af BNP; the 7.000 kr. row alone (−77,2) is half of vtBund. Far off
   the ladder; the ≤ 10 % joint-solve gate is at real risk.
3. Only the personal-tax part of a much larger plan; the card would have to say so (`omittedDa`).

**Verdict:** the three personal-tax elements meet rule (a) (static + FTE per element, one answer). The plan as a
whole does not (other tax items lack FTE; financing has no kroner).

---

## 3. Regeringens skattereform 2026 (S, SF, M, RV) — `skattereform-2026` — NOT YET ELIGIBLE (figures not published)

- Source: "Det politiske grundlag for firkløverregeringen", juni 2026, s. 44–45 —
  https://stm.dk/media/rc1ktdmg/det-politiske-grundlag-for-firkloeverregeringen.pdf
  Elements: halvering af momsen på fødevarer / ingen moms på frugt og grønt; afskaffelse af toptopskatten
  (finansieret af ny hovedaktionærmodel); afskaffelse af mellemskatten; progressionsgrænse for aktieindkomst
  ca. +20.000 kr.; selskabsskat −3 pct.-point over tre år (s. 49, PDF-side 50). Financing listed without kroner
  (chokolade- og sukkerafgift fastholdes, momsramme, nominel fastholdelse af beløbsgrænser, erhvervsstøtte
  1,5 mia. kr., F&U-fradrag ca. 1 mia. kr., rentefradragsloft, boafgift, råderum).
- Skatte- og Vækstministeriet, pressemeddelelse 28-09-2026 ("Engel-Schmidt til blå partier …",
  https://svmn.dk/aktuelt/presse-nyheder/pressemeddelelser/engel-schmidt-til-blaa-partier-sammen-kan-vi-give-619000-danskere-en-skattelettelse):
  619.000 danskere, gennemsnitlig lettelse ca. 7.200 kr. i 2030. Static revenue and FTE: **ikke oplyst** in the
  release (press reports quote ca. 2,5 mia. kr. and godt 3.000 personer without a source document).
- Mapping when figures come: mellemskat → Topskat (mapped, same revenue); toptopskat → Topskat (mapped);
  fødevaremoms → Moms (needs formula; proportional factor shock); selskabsskat → Selskabsskat (needs formula);
  aktieskat → Aktieskat (needs formula). In grundforløb: no (tTop 15 % pre-reform base; tSelskab 0.22 flat 2025–2030).
- Note: relative to MAKRO's pre-reform grundforløb, "afskaffelse af mellemskatten" is a cut from the
  post-reform law; its FM figure maps onto Topskat at the same revenue, but the preset is only coherent on top of
  the Personskattereform preset's topskat row — the owner may prefer to wait for the lovforslag.

**Verdict:** fails rule (a) today; re-check when the aftale/lovforslag with FM tables is published.

---

## 4. Candidates checked and rejected (one line each)

| candidate | what FM/SKM published | missing | source |
|---|---|---|---|
| Dansk Folkepartis 2030-plan (marts 2024) | per element: "Saldovirkning efter tilbageløb og adfærd (mia. kr., 2024-niveau)", strukturel beskæftigelse, BNP | static (umiddelbar) revenue per element; FM: "ikke muligt at foretage en samlet vurdering" | FIU alm. del (2023-24) svar på spm. 207, 28. juni 2024, Tabel 1 s. 2–6 — https://www.ft.dk/samling/20231/almdel/fiu/spm/207/svar/2059724/2888707.pdf |
| SF: tilbagerul mellemskat/ny topskat til den tidligere topskat (stillet efter ønske fra Sofie Lippert (SF)) | umiddelbar +4,2 mia. kr. (2025-niveau), efter tilbageløb og adfærd +1,7 | arbejdsudbud; and the rollback target *is* MAKRO's grundforløb (element would be omitted → empty preset) | SAU alm. del (2024-25) svar på spm. 483, Tabel 1 — https://www.ft.dk/samling/20241/almdel/sau/spm/483/svar/2163016/3069762/index.htm |
| Enhedslisten "solidarisk skattereform" (12. marts 2026): personfradrag +12.000 kr. (aftrappet 300–400.000 kr.), aktie-/kapitalindkomst beskattet som løn | figures quoted by the party as Skatteministeriets (10,6 mia. kr. cost; 13,2 mia. kr. revenue) | FM source document not found; arbejdsudbud not found; personfradrag has no MAKRO instrument | press release summary, lovguiden.dk 2026-03-12 |
| Aftale om nyt kontanthjælpssystem (okt. 2023; S, V, M, SF, K, RV) | 750 fuldtidspersoner; "Merudgifter … efter skat, tilbageløb og adfærd"; "varigt udgiftsneutrale" | static revenue; source is Beskæftigelsesministeriet | https://bm.dk/media/ml3bmn5v/aftale-om-nyt-kontanthjaelpssystem-flere-i-arbejde-enklere-regler-og-faerre-boern-i-lavindkomst.pdf, Tabel 3 s. 10 |
| Liberal Alliance "En frisk start" (2025/2026) | FM for one element: FIU alm. del (2024-25) spm. 152 (27. marts 2025): fradrag 60.000 kr. umiddelbart −20,2 mia. kr. (2025-niveau), arbejdsudbud −625 fuldtidspersoner | the party's own table (after behaviour, own FTE figures that differ from FM's for this element); the other elements' FM answers not collected | https://www.ft.dk/samling/20241/almdel/fiu/spm/152/svar/2124670/2996494.pdf; plan: https://www.liberalalliance.dk/wp-content/uploads/2026/03/En-frisk-start.pdf |
| Danmarksdemokraterne, finanslovsforslag 2026 | a compilation citing many separate answers | no FM costing of the proposal as a whole | https://danmarksdemokraterne.dk/forside/wp-content/uploads/2025/12/Finanslov26_V6.pdf |

---

## Political balance of the set (no ranking)

- Eligible now: the Personskattereform (enacted; S, V, M with DD, K, RV, NB — a broad agreement across the
  government and parties to its right, plus RV) and the personal-tax part of LA's 2035-plan (one party).
- No proposal from SF, EL or the current S–SF–M–RV government was found with both FM figures. The nearest is the
  government's announced skattereform 2026, whose FM figures are not yet published.
- A set of the two eligible entries would therefore have no counterpart from the parties left of the centre.
  Adding the LA entry changes the balance of the set in one direction; waiting for the 2026 reform would add an
  entry from the current government (S, SF, M, RV).

## Recommendation (for the owner's gate)

1. **Personskattereform 2025/26** — ship. All figures found (static per element, 5.300 FTE, financing named in
   [C]). Decisions: financing figure/mapping; seniorpræmie kept (new formula) or omitted.
2. **Regeringens skattereform 2026** — add as soon as FM/SVM publishes the element table (aftale or lovforslag);
   re-run this check then.
3. **Liberal Alliance 2035-plan, personskattedelen** — include together with (2), not alone, so the set spans
   both sides; only with the owner's ruling on the topskat-abolition-exceeds-vtTop problem, the unsplit 7.000 kr.
   row, the missing financing size, and acceptance that it may fail the ≤ 10 % joint-solve gate.
4. If a fourth is wanted: a targeted FIU/SAU search for an SF or EL proposal whose answer carries both
   "umiddelbar" and "arbejdsudbud (fuldtidspersoner)" (none found in this pass).

Not done in this pass: ft.dk full-text search (the site search returned only committee lists); FM answers for the
other "En frisk start" elements; the question-asker for SAU 133.

## Owner decisions (2026-09-28)

1. **Launch set: ONLY Personskattereform 2025/26.** Skattereform 2026 waits for the Finance Ministry's element
   tables (aftale or lovforslag); LA's 2035-plan is not included now — the set stays at one entry rather than
   pairing an enacted government reform with a single opposition party's plan.
2. **Financing: 6,7 mia. kr. (2024-priser)** from source [C] (L 138 svar på spm. 2), split per the Finance
   Ministry's own stated convention in [D] (L 138 svar på spm. 1, Anm. 1): 1/3 to `Offentlig_varekoeb` and 2/3
   to `Offentlig_Beskaeftigelse`. Written in `proposals.ts` as two financing rows, priceYear 2024, positive kr
   (a spending cut strengthens the balance): `6.7 / 3` and `(6.7 * 2) / 3`, so the split's arithmetic stays
   visible in the source.
3. **Seniorpræmie omitted; structural FTE = 5.200**, written as `5300 - 100` with a comment: the published
   total is 5.300 ([A] s. 10; [B] Tabel 6), less the seniorpræmie's 100 ([B] Tabel 6 per-element split) since
   the seniorpræmie itself has no MAKRO instrument (skattefri engangspræmie) and is listed in `omittedDa`.
   Source index for the structural row: [B].
