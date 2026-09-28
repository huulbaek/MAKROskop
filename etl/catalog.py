"""Curated catalogs for the MAKRO explorer.

Variable selection and labels are ported from DREAM's own plotting pipeline
(`Analysis/Templates/variables_to_plot.py` and
`Analysis/Standard_shocks/shocks_to_plot.py` in the MAKRO repo), so the
explorer shows the same headline series DREAM uses in their standard reports.

Conventions:
- `selector` picks a slice of a GDX variable, e.g. ("qBVT", ("tot",)) reads
  qBVT[tot,t]. An empty tuple means the variable is indexed by t only.
- `trend` names the growth/inflation adjustment factor used to convert
  MAKRO's detrended model units into actual levels: "fvt" for values,
  "fqt" for quantities, "fpt" for prices, None for counts and rates.
- `dev_mode` controls how shock deviations from baseline are displayed:
  "pct" = percent deviation (DREAM's "pq"), "pp" = percentage-point
  deviation x100 (DREAM's "pm").
"""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class SeriesDef:
    key: str
    gdx_name: str
    selector: tuple[str, ...]
    label_da: str
    label_en: str
    group: str
    unit_da: str
    trend: str | None
    dev_mode: str


SERIES: list[SeriesDef] = [
    # --- Nationalregnskab ---
    SeriesDef("qBNP", "qBNP", (), "BNP (realt)", "GDP (real)", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),
    SeriesDef("vBNP", "vBNP", (), "BNP (nominelt)", "GDP (nominal)", "Nationalregnskab", "mia. kr.", "fvt", "pct"),
    SeriesDef("qC", "qC", ("cTot",), "Privat forbrug", "Private consumption", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),
    SeriesDef("qG", "qG", ("gTot",), "Offentligt forbrug", "Government consumption", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),
    SeriesDef("qI", "qI", ("iTot",), "Investeringer i alt", "Total investments", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),
    SeriesDef("qIbErhverv", "qIbErhverv", (), "Erhvervsbyggeri", "Commercial building investments", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),
    SeriesDef("qX", "qXy", ("xTot",), "Eksport", "Exports", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),
    SeriesDef("qM", "qM", ("tot",), "Import", "Imports", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),
    SeriesDef("qBVT", "qBVT", ("tot",), "Bruttoværditilvækst (BVT)", "Gross value added", "Nationalregnskab", "mia. 2020-kr.", "fqt", "pct"),

    # --- Arbejdsmarked ---
    SeriesDef("nL", "nL", ("tot",), "Beskæftigelse", "Employment", "Arbejdsmarked", "1.000 personer", None, "pct"),
    SeriesDef("nLsp", "nL", ("spTot",), "Privat beskæftigelse", "Private employment", "Arbejdsmarked", "1.000 personer", None, "pct"),
    SeriesDef("nLoff", "nL", ("off",), "Offentlig beskæftigelse", "Public employment", "Arbejdsmarked", "1.000 personer", None, "pct"),
    SeriesDef("snL", "snL", ("tot",), "Strukturel beskæftigelse", "Structural employment", "Arbejdsmarked", "1.000 personer", None, "pct"),
    SeriesDef("nBruttoLedig", "nBruttoLedig", (), "Bruttoledighed", "Gross unemployment", "Arbejdsmarked", "1.000 personer", None, "pct"),
    SeriesDef("nBruttoArbsty", "nBruttoArbsty", (), "Arbejdsstyrke (brutto)", "Labor force (gross)", "Arbejdsmarked", "1.000 personer", None, "pct"),
    SeriesDef("nPop", "nPop", ("tot",), "Befolkning", "Population", "Arbejdsmarked", "1.000 personer", None, "pct"),

    # --- Priser og løn ---
    SeriesDef("pC", "pC", ("cTot",), "Forbrugerpriser", "Consumer prices", "Priser og løn", "indeks (2020=1)", "fpt", "pct"),
    SeriesDef("pBVT", "pBVT", ("tot",), "BVT-deflator", "GVA deflator", "Priser og løn", "indeks (2020=1)", "fpt", "pct"),
    SeriesDef("pBolig", "pBolig", (), "Boligpriser", "House prices", "Priser og løn", "indeks (2020=1)", "fpt", "pct"),
    SeriesDef("vhW", "vhW_DA", (), "Timeløn (DA-området)", "Hourly wages (DA)", "Priser og løn", "kr. pr. time", "fvt", "pct"),

    # --- Offentlige finanser ---
    SeriesDef("vSaldo", "vSaldo", (), "Offentlig saldo", "Public balance", "Offentlige finanser", "mia. kr.", "fvt", "gdp_pp"),
    SeriesDef("vPrimSaldo", "vPrimSaldo", (), "Primær saldo", "Primary balance", "Offentlige finanser", "mia. kr.", "fvt", "gdp_pp"),
    SeriesDef("vOff13Net", "vOff13Net", (), "Offentlig nettoformue", "Public net financial worth", "Offentlige finanser", "mia. kr.", "fvt", "gdp_pp"),
    SeriesDef("tLukning", "tLukning", (), "Beregningsteknisk lukkeskat", "Fiscal closure tax rate", "Offentlige finanser", "pct.-sats", None, "pp"),

    # --- Renter mv. ---
    SeriesDef("rRenteObl", "rRente", ("Obl",), "Obligationsrente", "Bond interest rate", "Renter", "pct.", None, "pp"),
    SeriesDef("rRenteECB", "rRenteECB", (), "ECB-rente", "ECB policy rate", "Renter", "pct.", None, "pp"),
    SeriesDef("pOlie", "pOlie", (), "Oliepris", "Oil price", "Renter", "indeks", "fpt", "pct"),
]

SECTOR_SERIES_TEMPLATES = [
    ("qBVT", "BVT", "Gross value added", "mia. 2020-kr.", "fqt"),
    ("nL", "Beskæftigelse", "Employment", "1.000 personer", None),
]

SECTORS = ["tje", "fre", "byg", "lan", "soe", "bol", "ene", "udv", "off"]

# Ratio series computed in the ETL from the extracted series above.
# (key, numerator_key, denominator_key, label_da, label_en, group, unit)
RATIOS = [
    ("ledighedsgrad", "nBruttoLedig", "nBruttoArbsty", "Bruttoledighedsgrad", "Unemployment rate", "Arbejdsmarked", "pct. af arbejdsstyrken"),
    ("saldo2bnp", "vSaldo", "vBNP", "Offentlig saldo, andel af BNP", "Public balance, share of GDP", "Offentlige finanser", "pct. af BNP"),
    ("primsaldo2bnp", "vPrimSaldo", "vBNP", "Primær saldo, andel af BNP", "Primary balance, share of GDP", "Offentlige finanser", "pct. af BNP"),
    ("nettoformue2bnp", "vOff13Net", "vBNP", "Offentlig nettoformue, andel af BNP", "Public net worth, share of GDP", "Offentlige finanser", "pct. af BNP"),
]

# Growth-rate series computed in the ETL from the re-trended levels of the series above, the way
# DREAM's own report template does it ("Inflation (pBVT)" = pBVT / lag(pBVT) * fp - 1 in
# Analysis/Templates/variables_to_plot.py). Baseline levels are pct. per year; shock deviations are
# pct.-point differences in the growth rate. DREAM's review (2026-09-09) asked for these instead of
# the index levels under "Priser og løn"; the level series stay for the scenario pages.
# (key, source_key, label_da, label_en, group, unit)
GROWTH = [
    ("pC_vaekst", "pC", "Inflation (forbrugerpriser)", "Consumer price inflation", "Priser og løn", "pct. p.a."),
    ("pBVT_vaekst", "pBVT", "BVT-deflator, vækst", "GVA deflator growth", "Priser og løn", "pct. p.a."),
    ("pBolig_vaekst", "pBolig", "Boligpriser, vækst", "House price growth", "Priser og løn", "pct. p.a."),
    ("vhW_vaekst", "vhW", "Lønstigning (DA-området)", "Hourly wage growth (DA)", "Priser og løn", "pct. p.a."),
]


# Display scaling applied to baseline levels (not deviations): rates -> pct., wages -> kr.
DISPLAY_SCALE = {"rRenteObl": 100, "rRenteECB": 100, "tLukning": 100, "vhW": 1000}


@dataclass(frozen=True)
class ShockDef:
    name: str  # gdx file stem used by Analysis/Standard_shocks
    label_da: str
    label_en: str
    group: str


