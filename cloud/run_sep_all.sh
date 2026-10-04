#!/bin/bash
# makroskop-ba1.4: every catalogued scenario of the June 2026 release re-solved on MAKRO 2026-September.
# GENERATED from etl/catalog.py SHOCK_RUNS + VARIATION_PROFILES/CLOSURES by the ba1.4 session (2026-10-02),
# so every stamp matches extract.py's check by construction. Order: _ufin, _perm (tax-reaction), _midl, _blip.
# makroskop-ba1.5 (2026-10-04) added KapitalProd, the last of DREAM's 11 shock-paper runs.
# Run detached on the box:   setsid nohup bash cloud/run_sep_all.sh > sep_all.log 2>&1 < /dev/null &
# Sequential and idempotent: existing GDX files are skipped, killed runs resume from their last checkpoint.
set -uo pipefail
cd "$(dirname "$0")/../etl"
export PATH="$HOME/.local/bin:$PATH"
export PYTHONUNBUFFERED=1
echo 1000 > /proc/self/oom_score_adj 2>/dev/null || true

run() {
  local out="$1"; shift
  if [ -f "shock_gdx/$out" ]; then echo "SKIP $out (already exported)"; return; fi
  echo "=============================================================="
  echo "SCENARIO $out  $(date -Is)"
  echo "=============================================================="
  uv run python freesolver.py solve-export "$@" --out "shock_gdx/$out" \
    || echo "FAILED: $out (continuing with the rest)"
}

