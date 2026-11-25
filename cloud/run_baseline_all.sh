#!/bin/bash
# makroskop-f67 (2026-11-24): every catalogued scenario solved from DREAM's baseline.gdx instead of the
# zip's deep-calibration point, with DREAM's first-period rule (freesolver first_period_instances).
# cloud/setup.sh has run `freesolver.py reference --gdx ../data/baseline.gdx`; this script exports that
# point as shock_gdx/_reference.gdx and then runs the scenario list in cloud/run_sep_all.sh (the same
# catalogue runs; every GDX is stamped with the reference it started from, and extract.py refuses a mix).
# Park the previous model's shock_gdx/*.gdx first: existing files are skipped, not re-solved.
# Run detached on the box:   setsid nohup bash cloud/run_baseline_all.sh > baseline_all.log 2>&1 < /dev/null &
set -uo pipefail
cd "$(dirname "$0")/../etl" || exit 1
export PATH="$HOME/.local/bin:$PATH"
export PYTHONUNBUFFERED=1

# (not `check | grep -m1`: grep closing the pipe kills check, and pipefail would read that as "no reference")
check_out="$(uv run python freesolver.py check 2>&1)"
grep "^reference point: baseline.gdx" <<<"$check_out" \
  || { echo "system.npz holds no baseline reference point: run cloud/setup.sh first"; exit 1; }
mkdir -p shock_gdx
[ -f shock_gdx/_reference.gdx ] || uv run python freesolver.py export-baseline --out shock_gdx/_reference.gdx
exec bash ../cloud/run_sep_all.sh
