#!/bin/bash
# Proportional VAT re-solve (makroskop-gnp.2). tMoms_y/tMoms_m are effective per-cell rates, about
# zero for exports and deductible business inputs; the published runs added a flat ±0.005 to every
# cell (90 of 163 cells negative in Moms_ned). DREAM scales the rates proportionally, as here:
# ×0.98 = the statutory 25 pct. to 24,5; ×1.02 = 25 to 25,5. Written to etl/shock_gdx_moms_prop/
# (NOT scanned by extract.py) until verified, then copied over the published files.
#   setsid nohup bash cloud/run_moms_prop.sh > moms_prop.log 2>&1 < /dev/null &
# Sequential (one factorization at a time), idempotent, resumable from checkpoints.
set -uo pipefail
cd "$(dirname "$0")/../etl"
export PATH="$HOME/.local/bin:$PATH"
export PYTHONUNBUFFERED=1
echo 1000 > /proc/self/oom_score_adj 2>/dev/null || true
mkdir -p shock_gdx_moms_prop

run() {
  local out="$1"; shift
  if [ -f "$out" ]; then echo "SKIP $out (already exported)"; return; fi
  echo "=============================================================="
  echo "SCENARIO $out"
  echo "=============================================================="
  uv run python freesolver.py solve-export --from-year 2030 "$@" --out "$out" \
    || echo "FAILED: $out (continuing with the rest)"
}

run shock_gdx_moms_prop/Moms_ned_ufin.gdx --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 0.98
run shock_gdx_moms_prop/Moms_ned_perm.gdx --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 0.98 --closure tax-reaction
run shock_gdx_moms_prop/Moms_ufin.gdx     --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 1.02
run shock_gdx_moms_prop/Moms_perm.gdx     --shock-name "tMoms_y,tMoms_m" --shock-years 2030-2129 --shock-factor 1.02 --closure tax-reaction
echo "=== $(date -Is) MOMS PROPORTIONAL RUNS DONE ==="
