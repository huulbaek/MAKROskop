#!/bin/bash
# makroskop-f67 (2026-11-25): the exact check against DREAM. Each of DREAM's published shock files
# (copy <MAKRO clone>/Analysis/Standard_shocks/Gdx/*_ufin.gdx to data/dream/ on the box first) is
# replayed: every exogenous variable the file moved against baseline.gdx is set to the file's value and
# the model is solved from the baseline with the free solver (solve-export --replay). The result should
# equal DREAM's file variable by variable (Rente: 99.96 pct. of 3.4 mio. variables within 1e-6).
# Outputs go to etl/shock_gdx_replay/ (not scanned by extract.py); compare at home.
#   setsid nohup bash cloud/run_dream_replay.sh > replay.log 2>&1 < /dev/null &
# Sequential and idempotent; never run it beside another full-horizon solve.
set -uo pipefail
cd "$(dirname "$0")/../etl" || exit 1
export PATH="$HOME/.local/bin:$PATH"
export PYTHONUNBUFFERED=1
echo 1000 > /proc/self/oom_score_adj 2>/dev/null || true
mkdir -p shock_gdx_replay

shopt -s nullglob
files=(../data/dream/*_ufin.gdx)
[ ${#files[@]} -gt 0 ] || { echo "no DREAM shock files in data/dream/: copy <MAKRO clone>/Analysis/Standard_shocks/Gdx/*_ufin.gdx there"; exit 1; }
for file in "${files[@]}"; do
  name="replay_$(basename "$file")"
  if [ -f "shock_gdx_replay/$name" ]; then echo "SKIP $name (already exported)"; continue; fi
  echo "=============================================================="
  echo "REPLAY $name  $(date -Is)"
  echo "=============================================================="
  uv run python freesolver.py solve-export --from-year 2030 --replay "$file" --out "shock_gdx_replay/$name" \
    || echo "FAILED: $name (continuing with the rest)"
done
echo "=== $(date -Is) REPLAY DONE: $(ls shock_gdx_replay/*.gdx 2>/dev/null | wc -l) GDX files ==="
