#!/bin/bash
# Offentlig_loen as DREAM's standard shock (makroskop-gnp.6, see freesolver.off_share). Written to
# etl/shock_gdx_offloen/ (NOT scanned by extract.py) until verified, then copied over the published files.
#   setsid nohup bash cloud/run_offentlig_loen.sh > offloen.log 2>&1 < /dev/null &
# Sequential (one factorization at a time), idempotent, resumable from checkpoints.
set -uo pipefail
cd "$(dirname "$0")/../etl"
export PATH="$HOME/.local/bin:$PATH"
export PYTHONUNBUFFERED=1
echo 1000 > /proc/self/oom_score_adj 2>/dev/null || true
mkdir -p shock_gdx_offloen

run() {
  local out="$1"; shift
  if [ -f "$out" ]; then echo "SKIP $out (already exported)"; return; fi
  echo "=============================================================="
  echo "SCENARIO $out"
  echo "=============================================================="
  uv run python freesolver.py solve-export --from-year 2030 "$@" --out "$out" \
    || echo "FAILED: $out (continuing with the rest)"
}

SHOCK="qProd(off,*),qProdHh_t@off_share,qProdxDK@off_share"
run shock_gdx_offloen/Offentlig_loen_ufin.gdx --shock-name "$SHOCK" --shock-years 2030-2129 --shock-factor 1.01
run shock_gdx_offloen/Offentlig_loen_perm.gdx --shock-name "$SHOCK" --shock-years 2030-2129 --shock-factor 1.01 --closure tax-reaction
echo "=== $(date -Is) OFFENTLIG LOEN RUNS DONE ==="
