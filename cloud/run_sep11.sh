#!/bin/bash
# makroskop-ba1.2: the ten of DREAM's eleven shock-reaction-paper scenarios (_ufin, permanent,
# unfinanced, shock year 2030) that the catalog already defines, solved on MAKRO 2026-September.
# KapitalProd (the eleventh) needs the per-sector factor map of makroskop-ba1.5 first.
# Same instruments and sizes as run_batch2/3/4.sh. Run detached on the box:
#   setsid nohup bash cloud/run_sep11.sh > sep11.log 2>&1 < /dev/null &
# Sequential (one full-horizon factorization at a time on the shared box), idempotent: a scenario
# whose GDX exists is skipped, a killed one resumes from its last converged continuation stage.
set -uo pipefail
cd "$(dirname "$0")/../etl"
export PATH="$HOME/.local/bin:$PATH"
export PYTHONUNBUFFERED=1
# Keep pardiso first in the backend chain (no FREESOLVER_BACKEND/OPENBLAS/OMP overrides, see CLAUDE.md).
echo 1000 > /proc/self/oom_score_adj 2>/dev/null || true

run() {
  local out="$1"; shift
  if [ -f "shock_gdx/$out" ]; then echo "SKIP $out (already exported)"; return; fi
  echo "=============================================================="
  echo "SCENARIO $out  $(date -Is)"
  echo "=============================================================="
  uv run python freesolver.py solve-export --from-year 2030 "$@" --out "shock_gdx/$out" \
    || echo "FAILED: $out (continuing with the rest)"
}

run Rente_ufin.gdx                        --shock-name rRenteECB            --shock-years 2030-2129 --shock-delta 0.01
run Eksportmarkedsvaekst_ufin.gdx         --shock-name uXMarked             --shock-years 2030-2129 --shock-factor 1.01
run Offentlig_varekoeb_ufin.gdx           --shock-name "qR(off,*)"          --shock-years 2030-2129 --shock-factor 1.01
run Offentlig_Beskaeftigelse_ufin.gdx     --shock-name "hL(off,*)"          --shock-years 2030-2129 --shock-factor 1.01
run Offentlige_investeringer_ufin.gdx     --shock-name "qI_s(!iTot,off,*)"  --shock-years 2030-2129 --shock-factor 1.01
run Overforsel_privat_ufin.gdx            --shock-name vOffTilHhRest        --shock-years 2030-2129 --shock-delta 10.0
run Importpris_ufin.gdx                   --shock-name pM                   --shock-years 2030-2129 --shock-factor 1.01
run Udenlandske_priser_ufin.gdx           --shock-name "pM,pXUdl"           --shock-years 2030-2129 --shock-factor 1.01
run Arbejdsudbud_beskaeftigelse_ufin.gdx  --shock-name snLHh --endogenize uDeltag --shock-years 2030-2129 --shock-factor 1.01
run ArbejdsProd_ufin.gdx                  --shock-name "qProdHh_t,qProdxDK" --shock-years 2030-2129 --shock-factor 1.01

echo "=== $(date -Is) SEP11 DONE: $(ls shock_gdx/*.gdx 2>/dev/null | wc -l) GDX files ==="
