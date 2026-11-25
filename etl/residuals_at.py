"""Evaluate the cached dump's equations at the point stored in another solution file (makroskop-f67).

    uv run python residuals_at.py TARGET.gdx [--overlay BASE.gdx] [--from-year 2030]

Every variable of the dump (endogenous and exogenous) takes the value TARGET gives it; a record the file
dropped is 0, as GAMS reads it. Variables whose symbol TARGET does not hold keep the dump's level, or
BASE's value with --overlay (DREAM's shock files hold only a part of the symbols: overlay them on
baseline.gdx). Residuals near zero from --from-year on mean the point solves this system in those years.

This is how the reference point and the first-period rule were found: DREAM's baseline.gdx solves the
29 Oct 2026 dump to 9e-11 from 2026, and DREAM's Rente_ufin.gdx failed exactly 12 equations of 2030.
Reads the cache as it is; a system.npz that already holds a reference point (`freesolver.py reference`)
is evaluated at the target all the same, since every level is replaced.
"""

import argparse
from collections import Counter
from pathlib import Path

import numpy as np

import freesolver as fs


def point_from(names: list[str], start: np.ndarray, path: Path) -> tuple[np.ndarray, int]:
    """`start` with every variable whose symbol `path` holds replaced by the file's value (0 if dropped)."""
    point, symbols = fs.gdx_point(path)
    x = start.copy()
    taken = 0
    for i, name in enumerate(names):
        key = name.lower()
        if key.partition("(")[0] in symbols:
            x[i] = point.get(key, 0.0)
            taken += 1
    return x, taken


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("target", type=Path)
    parser.add_argument("--overlay", type=Path, default=None, help="values for the symbols TARGET lacks")
    parser.add_argument("--from-year", type=int, default=2030)
    parser.add_argument("--convert-dir", type=Path, default=fs.DEFAULT_CONVERT_DIR)
    args = parser.parse_args()

    data = np.load(fs.CACHE_DIR / "system.npz")
    names = fs.dict_variable_names(args.convert_dir, len(data["levels"]))
    x = data["levels"].copy()
    if args.overlay is not None:
        x, taken = point_from(names, x, args.overlay)
        print(f"{args.overlay.name}: {taken:,} of {len(names):,} variables")
    base = x.copy()
    x, taken = point_from(names, x, args.target)
    print(f"{args.target.name}: {taken:,} of {len(names):,} variables")

    out = np.empty(len(data["rhs"]))
    fs.make_kernel()(data["code"], data["args"], data["consts"], data["eq_offsets"], data["rhs"], x, out)
    eq_year, var_year = fs.load_years(args.convert_dir, len(out), len(x))
    residual = np.where(np.isfinite(out), np.abs(out), np.inf)
    for label, scope in ((f"before {args.from_year}", (eq_year > 0) & (eq_year < args.from_year)),
                         (f"from {args.from_year}", eq_year >= args.from_year)):
        if scope.any():
            print(f"equations {label}: {int(scope.sum()):,}; max |residual| {residual[scope].max():.3e}; "
                  f"above {fs.REFERENCE_TOL:g}: {int((residual[scope] > fs.REFERENCE_TOL).sum()):,}")
    violated = np.where((eq_year >= args.from_year) & (residual > fs.REFERENCE_TOL))[0]
    if len(violated):
        shown = violated[np.argsort(-residual[violated])][:60]
        eq_names = fs.equation_names(args.convert_dir, {int(i) + 1 for i in shown})
        for i in shown:
            print(f"   {eq_names.get(int(i) + 1, '?'):<44} res = {out[i]: .4e}")
        if len(violated) > len(shown):
            print(f"   ... and {len(violated) - len(shown):,} more")
    if args.overlay is not None:
        moved = np.where(data["is_fixed"] & (np.abs(x - base) > 1e-12 * np.maximum(1.0, np.abs(base))))[0]
        by_symbol = Counter(names[i].partition("(")[0] for i in moved)
        print(f"exogenous variables {args.target.name} moved against {args.overlay.name}: {len(moved):,} in "
              f"{len(by_symbol)} symbols" + (": " + ", ".join(f"{s} {c}" for s, c in by_symbol.most_common(12)) if moved.size else ""))


if __name__ == "__main__":
    main()