SHOCKS: list[ShockDef] = [
    ShockDef("Offentligt_forbrug", "Offentligt forbrug", "Government consumption", "Offentlige udgifter"),
    ShockDef("Offentlig_varekoeb", "Offentlige varekøb", "Government purchases", "Offentlige udgifter"),
    ShockDef("Offentlig_Beskaeftigelse", "Offentlig beskæftigelse", "Government employment", "Offentlige udgifter"),
    ShockDef("Offentlig_loen", "Offentlig løn", "Government wages", "Offentlige udgifter"),
    ShockDef("Offentlige_investeringer", "Offentlige investeringer", "Public investments", "Offentlige udgifter"),
    ShockDef("Skattepligtig_indkomstoverforsel", "Skattepligtige overførsler", "Taxable transfers", "Offentlige udgifter"),
    ShockDef("Ikke_skattepligtig_indkomstoverforsel", "Ikke-skattepligtige overførsler", "Non-taxable transfers", "Offentlige udgifter"),
    ShockDef("Overforsel_privat", "Øvrige overførsler til husholdninger", "Other transfers to households", "Offentlige udgifter"),
    ShockDef("Bundskat", "Bundskat", "Income tax (bundskat)", "Skatter og afgifter"),
    ShockDef("Topskat", "Topskat", "Top-bracket income tax", "Skatter og afgifter"),
    ShockDef("Beskaeftigelsesfradrag", "Beskæftigelsesfradrag", "Earned income tax credit", "Skatter og afgifter"),
    ShockDef("AM_bidrag", "AM-bidrag", "Labor market contribution", "Skatter og afgifter"),
    ShockDef("Grundskyld", "Grundskyld", "Land tax", "Skatter og afgifter"),
    ShockDef("Ejendomsvaerdiskat", "Ejendomsværdiskat", "Property value tax", "Skatter og afgifter"),
    ShockDef("Vaegtafgift", "Vægtafgift", "Vehicle excise duty", "Skatter og afgifter"),
    ShockDef("Selskabsskat", "Selskabsskat", "Corporate income tax", "Skatter og afgifter"),
    ShockDef("Aktieskat", "Aktieskat", "Dividend/capital gains tax", "Skatter og afgifter"),
    ShockDef("Moms", "Moms", "VAT", "Skatter og afgifter"),
    ShockDef("Moms_ned", "Momsnedsættelse", "VAT cut", "Skatter og afgifter"),
    ShockDef("Registreringsafgift", "Registreringsafgift", "Vehicle registration tax", "Skatter og afgifter"),
    ShockDef("Energiafgift", "Energiafgift", "Household energy taxes", "Skatter og afgifter"),
    ShockDef("Forbrugsafgift", "Øvrige forbrugsafgifter", "Other consumption taxes", "Skatter og afgifter"),
    ShockDef("Afgift_erhverv", "Afgifter på erhvervs materialeinput", "Duties on intermediate goods", "Skatter og afgifter"),
    ShockDef("Produktsubsidier", "Produktsubsidier", "Product subsidies", "Subsidier"),
    ShockDef("Lontilskud", "Løntilskud", "Wage subsidies", "Subsidier"),
    ShockDef("Produktionssubsidier", "Produktionssubsidier", "Production subsidies", "Subsidier"),
    ShockDef("Eksportmarkedsvaekst", "Eksportmarkedsvækst", "Export market growth", "Udland"),
    ShockDef("Importpris", "Importpriser", "Import prices", "Udland"),
    ShockDef("Eksportkonkurrerende_priser", "Eksportkonkurrerende priser", "Export-competing prices", "Udland"),
    ShockDef("Oliepris", "Oliepris", "Oil price", "Udland"),
    ShockDef("Udenlandske_priser", "Udenlandske priser", "Foreign prices", "Udland"),
    ShockDef("Rente", "Rente (ECB)", "Interest rate (ECB)", "Udland"),
    ShockDef("Arbejdsudbud_beskaeftigelse", "Arbejdsudbud (beskæftigelse)", "Labor supply (employment)", "Udbud og struktur"),
    ShockDef("Arbejdsudbud_timer", "Arbejdsudbud (timer)", "Labor supply (hours)", "Udbud og struktur"),
    ShockDef("Befolkning", "Befolkning", "Population", "Udbud og struktur"),
    ShockDef("KapitalProd", "Kapitalproduktivitet", "Capital productivity", "Udbud og struktur"),
    ShockDef("ArbejdsProd", "Arbejdskraftproduktivitet", "Labor productivity", "Udbud og struktur"),
    ShockDef("VirkDisk", "Virksomhedernes hurdle rates", "Firm hurdle rates", "Risikopræmier"),
    ShockDef("BoligRisiko", "Risikopræmie på bolig", "Housing risk premium", "Risikopræmier"),
    ShockDef("AktieAfkast", "Hurdle rates og aktieafkast", "Hurdle rates and equity returns", "Risikopræmier"),
    ShockDef("RisikoPraemier", "Alle risikopræmier", "All risk premia", "Risikopræmier"),
    ShockDef("Diskontering", "Husholdningernes diskontering", "Household discounting", "Præferencer"),
    ShockDef("Loen", "Lønmodtagernes forhandlingsstyrke", "Wage bargaining power", "Præferencer"),
]

VARIATIONS = [
    ("_blip", "1-årigt stød", "One-year blip"),
    ("_midl", "Midlertidigt (AR-profil)", "Transitory (AR profile)"),
    ("_perm", "Permanent, finansieret", "Permanent, financed"),
    ("_ufin", "Permanent, ufinansieret", "Permanent, unfinanced"),
]


@dataclass(frozen=True)
class ShockRun:
    """How MAKROskop's free solver actually implements a catalog shock.

    Mirrors the `solve-export` calls in cloud/run.sh and cloud/run_batch2.sh: the
    exogenous `instrument` is set to `level * factor + delta` in every year of the
    shock window and the model is re-solved. `dream_da` states how this differs
    from DREAM's own standard shock of the same name (Analysis/Standard_shocks).
    """
    shock: str            # catalog name (ShockDef.name)
    instrument: str       # exogenous model variable
    instrument_da: str    # the model's own label for it
    factor: float
    delta: float
    change_da: str        # the change in words, e.g. "+1 pct.-point"
    first_year: int
    dream_da: str
    series_key: str | None = None  # SERIES key of the instrument, if it is a catalog series
    linearity_da: str | None = None  # measured nonlinearity (nonlinearity.py), if known
    # Largest |scale| the UI may offer. Set it where the model itself has a boundary the
    # solver could not cross, so the slider cannot extrapolate past a point we know has
    # no solution. None = the UI default.
    max_scale: float | None = None
    max_scale_da: str | None = None  # why the cap is there, shown next to the slider
    explainer_da: str | None = None  # 2-3 plain-language sentences on the mechanism, for readers
    # The same for the financed (_perm) run (makroskop-gnp.8): the lukkeskat hands the revenue back
    # to households (or takes the cost from them), which can flip what explainer_da says. The
    # lukkeskat's size is written as the slot {lukning}, which the ETL fills from the solve.
    explainer_perm_da: str | None = None
    # The explainer drawn on the mechanism map (makroskop-hkt): chains of series keys "a>b>c" whose
    # arrows must be edges of the map in app/src/lib/mechanism-map.json (tests/test_channel.py). A
    # chain starting on a node no earlier chain reached is hit by the shock directly.
    channel: tuple[str, ...] = ()
    # The solve-export call itself, where `instrument` is worded for readers: --shock-name
    # (None = `instrument`) and --endogenize. extract.py checks both against the GDX stamp.
    solver_shock: str | None = None
    endogenize: str = ""
    # How the pages word the change at any slider scale: change_size × scale, then change_unit_da
    # ("+0,5 pct.-point"). None = derived from factor/delta by change_display; set them where that
    # rule cannot state the unit (a mia.-kr. delta, a disutility factor below 1, a j-term).
    change_size: float | None = None
    change_unit_da: str | None = None
    # Headline subject when neither the model's label nor the catalog name fits (card.ts
    # cardSubject), e.g. where the catalog label names the other side of the instrument.
    short_da: str | None = None


# makroskop-gnp.2: tMoms_y/tMoms_m are effective per-cell rates (revenue / base), about zero for
# exports and deductible business inputs. A flat pct.-point delta put VAT on (or subsidised) those
# cells; scale every cell by the same factor instead, as DREAM does.
_VAT_PROPORTIONAL = (
    "Alle momssatser i modellen ganges med samme faktor, som i DREAMs standardstød – satserne er "
    "effektive satser pr. efterspørgselskomponent, og dem, der er nul (eksport, fradragsberettigede "
    "køb), forbliver nul. 2 pct. af satsen svarer til, at momsen på 25 pct. ændres med 0,5 pct.-point. "
    "DREAM normerer størrelsen til 1 pct. af BNP i provenu; MAKROskop bruger en fast faktor."
)

_DREAM_GDP_NORM = (
    "DREAMs standardstød af samme navn normerer i stedet ændringen til 1 pct. af BNP i provenu "
    "(og sænker satsen); MAKROskop ændrer selve satsen med en fast størrelse. Størrelserne er derfor "
    "ikke direkte sammenlignelige."
)

