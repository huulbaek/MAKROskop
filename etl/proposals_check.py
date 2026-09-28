"""Joint solve vs linear sum for every proposal preset (makroskop-48o).

    uv run python proposals_check.py

Reads etl/proposal_specs.json (bun run proposals:specs), the joint solves in etl/proposal_gdx/ and the
published _ufin scenario JSON, and writes app/static/data/proposals.json with the largest relative gap
per headline series over 2030-2060. A proposal whose GDX stamp is not its current package is refused.
"""

import json
from pathlib import Path
from urllib.parse import parse_qsl

from extract import YEARS, extract_detrended, extract_shock, open_gdx, read_stamp, read_trend_factors

ETL = Path(__file__).parent
DATA = ETL.parent / "app" / "static" / "data"
HEADLINE = ("qBNP", "nL", "saldo2bnp", "qC", "vhW")
WINDOW = (2030, 2060)


def scales(package: str) -> dict[str, float]:
    return {name: float(raw) for name, raw in parse_qsl(package) if name != "variant"}


def linear_sum(scale_by_shock: dict[str, float], columns: dict[str, list[float | None]]) -> list[float | None]:
    length = max(len(c) for c in columns.values())
    out: list[float | None] = []
    for i in range(length):
        parts = [columns[name][i] for name in scale_by_shock]
        out.append(None if any(p is None for p in parts)
                   else sum(scale_by_shock[name] * columns[name][i] for name in scale_by_shock))
    return out


def relative_gap(joint: list[float | None], linear: list[float | None]) -> float:
    pairs = [(j, l) for j, l in zip(joint, linear) if j is not None and l is not None]
    peak = max((abs(j) for j, _ in pairs), default=0.0)
    if peak == 0.0:
        return 0.0
    return max(abs(j - l) for j, l in pairs) / peak


def check_stamp(proposal_id: str, stamp: dict[str, str], spec: dict[str, str]) -> None:
    if stamp.get("package") != spec["package"]:
        raise SystemExit(f"{proposal_id}: joint solve is stale (solved {stamp.get('package')!r}, "
                         f"current {spec['package']!r}) — rerun cloud/run_proposals.sh")


def main() -> None:
    specs = json.loads((ETL / "proposal_specs.json").read_text(encoding="utf-8"))
    reference = ETL / "shock_gdx" / "_reference.gdx"
    baseline = open_gdx(ETL.parent.parent / "MAKRO" / "Model" / "Gdx" / "baseline.gdx")
    factors = read_trend_factors(baseline)
    shock_reference = extract_detrended(open_gdx(reference), factors)
    lo, hi = YEARS.index(WINDOW[0]), YEARS.index(WINDOW[1]) + 1
    out = {}
    for proposal_id, spec in specs.items():
        gdx = ETL / "proposal_gdx" / f"Forslag_{proposal_id}.gdx"
        if not gdx.exists():
            print(f"{proposal_id}: no joint solve yet — not published")
            continue
        stamp = read_stamp(gdx)
        check_stamp(proposal_id, stamp, spec)
        joint = extract_shock(gdx, shock_reference, factors)["deviations"]
        by_shock = scales(spec["package"])
        scenarios = {name: json.loads((DATA / "shocks" / f"{name}_ufin.json").read_text(encoding="utf-8"))["deviations"]
                     for name in by_shock}
        gaps = {}
        for key in HEADLINE:
            linear = linear_sum(by_shock, {name: scenarios[name][key] for name in by_shock})
            gaps[key] = round(100 * relative_gap(joint[key][lo:hi], linear[lo:hi]), 2)
        out[proposal_id] = {"query": spec["query"], "gapPct": gaps, "maxGapPct": max(gaps.values()),
                            "exported": stamp.get("exported", "")}
        print(f"{proposal_id}: max gap {out[proposal_id]['maxGapPct']} pct. {gaps}")
    (DATA / "proposals.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