run AM_bidrag_ufin.gdx --from-year 2030 --shock-name "tAMbidrag" --shock-years 2030-2129 --shock-delta 0.01
run Afgift_erhverv_ufin.gdx --from-year 2030 --shock-name "tAfg_y(bol|byg|ene|fre|lan|off|soe|tje|udv,!off,*),tAfg_m(bol|byg|ene|fre|lan|off|soe|tje|udv,!off,*)" --shock-years 2030-2129 --shock-factor 1.1
run AktieAfkast_ufin.gdx --from-year 2030 --shock-name "rVirkDiskPrem(!spTot,*),rAktieDriftPrem" --shock-years 2030-2129 --shock-delta 0.001
run Aktieskat_ufin.gdx --from-year 2030 --shock-name "tAktieTop" --shock-years 2030-2129 --shock-delta 0.01
run ArbejdsProd_ufin.gdx --from-year 2030 --shock-name "qProdHh_t,qProdxDK" --shock-years 2030-2129 --shock-factor 1.01
run Arbejdsudbud_beskaeftigelse_ufin.gdx --from-year 2030 --shock-name "snLHh" --endogenize uDeltag --shock-years 2030-2129 --shock-factor 1.01
run Arbejdsudbud_timer_ufin.gdx --from-year 2030 --shock-name "uh" --shock-years 2030-2129 --shock-factor 0.9900990099009901
run Befolkning_ufin.gdx --from-year 2030 --shock-name "nPop" --shock-years 2030-2129 --shock-factor 1.01
run Beskaeftigelsesfradrag_ufin.gdx --from-year 2030 --shock-name "tBeskFradrag" --shock-years 2030-2129 --shock-delta 0.01
run BoligRisiko_ufin.gdx --from-year 2030 --shock-name "rBoligPrem" --shock-years 2030-2129 --shock-delta 0.001
run Bundskat_ufin.gdx --from-year 2030 --shock-name "tBund" --shock-years 2030-2129 --shock-delta 0.01
run Diskontering_ufin.gdx --from-year 2030 --shock-name "jfDisk_t" --shock-years 2030-2129 --shock-delta -0.001
run Ejendomsvaerdiskat_ufin.gdx --from-year 2030 --shock-name "tEjd" --shock-years 2030-2129 --shock-factor 1.1
run Eksportkonkurrerende_priser_ufin.gdx --from-year 2030 --shock-name "pXUdl" --shock-years 2030-2129 --shock-factor 1.01
run Eksportmarkedsvaekst_ufin.gdx --from-year 2030 --shock-name "uXMarked" --shock-years 2030-2129 --shock-factor 1.01
run Energiafgift_ufin.gdx --from-year 2030 --shock-name "tAfg_y(cEne,*,*),tAfg_m(cEne,*,*)" --shock-years 2030-2129 --shock-factor 1.1
run Forbrugsafgift_ufin.gdx --from-year 2030 --shock-name "tAfg_y(cVar,*,*),tAfg_m(cVar,*,*)" --shock-years 2030-2129 --shock-factor 1.1
run Grundskyld_ufin.gdx --from-year 2030 --shock-name "tGrund" --shock-years 2030-2129 --shock-factor 1.1
run Ikke_skattepligtig_indkomstoverforsel_ufin.gdx --from-year 2030 --shock-name "uvOvfSats(boernyd|boligyd|iskatpl|groen|lumpsumovf,*)" --shock-years 2030-2129 --shock-factor 1.01
run Importpris_ufin.gdx --from-year 2030 --shock-name "pM" --shock-years 2030-2129 --shock-factor 1.01
run KapitalProd_ufin.gdx --from-year 2030 --shock-name "uK(iM,*,*)^eKEL,uK(iB,*,*)^eKELB" --shock-years 2030-2129 --shock-factor 1.01
run Loen_ufin.gdx --from-year 2030 --shock-name "rLoenNash" --shock-years 2030-2129 --shock-delta -0.01
run Lontilskud_ufin.gdx --from-year 2030 --shock-name "rSubLoen(!tot,*)" --shock-years 2030-2129 --shock-factor 1.1
run Moms_ufin.gdx --from-year 2030 --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 1.02
run Moms_ned_ufin.gdx --from-year 2030 --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 0.98
run Offentlig_Beskaeftigelse_ufin.gdx --from-year 2030 --shock-name "hL(off,*)" --shock-years 2030-2129 --shock-factor 1.01
run Offentlig_loen_ufin.gdx --from-year 2030 --shock-name "qProd(off,*),qProdHh_t@off_share,qProdxDK@off_share" --shock-years 2030-2129 --shock-factor 1.01
run Offentlig_varekoeb_ufin.gdx --from-year 2030 --shock-name "qR(off,*)" --shock-years 2030-2129 --shock-factor 1.01
run Offentlige_investeringer_ufin.gdx --from-year 2030 --shock-name "qI_s(!iTot,off,*)" --shock-years 2030-2129 --shock-factor 1.01
run Offentligt_forbrug_ufin.gdx --from-year 2030 --shock-name "qR(off,*),qE(off,*),hL(off,*),qI_s(!iTot,off,*)" --shock-years 2030-2129 --shock-factor 1.01
run Overforsel_privat_ufin.gdx --from-year 2030 --shock-name "vOffTilHhRest" --shock-years 2030-2129 --shock-delta 10.0
run Produktionssubsidier_ufin.gdx --from-year 2030 --shock-name "rSubYRest(!tot,*)" --shock-years 2030-2129 --shock-factor 1.1
run Produktsubsidier_ufin.gdx --from-year 2030 --shock-name "rSub_y,rSub_m" --shock-years 2030-2129 --shock-factor 1.1
run Registreringsafgift_ufin.gdx --from-year 2030 --shock-name "tReg_y,tReg_m" --shock-years 2030-2129 --shock-factor 1.1
run Rente_ufin.gdx --from-year 2030 --shock-name "rRenteECB" --shock-years 2030-2129 --shock-delta 0.01
run RisikoPraemier_ufin.gdx --from-year 2030 --shock-name "rVirkDiskPrem(!spTot,*),rAktieDriftPrem,rBoligPrem" --shock-years 2030-2129 --shock-delta 0.001
run Selskabsskat_ufin.gdx --from-year 2030 --shock-name "tSelskab" --shock-years 2030-2129 --shock-delta 0.01
run Skattepligtig_indkomstoverforsel_ufin.gdx --from-year 2030 --shock-name "uvOvfSats(!boernyd|boligyd|iskatpl|groen|lumpsumovf,*)" --shock-years 2030-2129 --shock-factor 1.01
run Topskat_ufin.gdx --from-year 2030 --shock-name "tTop" --shock-years 2030-2129 --shock-delta 0.01
run Udenlandske_priser_ufin.gdx --from-year 2030 --shock-name "pM,pXUdl" --shock-years 2030-2129 --shock-factor 1.01
run Vaegtafgift_ufin.gdx --from-year 2030 --shock-name "utHhVaegt" --shock-years 2030-2129 --shock-factor 1.1
run VirkDisk_ufin.gdx --from-year 2030 --shock-name "rVirkDiskPrem(!spTot,*)" --shock-years 2030-2129 --shock-delta 0.001
run AM_bidrag_perm.gdx --from-year 2030 --shock-name "tAMbidrag" --shock-years 2030-2129 --shock-delta 0.01 --closure tax-reaction
run Afgift_erhverv_perm.gdx --from-year 2030 --shock-name "tAfg_y(bol|byg|ene|fre|lan|off|soe|tje|udv,!off,*),tAfg_m(bol|byg|ene|fre|lan|off|soe|tje|udv,!off,*)" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run AktieAfkast_perm.gdx --from-year 2030 --shock-name "rVirkDiskPrem(!spTot,*),rAktieDriftPrem" --shock-years 2030-2129 --shock-delta 0.001 --closure tax-reaction
run Aktieskat_perm.gdx --from-year 2030 --shock-name "tAktieTop" --shock-years 2030-2129 --shock-delta 0.01 --closure tax-reaction
run ArbejdsProd_perm.gdx --from-year 2030 --shock-name "qProdHh_t,qProdxDK" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Arbejdsudbud_beskaeftigelse_perm.gdx --from-year 2030 --shock-name "snLHh" --endogenize uDeltag --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Arbejdsudbud_timer_perm.gdx --from-year 2030 --shock-name "uh" --shock-years 2030-2129 --shock-factor 0.9900990099009901 --closure tax-reaction
run Befolkning_perm.gdx --from-year 2030 --shock-name "nPop" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Beskaeftigelsesfradrag_perm.gdx --from-year 2030 --shock-name "tBeskFradrag" --shock-years 2030-2129 --shock-delta 0.01 --closure tax-reaction
run BoligRisiko_perm.gdx --from-year 2030 --shock-name "rBoligPrem" --shock-years 2030-2129 --shock-delta 0.001 --closure tax-reaction
run Bundskat_perm.gdx --from-year 2030 --shock-name "tBund" --shock-years 2030-2129 --shock-delta 0.01 --closure tax-reaction
run Diskontering_perm.gdx --from-year 2030 --shock-name "jfDisk_t" --shock-years 2030-2129 --shock-delta -0.001 --closure tax-reaction
run Ejendomsvaerdiskat_perm.gdx --from-year 2030 --shock-name "tEjd" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Eksportkonkurrerende_priser_perm.gdx --from-year 2030 --shock-name "pXUdl" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Eksportmarkedsvaekst_perm.gdx --from-year 2030 --shock-name "uXMarked" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Energiafgift_perm.gdx --from-year 2030 --shock-name "tAfg_y(cEne,*,*),tAfg_m(cEne,*,*)" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Forbrugsafgift_perm.gdx --from-year 2030 --shock-name "tAfg_y(cVar,*,*),tAfg_m(cVar,*,*)" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Grundskyld_perm.gdx --from-year 2030 --shock-name "tGrund" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Ikke_skattepligtig_indkomstoverforsel_perm.gdx --from-year 2030 --shock-name "uvOvfSats(boernyd|boligyd|iskatpl|groen|lumpsumovf,*)" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Importpris_perm.gdx --from-year 2030 --shock-name "pM" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run KapitalProd_perm.gdx --from-year 2030 --shock-name "uK(iM,*,*)^eKEL,uK(iB,*,*)^eKELB" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Loen_perm.gdx --from-year 2030 --shock-name "rLoenNash" --shock-years 2030-2129 --shock-delta -0.01 --closure tax-reaction
run Lontilskud_perm.gdx --from-year 2030 --shock-name "rSubLoen(!tot,*)" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Moms_perm.gdx --from-year 2030 --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 1.02 --closure tax-reaction
run Moms_ned_perm.gdx --from-year 2030 --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 0.98 --closure tax-reaction
run Offentlig_Beskaeftigelse_perm.gdx --from-year 2030 --shock-name "hL(off,*)" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Offentlig_loen_perm.gdx --from-year 2030 --shock-name "qProd(off,*),qProdHh_t@off_share,qProdxDK@off_share" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Offentlig_varekoeb_perm.gdx --from-year 2030 --shock-name "qR(off,*)" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Offentlige_investeringer_perm.gdx --from-year 2030 --shock-name "qI_s(!iTot,off,*)" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Offentligt_forbrug_perm.gdx --from-year 2030 --shock-name "qR(off,*),qE(off,*),hL(off,*),qI_s(!iTot,off,*)" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Overforsel_privat_perm.gdx --from-year 2030 --shock-name "vOffTilHhRest" --shock-years 2030-2129 --shock-delta 10.0 --closure tax-reaction
run Produktionssubsidier_perm.gdx --from-year 2030 --shock-name "rSubYRest(!tot,*)" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Produktsubsidier_perm.gdx --from-year 2030 --shock-name "rSub_y,rSub_m" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Registreringsafgift_perm.gdx --from-year 2030 --shock-name "tReg_y,tReg_m" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run Rente_perm.gdx --from-year 2030 --shock-name "rRenteECB" --shock-years 2030-2129 --shock-delta 0.01 --closure tax-reaction
run RisikoPraemier_perm.gdx --from-year 2030 --shock-name "rVirkDiskPrem(!spTot,*),rAktieDriftPrem,rBoligPrem" --shock-years 2030-2129 --shock-delta 0.001 --closure tax-reaction
run Selskabsskat_perm.gdx --from-year 2030 --shock-name "tSelskab" --shock-years 2030-2129 --shock-delta 0.01 --closure tax-reaction
run Skattepligtig_indkomstoverforsel_perm.gdx --from-year 2030 --shock-name "uvOvfSats(!boernyd|boligyd|iskatpl|groen|lumpsumovf,*)" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Topskat_perm.gdx --from-year 2030 --shock-name "tTop" --shock-years 2030-2129 --shock-delta 0.01 --closure tax-reaction
run Udenlandske_priser_perm.gdx --from-year 2030 --shock-name "pM,pXUdl" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
run Vaegtafgift_perm.gdx --from-year 2030 --shock-name "utHhVaegt" --shock-years 2030-2129 --shock-factor 1.1 --closure tax-reaction
run VirkDisk_perm.gdx --from-year 2030 --shock-name "rVirkDiskPrem(!spTot,*)" --shock-years 2030-2129 --shock-delta 0.001 --closure tax-reaction

echo "=== $(date -Is) SEP ALL DONE: $(ls shock_gdx/*.gdx 2>/dev/null | wc -l) GDX files ==="