SHOCK_RUNS: list[ShockRun] = [
    ShockRun("Rente", "rRenteECB", "ECB-renten", 1.0, 0.01, "+1 pct.-point (100 basispoint)", 2030,
             "Samme instrument, størrelse og stødår (2030) som DREAMs standardstød \"Rente\" "
             "(rRenteECB + 0,01). "
             "Alle danske renter i MAKRO er bygget oven på ECB-renten (obligations-, bank- og "
             "virksomhedernes afkastkrav), så gennemslaget er 1:1; udenlandske priser er uændrede, "
             "så det er reelt en permanent højere realrente.",
             series_key="rRenteECB",
             channel=("rRenteObl>pBolig>qC>qBNP", "rRenteObl>qI>qBNP", "qBNP>nL>ledighedsgrad>vhW>pC", "qBNP>saldo2bnp"),
             explainer_da="En varigt højere ECB-rente slår 1:1 igennem på alle danske renter. Dyrere lån rammer først boligmarkedet — boligpriserne falder omkring 6 pct. de første år — og dernæst forbrug og investeringer, så BNP ligger 1–1,5 pct. lavere. Beskæftigelsen falder de første par år, indtil lønnen har tilpasset sig og ledigheden er tilbage på sit strukturelle niveau. På langt sigt retter boligpriser og forbrug sig, mens en mindre kapitalbeholdning holder investeringer, eksport og BNP nede.",
             explainer_perm_da="En varigt højere ECB-rente slår 1:1 igennem på alle danske renter. Den offentlige sektor er nettokreditor med en formue, der vokser kraftigt i grundforløbet, så den højere rente giver store renteindtægter på sigt – og finansieringen giver dem tilbage fra starten: lukkeskatten sænker husholdningernes skat med {lukning} af BNP om året, og saldoen ligger ca. 2–3 pct. af BNP lavere frem mod 2080. Skattelettelsen vender forbruget: det stiger 1,3 pct. i 2030 og ca. 4 pct. i 2050, og boligpriserne falder kun de første par år. Dyrere kapital holder investeringerne nede (erhvervsinvesteringerne op til 11 pct.), og med en mindre kapitalbeholdning falder eksporten og BNP gradvist – BNP op til knap 1 pct. Beskæftigelsen rører sig næsten ikke.",
             linearity_da="Målt på et 10-års udsnit: ved 64 pct. af stødet afviger modellen 1,1 pct. "
                          "(median) fra lineær skalering; BNP 0,8 pct., beskæftigelse 0,9 pct., "
                          "boligpriser 1,8 pct., enkelte branche-serier op til 6 pct. af effekten."),
    ShockRun("Oliepris", "pOlieBrent", "Prisnotering på råolie, Brent", 1.10, 0.0, "+10 pct.", 2030,
             "Samme instrument og størrelse som DREAMs standardstød. I kalibrerings-konfigurationen "
             "driver Brent-prisen kun oliepris-indekset pOlie, mens de import- og energipriser, det "
             "skulle slå igennem på, er faste datainput — så stødet bider næsten ikke. Brug "
             "\"Udenlandske priser\" eller \"Importpriser\" for et prisstød, der virker.",
             series_key="pOlie"),
    ShockRun("Udenlandske_priser", "pM, pXUdl", "Importpriser (alle varegrupper) og eksportkonkurrerende priser",
             1.01, 0.0, "+1 pct.", 2030,
             "Samme bundt og størrelse som DREAMs standardstød \"Udenlandske_priser\": alle eksogene "
             "importpriser pM[s] og udenlandske konkurrentpriser pXUdl[x] hæves 1 pct.; aggregaterne "
             "er endogene og følger med.",
             solver_shock="pM,pXUdl",
             channel=("pC>vhW", "qX>qBNP>nL>ledighedsgrad>vhW>pC", "pC>qX"),
             explainer_da="Højere import- og konkurrentpriser gør dansk produktion relativt billigere, så eksport "
                          "og BNP løftes på kort sigt. Over nogle år stiger danske priser og lønninger tilsvarende "
                          "(ca. 1 pct.), og den reale effekt forsvinder: resultatet er et varigt højere prisniveau, "
                          "ikke en varig aktivitetsgevinst.",
             explainer_perm_da="Højere import- og konkurrentpriser gør dansk produktion relativt billigere, så eksport og BNP løftes på kort sigt (BNP ca. 0,2 pct.). Over nogle år stiger danske priser og lønninger tilsvarende (ca. 1 pct.), og den reale effekt forsvinder: resultatet er et varigt højere prisniveau, ikke en varig aktivitetsgevinst. Finansieringen betyder næsten intet her – lukkeskatten ændres med {lukning} af BNP."),
    ShockRun("Importpris", "pM", "Importpriser (alle varegrupper)", 1.01, 0.0, "+1 pct.", 2030,
             "Samme instrument og størrelse som DREAMs standardstød \"Importpris\".",
             channel=("pC>qC>qBNP", "pC>qX>qBNP", "qC>qM", "qBNP>saldo2bnp"),
             explainer_da="Dyrere import hæver forbrugerpriserne og forringer bytteforholdet: realindkomst og forbrug falder, og eksporten taber terræn, fordi importerede input gør dansk produktion dyrere. BNP ligger gradvist op til 0,4 pct. lavere.",
             explainer_perm_da="Dyrere import hæver forbrugerpriserne og forringer bytteforholdet: realindkomst og forbrug falder, og eksporten taber terræn, fordi importerede input gør dansk produktion dyrere. De offentlige finanser svækkes også, så lukkeskatten hæver husholdningernes skat med {lukning} af BNP om året. Forbruget falder derfor ca. 1,3 pct. efter fem år og godt 1,5 pct. på langt sigt, og BNP ligger gradvist op til 0,5 pct. lavere."),
    ShockRun("Eksportkonkurrerende_priser", "pXUdl", "Udenlandske konkurrentpriser på eksportmarkederne",
             1.01, 0.0, "+1 pct.", 2030,
             "Samme instrument og størrelse som DREAMs standardstød \"Eksportkonkurrerende_priser\".",
             channel=("qX>qBNP>nL>ledighedsgrad>vhW>pC", "vhW>qC>qBNP", "qX>qM", "qBNP>saldo2bnp"),
             explainer_da="Højere udenlandske konkurrentpriser giver dansk eksport markedsandele: eksporten stiger gradvist til knap 1 pct. og BNP ca. 0,3 pct. Danske lønninger og priser trækkes op, og det bedre bytteforhold løfter forbruget ca. 0,8 pct.",
             explainer_perm_da="Højere udenlandske konkurrentpriser giver dansk eksport markedsandele: eksporten stiger gradvist til ca. 0,75 pct. og BNP knap 0,5 pct. Danske lønninger og priser trækkes op, og de offentlige finanser styrkes; lukkeskatten giver gevinsten tilbage som lavere skat ({lukning} af BNP om året). Sammen med det bedre bytteforhold løfter det forbruget ca. 1,5 pct."),
    ShockRun("Bundskat", "tBund", "Bundskattesats", 1.0, 0.01, "+1 pct.-point", 2030, _DREAM_GDP_NORM,
             channel=("qC>qBNP>nL>ledighedsgrad>vhW>qX", "pBolig>qI>qBNP", "saldo2bnp"),
             explainer_da="En højere bundskat tager af husholdningernes disponible indkomst: det private forbrug falder godt 1 pct., og boligpriserne følger med ned. Løn og priser falder lidt, hvilket styrker eksporten, så BNP ender knap 0,2 pct. lavere. Saldoen forbedres med ca. 0,4 pct. af BNP og mere over tid. Beskæftigelsen falder kun kortvarigt, fordi skatten i denne udgave af MAKRO ikke påvirker arbejdsudbuddet.",
             explainer_perm_da="Provenuet fra den højere bundskat – {lukning} af BNP – gives tilbage til husholdningerne via lukkeskatten, så deres samlede skat er næsten uændret. Forbrug, boligpriser, løn og BNP rører sig derfor højst ca. 0,05 pct., og saldoen er uændret: beregningen er en omlægning af skatten, ikke en stramning. Fordi bundskatten i denne udgave af MAKRO ikke påvirker arbejdsudbuddet, ændrer omlægningen næsten intet."),
    ShockRun("AM_bidrag", "tAMbidrag", "Arbejdsmarkedsbidrag, sats", 1.0, 0.01, "+1 pct.-point", 2030, _DREAM_GDP_NORM,
             channel=("qC>qBNP>nL>ledighedsgrad>vhW>qX", "pBolig>qI>qBNP", "saldo2bnp"),
             explainer_da="Et højere arbejdsmarkedsbidrag virker som bundskatten: lavere disponibel indkomst, forbruget falder ca. 0,8 pct., og boligpriserne følger med. Lavere løn styrker eksporten lidt, og BNP ligger ca. 0,1 pct. lavere. Saldoen forbedres med ca. 0,25 pct. af BNP og mere over tid.",
             explainer_perm_da="Provenuet fra det højere arbejdsmarkedsbidrag – {lukning} af BNP – gives tilbage til husholdningerne via lukkeskatten, så deres samlede skat er næsten uændret. Forbrug, boligpriser, løn og BNP rører sig under 0,05 pct., og saldoen er uændret: beregningen er en omlægning af skatten, ikke en stramning."),
    # makroskop-48o: the instruments of the personal income tax proposals. MAKRO June 2026 has one
    # working topskat step: tMellem and tTopTop are set from 2026, but their bases rMellemSkatInd and
    # rTopTopSkatInd are zero (GovRevenues.gms:826), so shocking them moves nothing.
    ShockRun("Topskat", "tTop", "Topskattesats", 1.0, 0.01, "+1 pct.-point", 2030,
             "DREAM har intet standardstød på topskatten; MAKROskop hæver satsen med 1 pct.-point. I denne "
             "udgave af MAKRO er topskatten ét trin (15 pct. af indkomsten over topskattegrænsen); mellem- "
             "og toptopskatten har endnu ikke data i modellen.",
             channel=("qC>qBNP>nL>ledighedsgrad>vhW>qX", "pBolig>qI>qBNP", "saldo2bnp")),
    ShockRun("Beskaeftigelsesfradrag", "tBeskFradrag", "Beskæftigelsesfradrag, sats af lønindkomsten",
             1.0, 0.01, "+1 pct.-point", 2030,
             "DREAM har intet standardstød på beskæftigelsesfradraget; MAKROskop hæver fradragets sats "
             "(ca. 7,4 pct. af lønindkomsten) med 1 pct.-point. Fradraget trækkes fra den skattepligtige "
             "indkomst og er derfor værd som kommune- og kirkeskatten; det indgår ikke i MAKROs marginalskat.",
             channel=("qC>qBNP>nL>ledighedsgrad>vhW>qX", "pBolig>qI>qBNP", "saldo2bnp")),
    ShockRun("Selskabsskat", "tSelskab", "Selskabsskattesats", 1.0, 0.01, "+1 pct.-point", 2030, _DREAM_GDP_NORM,
             channel=("qI>qBNP", "qC>qBNP", "saldo2bnp"),
             explainer_da="Højere selskabsskat gør investeringer dyrere: erhvervsinvesteringerne falder op til 0,9 pct. og de samlede investeringer ca. 0,2 pct. Med mindre kapital falder lønnen, og forbruget falder gradvist (ca. 0,25 pct. på langt sigt). BNP ender knap 0,1 pct. lavere, mens saldoen forbedres.",
             explainer_perm_da="Højere selskabsskat gør investeringer dyrere: erhvervsinvesteringerne falder op til 0,9 pct. og de samlede investeringer godt 0,1 pct. Med mindre kapital falder lønnen ca. 0,1 pct., og BNP ender ca. 0,06 pct. lavere. Provenuet ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten, så forbruget stiger lidt de første år og er tilbage ved grundforløbet på langt sigt."),
    ShockRun("Ejendomsvaerdiskat", "tEjd", "Ejendomsværdiskat, implicit sats", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("pBolig>qI>qBNP", "qC>qBNP", "saldo2bnp"),
             explainer_da="Højere ejendomsværdiskat gør det dyrere at eje bolig: boligpriserne falder ca. 0,3 pct. i starten og knap 0,2 pct. på langt sigt, og investeringerne dæmpes lidt. Forbruget falder ca. 0,1 pct., fordi skatten tager af indkomsten; BNP-effekten er lille, saldoen forbedres.",
             explainer_perm_da="Højere ejendomsværdiskat gør det dyrere at eje bolig: boligpriserne falder knap 0,2 pct. i starten og ca. 0,1 pct. på langt sigt, og investeringerne dæmpes lidt. Provenuet ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten, så forbruget er stort set uændret, og BNP-effekten er ubetydelig."),
    ShockRun("Offentligt_forbrug", "qR(off,*),qE(off,*),hL(off,*),qI_s(!iTot,off,*)",
             "Offentlig sektors input: varekøb, energi, arbejdstimer og investeringer", 1.01, 0.0, "+1 pct.", 2030,
             "Samme instrumenter som DREAMs standardstød (den offentlige produktions eksogene input); "
             "DREAM normerer ændringen til 1 pct. af BNP, MAKROskop hæver alle input med 1 pct.",
             channel=("qG>nL>ledighedsgrad>vhW", "qG>qBNP", "vhW>qX>qBNP", "saldo2bnp"),
             explainer_da="Mere offentligt forbrug løfter aktivitet og beskæftigelse det første år (BNP knap +0,2 pct.), men effekten klinger hurtigt af: arbejdsudbuddet er uændret, så de ekstra offentlige ansatte trækkes fra den private sektor, lønningerne stiger, og eksporten falder. BNP ender ca. 0,1 pct. lavere. Fordi udgiften ikke er finansieret, vokser underskuddet på de offentlige finanser år for år.",
             explainer_perm_da="Mere offentligt forbrug finansieres med højere skat: lukkeskatten hæver husholdningernes skat med {lukning} af BNP om året. De ekstra offentlige job løfter beskæftigelsen det første år, men arbejdsudbuddet er uændret, så de trækkes fra den private sektor: eksporten falder ca. 0,4 pct., og BNP ender godt 0,2 pct. lavere. Den højere skat sænker forbruget ca. 0,5–0,8 pct. og boligpriserne ca. 0,5–0,7 pct."),
    ShockRun("Skattepligtig_indkomstoverforsel", "uvOvfSats(!boernyd|boligyd|iskatpl|groen|lumpsumovf,*)",
             "Satser for skattepligtige overførsler (ekskl. de ubeskattede ydelser)", 1.01, 0.0, "+1 pct.", 2030,
             "Samme afgrænsning som DREAMs standardstød (kun skattepligtige ydelser); DREAM normerer "
             "ændringen til 1 pct. af BNP, MAKROskop hæver satserne med 1 pct.",
             channel=("qC>qBNP", "pBolig", "saldo2bnp"),
             explainer_da="1 pct. højere skattepligtige overførsler løfter forbruget ca. 0,2 pct. og boligpriserne lidt; BNP-effekten er lille, og saldoen svækkes.",
             explainer_perm_da="Finansieringen henter pengene tilbage fra husholdningerne via lukkeskatten ({lukning} af BNP om året), så 1 pct. højere skattepligtige overførsler flytter indkomst mellem husholdninger: forbrug, boligpriser og BNP rører sig under 0,05 pct., og saldoen er uændret."),
    ShockRun("Eksportmarkedsvaekst", "uXMarked", "Eksportmarkedets størrelse", 1.01, 0.0, "+1 pct.", 2030,
             "DREAMs standardstød normerer ændringen til 1 pct. af BNP i eksport; MAKROskop hæver "
             "eksportmarkedet med 1 pct.",
             channel=("qX>qBNP>nL>ledighedsgrad>vhW>pC", "qX>qM"),
             explainer_da="Et 1 pct. større eksportmarked løfter eksporten ca. 0,7 pct. og BNP knap 0,2 pct. de første år, og ca. 0,5 og 0,1 pct. på langt sigt; beskæftigelsen stiger kun kortvarigt, og lønnen tager en del af gevinsten.",
             explainer_perm_da="Et 1 pct. større eksportmarked løfter eksporten ca. 0,7 pct. og BNP ca. 0,2 pct. de første år, og ca. 0,45 og 0,1 pct. på langt sigt; beskæftigelsen stiger kun kortvarigt, og lønnen tager en del af gevinsten. Finansieringen betyder lidt her: lukkeskatten sænker husholdningernes skat med {lukning} af BNP, og forbruget stiger ca. 0,2–0,3 pct."),
    ShockRun("Befolkning", "nPop", "Befolkning, alle aldersgrupper", 1.01, 0.0, "+1 pct.", 2030,
             "Samme størrelse som DREAMs standardstød, men DREAM skalerer desuden offentligt forbrug og "
             "arbejdsstyrke med; MAKROskop ændrer kun befolkningen.",
             series_key="nPop",
             channel=("nPop>snL>nL>qBNP", "snL>ledighedsgrad>vhW>qX>qBNP", "nPop>qI>qBNP", "nPop>qC", "nL>saldo2bnp"),
             explainer_da="Flere mennesker giver på sigt ca. 1 pct. flere beskæftigede og ca. 1 pct. højere BNP. Det første år springer boliginvesteringerne op (ca. 13 pct.), og ledigheden stiger lidt; lønnen falder i nogle år, så de ekstra hænder finder job, og eksporten vokser. Det offentlige forbrug er holdt uændret, så saldoen forbedres.",
             explainer_perm_da="Flere mennesker giver på sigt ca. 1 pct. flere beskæftigede og godt 1 pct. højere BNP. Det første år springer investeringerne ca. 4 pct. op, og ledigheden stiger lidt; lønnen falder i nogle år (op til ca. 0,3 pct.), så de ekstra hænder finder job, og eksporten vokser. Det offentlige forbrug er holdt uændret, så de flere skatteydere styrker de offentlige finanser, og lukkeskatten giver gevinsten tilbage som lavere skat ({lukning} af BNP om året): forbruget stiger ca. 1,5–1,9 pct."),
    # --- batch 3: the rest of DREAM's standard shocks (Analysis/Standard_shocks/standard_shocks.gms),
    # instruments translated 1:1 where the DREAM instrument is exogenous here; where DREAM swaps
    # endogeneity, the exogenous parameter behind it is moved instead (stated in dream_da).
    ShockRun("Offentlig_varekoeb", "qR(off,*)", "Offentligt varekøb (materialer)", 1.01, 0.0, "+1 pct.", 2030,
             "Samme instrument som DREAMs standardstød; DREAM normerer til 1 pct. af BNP, MAKROskop hæver varekøbet med 1 pct.",
             channel=("qG>qBNP", "saldo2bnp"),
             explainer_da="Mere offentligt varekøb giver et lille, kortvarigt løft i aktiviteten, som hurtigt fortrænges; saldoen svækkes, fordi udgiften ikke er finansieret.",
             explainer_perm_da="Mere offentligt varekøb finansieres med højere skat: lukkeskatten hæver husholdningernes skat med {lukning} af BNP om året. Forbruget falder derfor ca. 0,15–0,2 pct. og boligpriserne lidt, mens BNP er stort set uændret."),
    ShockRun("Offentlig_Beskaeftigelse", "hL(off,*)", "Offentlige arbejdstimer", 1.01, 0.0, "+1 pct.", 2030,
             "Samme instrument som DREAMs standardstød; DREAM normerer til 1 pct. af BNP i lønsum, MAKROskop hæver timerne med 1 pct.",
             channel=("qG>nL>ledighedsgrad>vhW>qX>qBNP", "saldo2bnp"),
             explainer_da="Flere offentlige arbejdstimer løfter beskæftigelsen det første år, men arbejdsudbuddet er uændret, så de nye offentlige job besættes med folk fra den private sektor: lønnen stiger, eksport og investeringer falder, og BNP ender lidt lavere. Udgiften er ufinansieret, så saldoen svækkes.",
             explainer_perm_da="Flere offentlige arbejdstimer finansieres med højere skat: lukkeskatten hæver husholdningernes skat med {lukning} af BNP om året. Beskæftigelsen stiger det første år, men arbejdsudbuddet er uændret, så de nye offentlige job besættes med folk fra den private sektor: eksport og investeringer falder ca. 0,4 pct., og BNP ender godt 0,2 pct. lavere. Den højere skat sænker forbruget ca. 0,3–0,5 pct. og boligpriserne ca. 0,3–0,4 pct."),
    ShockRun("Offentlige_investeringer", "qI_s(!iTot,off,*)", "Offentlige investeringer (maskiner og bygninger)", 1.01, 0.0, "+1 pct.", 2030,
             "Samme instrument som DREAMs standardstød; DREAM normerer til 1 pct. af BNP, MAKROskop hæver investeringerne med 1 pct.",
             channel=("qI>qBNP", "saldo2bnp"),
             explainer_da="Højere offentlige investeringer løfter de samlede investeringer ca. 0,15 pct. og BNP marginalt; saldoen svækkes, fordi udgiften ikke er finansieret.",
             explainer_perm_da="Højere offentlige investeringer løfter de samlede investeringer godt 0,1 pct. De finansieres med højere skat (lukkeskatten, {lukning} af BNP om året), så forbruget falder lidt (under 0,1 pct.); BNP-effekten er marginal."),
    ShockRun("Offentlig_loen", "qProd(off,*)", "Lønbestemmende produktivitet i den offentlige sektor", 1.01, 0.0, "+1 pct.", 2030,
             "Samme stød som DREAMs standardstød: den offentlige produktivitet hæves, og husholdningernes og "
             "grænsegængernes produktivitet hæves med den offentlige andel af de effektive timer, så den "
             "private sektors produktivitet er uændret. DREAM normerer til 1 pct. af BNP, MAKROskop hæver den "
             "offentlige produktivitet med 1 pct.",
             # makroskop-gnp.6 (see freesolver.off_share): qProd(off) alone drained the fixed pool of efficiency
             # units, qProd(spTot) −0,38 pct.; that run is parked in etl/cache/parked/shock_gdx_offloen_uncorrected.
             solver_shock="qProd(off,*),qProdHh_t@off_share,qProdxDK@off_share",
             channel=("qG>qBNP", "qC>qBNP", "pBolig", "saldo2bnp"),
             explainer_da="Offentligt ansatte bliver 1 pct. mere produktive og får 1 pct. mere i løn pr. time, uden "
                          "at det tager produktivitet fra den private sektor. Den offentlige produktion stiger godt "
                          "0,5 pct. og løfter BNP ca. 0,15 pct.; de højere lønindkomster løfter forbruget 0,1-0,2 "
                          "pct. og boligpriserne lidt. Beskæftigelse og privat løn rører sig næsten ikke, og saldoen "
                          "svækkes, fordi lønudgiften ikke er finansieret.",
             explainer_perm_da="Offentligt ansatte bliver 1 pct. mere produktive og får 1 pct. mere i løn pr. time, uden at det tager produktivitet fra den private sektor. Den offentlige produktion stiger godt 0,5 pct. og løfter BNP ca. 0,15 pct. (ca. 0,1 pct. på langt sigt). Lønudgiften finansieres med højere skat (lukkeskatten, {lukning} af BNP om året), som opvejer de højere lønindkomster: forbrug, beskæftigelse og privat løn rører sig næsten ikke."),
    ShockRun("Ikke_skattepligtig_indkomstoverforsel", "uvOvfSats(boernyd|boligyd|iskatpl|groen|lumpsumovf,*)",
             "Satser for ikke-skattepligtige overførsler", 1.01, 0.0, "+1 pct.", 2030,
             "Samme afgrænsning som DREAMs standardstød (de ubeskattede ydelser); DREAM normerer til 1 pct. af BNP.",
             channel=("qC>qBNP", "saldo2bnp"),
             explainer_da="1 pct. højere ubeskattede ydelser er et lille beløb: forbruget stiger marginalt, saldoen svækkes tilsvarende, og beskæftigelsen er upåvirket.",
             explainer_perm_da="1 pct. højere ubeskattede ydelser er et lille beløb, som lukkeskatten henter tilbage fra husholdningerne ({lukning} af BNP): virkningerne på forbrug, BNP og saldo er ubetydelige."),
    ShockRun("Overforsel_privat", "vOffTilHhRest", "Øvrige offentlige overførsler til husholdninger", 1.0, 10.0, "+10 mia. kr. årligt (2020-niveau)", 2030,
             "Samme instrument som DREAMs standardstød (lump sum); DREAM giver 1 pct. af BNP, MAKROskop 10 mia. kr. i 2020-niveau (ca. 13 mia. kr. i 2030), der vokser med økonomien – godt 0,3 pct. af BNP.",
             change_size=10.0, change_unit_da="mia. kr. årligt (2020-niveau)",
             channel=("qC>qBNP", "pBolig", "saldo2bnp"),
             explainer_da="Overførslerne øges med ca. 13 mia. kr. i 2030 (godt 0,3 pct. af BNP), og beløbet vokser med økonomien. Pengene går næsten fuldt ud i privat forbrug (+0,7 pct.) og boligpriser; BNP løftes ca. 0,1 pct., mens saldoen svækkes med det meste af beløbet.",
             explainer_perm_da="Overførslerne øges med ca. 13 mia. kr. i 2030 (godt 0,3 pct. af BNP), og lukkeskatten henter næsten samme beløb tilbage fra husholdningerne. Pengene flyttes altså mellem husholdninger: forbrug og boligpriser stiger under 0,1 pct. de første år og ligger lidt under grundforløbet på langt sigt, BNP rører sig næsten ikke, og saldoen svækkes kun lidt (ca. 0,05 pct. af BNP)."),
    ShockRun("Grundskyld", "tGrund", "Grundskyldspromille, alle brancher", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("pBolig>qI>qBNP", "qC>qBNP", "saldo2bnp"),
             explainer_da="Højere grundskyld gør det dyrere at eje boliger og erhvervsejendomme. Boligpriserne falder ca. 0,35 pct. i starten og knap 0,2 pct. på langt sigt, og investeringerne – især erhvervsbyggeriet – falder lidt. Forbruget falder ca. 0,15 pct., fordi skatten tager af husholdningernes indkomst; saldoen forbedres.",
             explainer_perm_da="Højere grundskyld gør det dyrere at eje boliger og erhvervsejendomme. Boligpriserne falder knap 0,2 pct. i starten og mindre på langt sigt, og investeringerne – især erhvervsinvesteringerne (op til knap 0,3 pct.) – falder lidt. Provenuet ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten, så forbruget er stort set uændret; BNP ender ca. 0,02 pct. lavere."),
    ShockRun("Vaegtafgift", "utHhVaegt", "Vægtafgift, implicit sats", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("qC>qBNP", "saldo2bnp"),
             explainer_da="Højere vægtafgift sænker forbruget marginalt (ca. −0,05 pct.); BNP-effekten er ubetydelig, og saldoen forbedres lidt.",
             explainer_perm_da="Provenuet fra den højere vægtafgift ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten, så forbrug og BNP er praktisk talt uændrede."),
    ShockRun("Aktieskat", "tAktieTop", "Aktieindkomstskat, topsats", 1.0, 0.01, "+1 pct.-point", 2030,
             "DREAM ændrer både top- og lavsatsen normeret til 1 pct. af BNP; i denne konfiguration er kun topsatsen en variabel.",
             channel=("qC>qBNP", "pBolig", "saldo2bnp"),
             explainer_da="En højere topsats på aktieindkomst giver et lavere afkast efter skat og gør det mindre attraktivt at spare op. De første år bruger husholdningerne derfor lidt mere, men formuen vokser langsommere, så forbruget og boligpriserne gradvist kommer under grundforløbet – knap 0,2 pct. lavere i 2100. BNP påvirkes meget lidt, og saldoen forbedres kun marginalt (ca. 0,04 pct. af BNP).",
             explainer_perm_da="En højere topsats på aktieindkomst giver et lavere afkast efter skat og gør det mindre attraktivt at spare op. De første år bruger husholdningerne derfor lidt mere (forbruget op til ca. 0,1 pct.), men formuen vokser langsommere, så forbruget og boligpriserne gradvist kommer under grundforløbet – ca. 0,1 pct. lavere i 2100. Provenuet er lille ({lukning} af BNP) og gives tilbage via lukkeskatten; BNP påvirkes meget lidt."),
    ShockRun("Moms_ned", "tMoms_y,tMoms_m", "Momssatser (indenlandsk og importeret)", 0.98, 0.0, "−2 pct. af satsen", 2030,
             _VAT_PROPORTIONAL + " Nedsættelsen er løst som sit eget scenarie i stedet for at spejle forhøjelsen.",
             channel=("pC>qC>qBNP", "pBolig", "saldo2bnp"),
             explainer_da="Lavere moms sænker forbrugerpriserne ca. 0,2 pct. og hæver realindkomsten: forbruget stiger ca. "
                          "0,3 pct. og boligpriserne lidt, men BNP kun ca. 0,05 pct., og beskæftigelsen er stort set uændret. "
                          "Saldoen svækkes med ca. 0,1 pct. af BNP – mere over tid, fordi nedsættelsen er ufinansieret.",
             explainer_perm_da="Lavere moms sænker forbrugerpriserne ca. 0,25 pct., men nedsættelsen finansieres med højere skat: lukkeskatten hæver husholdningernes skat med {lukning} af BNP om året. Det spiser gevinsten: forbruget er stort set uændret (under 0,05 pct.), boligpriserne falder ca. 0,2 pct., og BNP og beskæftigelse rører sig næsten ikke."),
    ShockRun("Moms", "tMoms_y,tMoms_m", "Momssatser (indenlandsk og importeret)", 1.02, 0.0, "+2 pct. af satsen", 2030,
             _VAT_PROPORTIONAL,
             channel=("pC>qC>qBNP", "pBolig", "saldo2bnp"),
             explainer_da="Højere moms hæver forbrugerpriserne ca. 0,2 pct. og sænker realindkomsten: forbruget falder ca. "
                          "0,3 pct. og boligpriserne lidt, men BNP kun ca. 0,05 pct. Saldoen forbedres med ca. 0,1 pct. af "
                          "BNP i starten og mere over tid.",
             explainer_perm_da="Højere moms hæver forbrugerpriserne ca. 0,25 pct., men provenuet ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten. Forbruget er derfor stort set uændret (under 0,05 pct.), boligpriserne stiger ca. 0,2 pct., og BNP og beskæftigelse rører sig næsten ikke."),
    ShockRun("Registreringsafgift", "tReg_y,tReg_m", "Registreringsafgift, implicitte satser", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("qC>qBNP", "qI>qBNP", "saldo2bnp"),
             explainer_da="Højere registreringsafgift rammer bilkøbet: forbrug og investeringer falder marginalt, og saldoen forbedres lidt.",
             explainer_perm_da="Højere registreringsafgift rammer bilkøbet: investeringerne falder marginalt (ca. 0,04 pct.). Provenuet er lille ({lukning} af BNP) og gives tilbage via lukkeskatten, så forbruget er praktisk talt uændret."),
    ShockRun("Energiafgift", "tAfg_y(cEne,*,*),tAfg_m(cEne,*,*)", "Energiafgifter på privat forbrug", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("pC>qC>qBNP", "saldo2bnp"),
             explainer_da="Højere energiafgifter hæver forbrugerpriserne ca. 0,2 pct. og sænker forbruget tilsvarende; BNP-effekten er lille, saldoen forbedres.",
             explainer_perm_da="Højere energiafgifter hæver forbrugerpriserne ca. 0,2 pct. Provenuet ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten, så forbruget kun falder ca. 0,03 pct.; BNP-effekten er ubetydelig."),
    ShockRun("Forbrugsafgift", "tAfg_y(cVar,*,*),tAfg_m(cVar,*,*)", "Øvrige afgifter på privat vareforbrug", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("pC>qC>qBNP", "saldo2bnp"),
             explainer_da="Højere vareafgifter hæver forbrugerpriserne ca. 0,15 pct. og sænker forbruget tilsvarende; BNP-effekten er lille, saldoen forbedres.",
             explainer_perm_da="Højere vareafgifter hæver forbrugerpriserne ca. 0,15–0,2 pct. Provenuet ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten, så forbruget kun falder ca. 0,02 pct.; BNP-effekten er ubetydelig."),
    ShockRun("Afgift_erhverv", "tAfg_y(bol|byg|ene|fre|lan|off|soe|tje|udv,!off,*),tAfg_m(bol|byg|ene|fre|lan|off|soe|tje|udv,!off,*)",
             "Afgifter på private erhvervs materialeinput", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("qI>qBNP", "vhW>qC>qBNP", "saldo2bnp"),
             explainer_da="Dyrere materialeinput hæver virksomhedernes omkostninger og presser lønnen ned (godt 0,1 pct.). Det trækker forbruget godt 0,1 pct. ned på langt sigt, mens BNP kun falder ca. 0,04 pct. Provenuet forbedrer saldoen.",
             explainer_perm_da="Dyrere materialeinput hæver virksomhedernes omkostninger og presser lønnen ned (ca. 0,1 pct. på langt sigt), og eksporten falder godt 0,1 pct. Provenuet ({lukning} af BNP) gives tilbage til husholdningerne via lukkeskatten, så forbruget ender lidt højere (under 0,1 pct.); BNP rører sig næsten ikke."),
    ShockRun("Produktsubsidier", "rSub_y,rSub_m", "Produktsubsidiesatser", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("vhW>qC>qBNP", "pC>qC", "saldo2bnp"),
             explainer_da="Højere produktsubsidier sænker priserne marginalt; virkningerne på BNP og forbrug er under 0,1 pct., og saldoen svækkes.",
             explainer_perm_da="Højere produktsubsidier sænker priserne marginalt og løfter lønnen og eksporten lidt (under 0,1 pct.). Udgiften ({lukning} af BNP) betales af husholdningerne via lukkeskatten, så forbruget falder lidt (ca. 0,03 pct.); BNP er praktisk talt uændret."),
    ShockRun("Lontilskud", "rSubLoen(!tot,*)", "Løntilskudssatser", 1.10, 0.0, "+10 pct. af satsen", 2030, _DREAM_GDP_NORM,
             channel=("qC>qBNP", "saldo2bnp"),
             explainer_da="Højere løntilskudssatser er et lille beløb i MAKRO: virkningerne på forbrug, BNP og saldo er under 0,05 pct.",
             explainer_perm_da="Højere løntilskudssatser er et lille beløb i MAKRO, og lukkeskatten henter det tilbage ({lukning} af BNP): virkningerne på forbrug, BNP og saldo er ubetydelige."),
    ShockRun("Produktionssubsidier", "rSubYRest(!tot,*)", "Øvrige produktionssubsidier, sats", 1.10, 0.0, "+10 pct. af satsen", 2030,
             "DREAM hæver subsidiebeløbet (1 pct. af BNP) og endogeniserer satsen; MAKROskop hæver satsen direkte.",
             channel=("qI>qBNP", "vhW>qC>qBNP", "saldo2bnp"),
             explainer_da="Højere produktionssubsidier sænker virksomhedernes omkostninger: lønnen stiger ca. 0,2 pct., investeringer og forbrug stiger lidt (0,1–0,2 pct.), mens saldoen svækkes.",
             explainer_perm_da="Højere produktionssubsidier sænker virksomhedernes omkostninger: lønnen stiger ca. 0,2 pct., og investeringer og eksport stiger ca. 0,1 pct. Udgiften ({lukning} af BNP) betales af husholdningerne via lukkeskatten, så forbruget falder lidt (op til ca. 0,1 pct. de første år); BNP rører sig næsten ikke."),
    ShockRun("Arbejdsudbud_beskaeftigelse", "snLHh (uDeltag endogen)", "Strukturel beskæftigelse, alle aldre 15-100",
             1.01, 0.0, "+1 pct.", 2030,
             "Samme lukning som DREAMs standardstød: den strukturelle beskæftigelse hæves 1 pct. for hver alder, "
             "og husholdningernes deltagelsesparameter uDeltag frigives alder for alder, så den rammer målet. "
             "(uDeltag er en ulempeparameter — at hæve den direkte sænker deltagelsen.)",
             solver_shock="snLHh", endogenize="uDeltag",
             channel=("snL>ledighedsgrad>vhW>nL>qBNP", "vhW>qX>qBNP", "nL>qC>qBNP", "nL>saldo2bnp"),
             explainer_da="Når 1 pct. flere står til rådighed for arbejdsmarkedet, finder de gradvist job: beskæftigelsen er 1 pct. højere efter få år, og BNP vokser med omkring 1 pct. på langt sigt, efterhånden som virksomhedernes kapitalapparat følger med. Lønnen falder knap 1 pct. de første år og ender ca. 0,2 pct. lavere, og de offentlige finanser forbedres, fordi flere betaler skat.",
             explainer_perm_da="Når 1 pct. flere står til rådighed for arbejdsmarkedet, finder de gradvist job: beskæftigelsen er 1 pct. højere efter få år, og BNP vokser med godt 1 pct. på langt sigt, efterhånden som virksomhedernes kapitalapparat følger med. Lønnen falder knap 0,5 pct. de første år og er tilbage ved grundforløbet på langt sigt. Flere skatteydere styrker de offentlige finanser, og lukkeskatten giver gevinsten tilbage som lavere skat ({lukning} af BNP om året), så forbruget stiger knap 1 pct. det første år og ca. 1,8 pct. på langt sigt."),
    ShockRun("Arbejdsudbud_timer", "uh", "Timepræferenceparameter (strukturel arbejdstid = 1/uh)",
             1 / 1.01, 0.0, "+1 pct. strukturel arbejdstid", 2030,
             "Samme virkning som DREAMs standardstød: DREAM hæver den strukturelle arbejdstid shLHh 1 pct. og "
             "endogeniserer uh; i modellen er shLHh = 1/uh eksakt, så MAKROskop sætter uh til 1/1,01 gange "
             "grundforløbets værdi, hvilket giver præcis +1 pct. arbejdstid for alle aldre.",
             change_size=1.0, change_unit_da="pct. strukturel arbejdstid",
             channel=("qBNP>saldo2bnp", "vhW>qX>qBNP"),
             explainer_da="1 pct. længere arbejdstid pr. beskæftiget giver næsten samme BNP-løft som 1 pct. flere beskæftigede — omkring 1 pct. på langt sigt. Antallet af beskæftigede ender uændret, men den offentlige sektor, hvis timetal ligger fast, klarer sig med ca. 1 pct. færre ansatte, som går til private job. Timelønnen falder op mod 1 pct. de første år og ender ca. 0,2 pct. lavere, og den offentlige saldo forbedres.",
             explainer_perm_da="1 pct. længere arbejdstid pr. beskæftiget giver næsten samme BNP-løft som 1 pct. flere beskæftigede — godt 1 pct. på langt sigt. Antallet af beskæftigede ender uændret, men den offentlige sektor, hvis timetal ligger fast, klarer sig med ca. 1 pct. færre ansatte, som går til private job. Timelønnen falder op mod 0,5 pct. de første år og er tilbage ved grundforløbet på langt sigt. De offentlige finanser styrkes, og lukkeskatten giver gevinsten tilbage som lavere skat ({lukning} af BNP om året), så forbruget stiger knap 1 pct. det første år og ca. 1,8 pct. på langt sigt."),
    ShockRun("ArbejdsProd", "qProdHh_t,qProdxDK", "Arbejdskraftproduktivitet (trend)", 1.01, 0.0, "+1 pct.", 2030,
             "Samme instrumenter og størrelse som DREAMs standardstød.",
             channel=("qBNP>saldo2bnp", "vhW>qC>qBNP", "qX>qBNP"),
             explainer_da="Højere produktivitet løfter BNP gradvist mod +1 pct.; reallønnen følger med, og eksporten vinder markedsandele. Beskæftigelsen falder kortvarigt lidt, men er uændret på sigt, fordi arbejdsudbuddet er strukturelt bestemt.",
             explainer_perm_da="Højere produktivitet løfter BNP gradvist til godt 1 pct.; lønnen følger med (ca. 1,4 pct. på langt sigt), og eksporten vinder markedsandele. De offentlige finanser styrkes, og lukkeskatten giver gevinsten tilbage som lavere skat ({lukning} af BNP om året), så forbruget stiger ca. 0,8 pct. det første år og 1,7 pct. på langt sigt. Beskæftigelsen falder kortvarigt lidt, men er uændret på sigt, fordi arbejdsudbuddet er strukturelt bestemt."),
    ShockRun("VirkDisk", "rVirkDiskPrem(!spTot,*)", "Virksomhedernes risikopræmie (hurdle rate)", 1.0, 0.001, "+0,1 pct.-point", 2030,
             "Samme instrument og størrelse som DREAMs standardstød.",
             channel=("qI>qBNP", "vhW>qC>qBNP"),
             explainer_da="Et højere afkastkrav i virksomhederne sænker investeringerne ca. 0,25 pct. og dermed kapitalapparatet; BNP ender ca. 0,1 pct. lavere. Med mindre kapital pr. medarbejder falder lønnen ca. 0,2 pct., og forbruget ender godt 0,15 pct. lavere.",
             explainer_perm_da="Et højere afkastkrav i virksomhederne sænker investeringerne ca. 0,25 pct. og dermed kapitalapparatet; BNP ender ca. 0,1 pct. lavere. Med mindre kapital pr. medarbejder falder lønnen ca. 0,2 pct., og forbruget ender ca. 0,15 pct. lavere. Finansieringen betyder næsten intet her – lukkeskatten ændres med {lukning} af BNP."),
    ShockRun("BoligRisiko", "rBoligPrem", "Risikopræmie i boligernes usercost", 1.0, 0.001, "+0,1 pct.-point", 2030,
             "Samme instrument og størrelse som DREAMs standardstød.",
             channel=("pBolig>qC>qBNP", "pBolig>qI"),
             explainer_da="En højere risikopræmie hæver boligernes usercost: boligpriserne falder ca. 0,5 pct. de første år (ca. 0,2 pct. på langt sigt), forbrug og boliginvesteringer lidt; BNP-effekten er lille.",
             explainer_perm_da="En højere risikopræmie hæver boligernes usercost: boligpriserne falder ca. 0,5 pct. de første år (ca. 0,2 pct. på langt sigt), forbrug og boliginvesteringer lidt; BNP-effekten er lille. Finansieringen betyder næsten intet her – lukkeskatten ændres med {lukning} af BNP."),
    ShockRun("AktieAfkast", "rVirkDiskPrem(!spTot,*),rAktieDriftPrem", "Risikopræmie på virksomheder og aktieafkast", 1.0, 0.001, "+0,1 pct.-point", 2030,
             "Samme instrumenter og størrelse som DREAMs standardstød.",
             channel=("qI>qBNP",),
             explainer_da="Et højere afkastkrav gør investeringer dyrere: investeringerne falder ca. 0,2 pct. og BNP knap 0,1 pct. på langt sigt.",
             explainer_perm_da="Et højere afkastkrav gør investeringer dyrere: investeringerne falder ca. 0,2 pct. og BNP knap 0,1 pct. på langt sigt. Finansieringen betyder næsten intet her – lukkeskatten ændres med {lukning} af BNP."),
    ShockRun("RisikoPraemier", "rVirkDiskPrem(!spTot,*),rAktieDriftPrem,rBoligPrem", "Alle tre risikopræmier", 1.0, 0.001, "+0,1 pct.-point", 2030,
             "Samme instrumenter og størrelse som DREAMs standardstød.",
             channel=("qI>qBNP", "pBolig>qC>qBNP", "pBolig>qI"),
             explainer_da="Højere risikopræmier på både virksomheder og boliger gør investeringer og boliger dyrere: de første år falder investeringerne ca. 0,4 pct. og boligpriserne ca. 0,5 pct.; på langt sigt er faldet mindre. BNP ligger ca. 0,1 pct. lavere.",
             explainer_perm_da="Højere risikopræmier på både virksomheder og boliger gør investeringer og boliger dyrere: de første år falder investeringerne ca. 0,4 pct. og boligpriserne ca. 0,5 pct.; på langt sigt er faldet mindre. BNP ligger ca. 0,1 pct. lavere. Finansieringen betyder næsten intet her – lukkeskatten ændres med {lukning} af BNP."),
    # fDisk = (1 + jfDisk_t) / (1 + rDisk) with jfDisk_t = 0 in the reference, so the −0,001 j-term lowers
    # the discount factor by exactly 0,1 pct.: a factor change, not a rate in pct.-points.
    ShockRun("Diskontering", "jfDisk_t", "Husholdningernes diskonteringsfaktor (justering)", 1.0, -0.001,
             "−0,1 pct. (jfDisk_t −0,001)", 2030,
             "Samme instrument og størrelse som DREAMs standardstød.",
             change_size=-0.1, change_unit_da="pct.", short_da="Husholdningernes diskonteringsfaktor",
             channel=("qC>qBNP", "pBolig>qC", "pBolig>qI"),
             explainer_da="Mere utålmodige husholdninger sparer mindre op: forbrug og boligpriser stiger på kort sigt, men effekten aftager og vender på langt sigt, når formuen er blevet mindre.",
             explainer_perm_da="Mere utålmodige husholdninger sparer mindre op: forbrug og boligpriser stiger på kort sigt, men effekten aftager og vender på langt sigt, når formuen er blevet mindre. Finansieringen betyder næsten intet her – lukkeskatten ændres med {lukning} af BNP."),
    ShockRun("Loen", "rLoenNash", "Arbejdsgivernes forhandlingsvægt i lønforhandlingen (Nash)", 1.0, -0.01,
             "−1 pct.-point (lønmodtagerne står stærkere)", 2030,
             "Samme instrument og størrelse som DREAMs standardstød. rLoenNash er arbejdsgivernes vægt i "
             "Nash-forhandlingen, så et fald betyder stærkere lønmodtagere.",
             short_da="Arbejdsgivernes forhandlingsvægt",
             channel=("vhW>nL", "vhW>qC>qBNP", "nL>saldo2bnp"),
             explainer_da="Når lønmodtagerne står stærkere i lønforhandlingen, stiger timelønnen (ca. +0,7 pct.), og virksomhederne slår færre stillinger op, så beskæftigelsen falder lidt (ca. −0,15 pct.). Den højere løn løfter forbruget (knap 0,5 pct. på langt sigt). BNP stiger alligevel svagt (ca. 0,2 pct.), fordi færre jobopslag frigør arbejdstid fra rekruttering til produktion. Saldoen svækkes lidt.",
             explainer_perm_da="Når lønmodtagerne står stærkere i lønforhandlingen, stiger timelønnen (ca. +0,7 pct.), og virksomhederne slår færre stillinger op, så beskæftigelsen falder lidt (ca. −0,15 pct.). BNP stiger alligevel svagt (ca. 0,2 pct.), fordi færre jobopslag frigør arbejdstid fra rekruttering til produktion. De offentlige finanser svækkes lidt, og lukkeskatten hæver husholdningernes skat med {lukning} af BNP om året, så forbruget først stiger efter et par år og ender ca. 0,35 pct. højere på langt sigt."),
]

_UNFINANCED = (
    "Ufinansieret: ingen skattesats reagerer. Virkningen på de offentlige finanser akkumulerer "
    "derfor over tid og er ikke et holdbart forløb."
)
_UNFINANCED_TEMP = (
    "Ufinansieret: ingen skattesats reagerer. (DREAM løser de midlertidige varianter med "
    "lukkeskat-reaktionen; MAKROskop løser dem indtil videre ufinansieret.)"
)

# Profiles follow Analysis/Standard_shocks/standard_shocks.gms: dt = år siden stødåret.
VARIATION_DEFINITIONS: dict[str, dict[str, str]] = {
    "_blip": {"profile_da": "Ét år: stødet gælder kun i stødåret (DREAMs blip_profile).",
              "closure_da": _UNFINANCED_TEMP},
    "_midl": {"profile_da": "Midlertidigt: fuldt stød i stødåret, derefter 0,9 pr. år "
                            "(100, 90, 81, 73 pct. … — DREAMs AR_profile, Finansministeriets "
                            "multiplikator-standard).",
              "closure_da": _UNFINANCED_TEMP},
    "_perm": {"profile_da": "Permanent: stødet gælder alle år fra stødåret og horisonten ud.",
              "closure_da": "Finansieret: den beregningstekniske lukkeskat – et tillæg til husholdningernes "
                            "direkte skatter, ens i alle år – justeres, så den offentlige nettoformue i "
                            "2129 udgør samme andel af BNP som i grundforløbet (DREAMs lukkeskat-reaktion). "
                            "Saldoen holdes altså ikke år for år."},
    "_ufin": {"profile_da": "Permanent: stødet gælder alle år fra stødåret og horisonten ud.",
              "closure_da": _UNFINANCED},
}

# solve-export --shock-profile value that produces each variation.
VARIATION_PROFILES: dict[str, str] = {"_blip": "blip", "_midl": "ar", "_perm": "permanent", "_ufin": "permanent"}
# solve-export --closure value that produces each variation (see VARIATION_DEFINITIONS).
VARIATION_CLOSURES: dict[str, str] = {"_blip": "none", "_midl": "none", "_perm": "tax-reaction", "_ufin": "none"}

_STAMP_NUMBERS = ("factor", "delta", "from_year", "share")


def expected_stamp(shock_name: str, suffix: str, last_year: int) -> dict | None:
    """The `makroskop_meta` stamp a full solve of this catalog run should carry, or None if uncatalogued.

    Keys as freesolver writes them; factor, delta, from_year and share are numbers (the stamp's
    text is compared by value). The shock years run from the shock year to the model horizon,
    and the year before stays at the reference (DREAM's shock_year, makroskop-7cd).
    """
    run = next((r for r in SHOCK_RUNS if r.shock == shock_name), None)
    if run is None or suffix not in VARIATION_PROFILES:
        return None
    return {
        "shock": run.solver_shock or run.instrument,
        "shock_years": f"{run.first_year}-{last_year}",
        "factor": run.factor,
        "delta": run.delta,
        "profile": VARIATION_PROFILES[suffix],
        "endogenized": run.endogenize,
        "closure": VARIATION_CLOSURES[suffix],
        "from_year": run.first_year,
        "share": 1.0,
    }


def stamp_mismatches(shock_name: str, suffix: str, stamp: dict[str, str], last_year: int) -> list[str]:
    """One line per field where the solver's stamp disagrees with the catalog (makroskop-gnp.1).

    The page copy (definition.changeDa etc.) is written from the catalog, so a solve at another
    size, closure or shock year must stop the ETL instead of shipping the old wording.
    """
    expected = expected_stamp(shock_name, suffix, last_year)
    if expected is None:
        return [f"{shock_name}{suffix} is not in the catalog"]
    lines = []
    for key, want in expected.items():
        got = stamp.get(key)
        if got is None:
            lines.append(f"{key}: solved (missing), catalog {want}")
            continue
        if key in _STAMP_NUMBERS:
            try:
                same = math.isclose(float(got), float(want), rel_tol=1e-12, abs_tol=1e-15)
            except ValueError:
                same = False
        else:
            same = got == want
        if not same:
            lines.append(f"{key}: solved {got}, catalog {want}")
    return lines


LUKNING_SLOT = "{lukning}"


def lukning_size_da(share_of_gdp: float) -> str:
    """The lukkeskat's size as the explainers word it: "ca. 0,55 pct." (of BNP), 1 decimal from 1 up."""
    size = abs(share_of_gdp)
    if size < 0.005:
        return "under 0,01 pct."
    return "ca. " + f"{size:.{1 if size >= 1 else 2}f}".replace(".", ",") + " pct."


def change_display(run: ShockRun) -> tuple[float, str]:
    """The change as (size, unit) for the pages' wording, which scales the size with the slider.

    A rate delta reads in pct.-points, a factor as a percentage change ("… af satsen" where the
    catalog words it so). A run the rule cannot word sets change_size and change_unit_da.
    """
    if run.change_size is not None and run.change_unit_da is not None:
        return run.change_size, run.change_unit_da
    if run.factor == 1.0 and run.delta != 0.0 and abs(run.delta) < 1:
        return round(run.delta * 100, 10), "pct.-point"
    af_satsen = run.change_da.endswith("af satsen")
    if run.delta == 0.0 and (run.factor > 1.0 or af_satsen):
        unit = "pct. af satsen" if af_satsen else "pct."
        return round((run.factor - 1) * 100, 10), unit
    raise ValueError(f"{run.shock}: set change_size and change_unit_da, the factor/delta rule cannot word it")


def shock_definition(shock_name: str, suffix: str, last_year: int,
                     lukning_share: float | None = None) -> dict | None:
    """Definition block written into a scenario JSON, or None if the run is not catalogued.

    lukning_share: vtLukning / vBNP in pct. in the shock year of a financed solve. It fills the
    {lukning} slot of explainer_perm_da, so the text states the solved size, and ships as
    lukningShare for the page's Finansiering row, which scales it with the slider.
    """
    run = next((r for r in SHOCK_RUNS if r.shock == shock_name), None)
    variation = VARIATION_DEFINITIONS.get(suffix)
    if run is None or variation is None:
        return None
    financed = VARIATION_CLOSURES[suffix] == "tax-reaction"
    explainer = run.explainer_perm_da if financed else run.explainer_da
    if explainer and LUKNING_SLOT in explainer:
        if lukning_share is None:
            raise ValueError(f"{shock_name}{suffix}: the explainer states the lukkeskat, but no solved size was given")
        explainer = explainer.replace(LUKNING_SLOT, lukning_size_da(lukning_share))
    change_size, change_unit_da = change_display(run)
    return {
        "instrument": run.instrument,
        "instrumentDa": run.instrument_da,
        "shortDa": run.short_da,
        "changeDa": run.change_da,
        "changeSize": change_size,
        "changeUnitDa": change_unit_da,
        "factor": run.factor,
        "delta": run.delta,
        "firstYear": run.first_year,
        "lastYear": last_year,
        "profileDa": variation["profile_da"],
        "closureDa": variation["closure_da"],
        "lukningShare": lukning_share if financed else None,
        "dreamDa": run.dream_da,
        "seriesKey": run.series_key,
        "solver": "MAKROskops frie løser (Newton, fuld horisont)",
        "linearityDa": run.linearity_da or "Lineariteten er ikke målt for dette stød endnu.",
        "maxScale": run.max_scale,
        "maxScaleDa": run.max_scale_da,
        "explainerDa": explainer,
        "channel": list(run.channel) or None,
    }


def etl_gdx_symbols() -> set[str]:
    """GDX symbols the ETL reads for shock deviations — the minimum a compact export needs."""
    names = {sdef.gdx_name for sdef in SERIES}
    names |= {template[0] for template in SECTOR_SERIES_TEMPLATES}
    names.add("rHBI")
    return names
