"""DREAM's published standard-shock GDX files next to MAKROskop's unfinanced 2030 scenarios.

    uv run python dream_comparison.py [--makro-root PATH] [--dream-dir PATH] [--dream-baseline PATH]
                                      [--shocks-dir PATH] [--out PATH]

DREAM solved the 11 permanent unfinanced shocks of "Shock Reactions in MAKRO" (May 2025) on
MAKRO 2026-September and published them as Git LFS files in `Analysis/Standard_shocks/Gdx/`
(makroskop-ba1). Their deviations are measured against `Model/Gdx/baseline.gdx`: the zero shock
reproduces it by construction (standard_shocks.gms asserts it to 1e-5 before any shock file is
written), so no separate Nulstoed file exists. If DREAM's copy of baseline.gdx sits next to the
shock files it must be byte-identical to the model's — the run stops otherwise. MAKROskop's
deviations are against `etl/shock_gdx/_reference.gdx`: since makroskop-f67 that is DREAM's
baseline.gdx itself, loaded into the zip's equations (`sharedBaseline`); a set solved from the
zip's own calibration point is still read, and its level gap is written to the output.

With the shared baseline, our replays of DREAM's own runs (`etl/shock_gdx_replay/`, solved by
cloud/run_dream_replay.sh with `solve-export --replay`) are checked against DREAM's files variable
by variable; a replay that is not a reproduction stops the run. Without those files `replay` is null.

Where DREAM normalises a shock to 1 pct. of GDP the size is read from the instrument in DREAM's
own file (e.g. uXMarked 2030 / baseline − 1) and divided by the change in ours; our deviations are
scaled linearly with that ratio (MAKRO is near-linear at these sizes, CLAUDE.md "makro-linearity").
Both solvers' series are kept over the whole horizon (2030–2129) in pct. deviations, and the table
columns are converted to the units of DREAM's note (employment in 1,000 persons, exports and
consumption in pct.-points of GDP).
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

SHOCK_YEAR = 2030
HORIZON_END = 2129  # DREAM's baseline_end; the last year both solvers have
HORIZON = list(range(SHOCK_YEAR, HORIZON_END + 1))
COLUMNS = [2030, 2031, 2032, 2033, 2035, 2040, 2050, 2080, 2100, 2129]
PRESHOCK_TOLERANCE = 1e-9  # pct.; DREAM's files equal baseline.gdx to 1e-14 before 2030

# (MAKROskop series key, Danish label, the unit the table shows — DREAM's note's convention)
SERIES = [
    ("qBNP", "BNP", "pct."),
    ("nL", "Beskæftigelse", "1.000 personer"),
    ("qC", "Privat forbrug", "pct. af BNP"),
    ("qX", "Eksport", "pct. af BNP"),
    ("qI", "Investeringer", "pct."),
    ("vhW", "Timeløn", "pct."),
    ("pBolig", "Boligpriser", "pct."),
    ("saldo2bnp", "Offentlig saldo", "pct.-point af BNP"),
]

# (DREAM's shock id, our published scenario compared with it, Danish note or None) — page order.
SHOCKS = [
    ("Rente", "Rente", None),
    ("Eksportmarkedsvaekst", "Eksportmarkedsvaekst", None),
    ("Offentlig_varekoeb", "Offentlig_varekoeb", None),
    ("Offentlig_Beskaeftigelse", "Offentlig_Beskaeftigelse", None),
    ("Offentlige_investeringer", "Offentlige_investeringer", None),
    ("Overforsel_privat", "Overforsel_privat", None),
    ("Importpris", "Importpris", None),
    ("Udenlandske_priser", "Udenlandske_priser", None),
    ("Arbejdsudbud_beskaeftigelse", "Arbejdsudbud_beskaeftigelse",
     "Begge fastlåser den strukturelle beskæftigelse 1 pct. højere for hver alder og frigiver deltagelsesparameteren (exo/endo-bytte)."),
    ("ArbejdsProd", "ArbejdsProd", None),
    # makroskop-big: DREAM's file is uK × 1.01 since 2026-10-09 (commits 9774450, 5fd09a3). Until then
    # standard_shocks.gms computed uK × 1.01^(e−1), which we mirrored in a validation-only run (parked).
    ("KapitalProd", "KapitalProd",
     "DREAM rettede 9. oktober 2026 standard_shocks.gms, så filen nu er det stød, stødreaktionspapiret beskriver: "
     "uK × 1,01 i alle private brancher. Den tidligere fil og figurerne i papiret fra maj 2025 viste et vægtet "
     "stød, uK × 1,01^(e−1) pr. branche, som sænker kapitalens produktivitet, så BNP falder."),
]


@dataclass(frozen=True)
class Instrument:
    """Where to read a shock's size: one exogenous cell (or every cell, "*") in the shock year."""

    gdx_name: str
    selector: tuple[str, ...]  # domain elements before t; "*" = all cells, which must move alike
    mode: str  # "rel": shock/base − 1 (DREAM's factor shocks); "abs": shock − base (additive ones);
    #            "cell": checked cell by cell (KapitalProd's uK per capital type and sector): both files must
    #            move every shared cell alike, so the comparison runs at scale 1 (cellwise_gap)
    label_da: str
    unit_da: str = "pct."  # for "abs": the unit of the difference after `display`
    display: float = 100.0  # "rel" changes are shown ×100 as pct.; "abs" ones ×display


INSTRUMENTS: dict[str, Instrument] = {
    "Rente": Instrument("rRenteECB", (), "abs", "ECB-renten", "pct.-point", 100.0),
    "Eksportmarkedsvaekst": Instrument("uXMarked", (), "rel", "eksportmarkedet"),
    "Offentlig_varekoeb": Instrument("qR", ("off",), "rel", "offentligt varekøb"),
    "Offentlig_Beskaeftigelse": Instrument("hL", ("off",), "rel", "offentlige arbejdstimer"),
    "Offentlige_investeringer": Instrument("qI_s", ("iM", "off"), "rel", "offentlige investeringer"),
    "Overforsel_privat": Instrument("vOffTilHhRest", (), "abs", "øvrige overførsler", "mia. kr. (2020-niveau)", 1.0),
    # pM[tot] is an endogenous aggregate, so one shocked sector stands for the uniform factor
    "Importpris": Instrument("pM", ("tje",), "rel", "importpriserne"),
    "Udenlandske_priser": Instrument("pM", ("tje",), "rel", "import- og eksportkonkurrerende priser"),
    "Arbejdsudbud_beskaeftigelse": Instrument("snLHh", ("*",), "rel", "strukturel beskæftigelse"),
    "ArbejdsProd": Instrument("qProdHh_t", (), "rel", "arbejdskraftproduktiviteten"),
    "KapitalProd": Instrument("uK", (), "cell", "kapitalens produktivitet"),
}

PAPER = {
    "source": "DREAM: Shock Reactions in MAKRO (maj 2025), Høegh, Partsch og Bonde",
    "url": "https://dreamgruppen.dk/Media/638833322447461188/shock_reactions_in_makro_may_2025.pdf",
}
GDX_URL = "https://github.com/DREAM-DK/MAKRO/tree/main/Analysis/Standard_shocks/Gdx"
# What this script reads from the MAKRO checkout; the commit cited next to DREAM's files is where these
# last changed (extract.input_commit), not the scenario data's model commit.
DREAM_INPUTS = ("Analysis/Standard_shocks/Gdx", "Model/Gdx/baseline.gdx")


def dream_files_version(makro_root: Path) -> dict[str, str]:
    """extract.model_version for the files this script reads from the checkout."""
    from extract import model_version

    return model_version(makro_root, DREAM_INPUTS)

DA_MONTHS = ("januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober",
             "november", "december")


def date_da(iso: str) -> str:
    """'2026-09-07' -> '7. september 2026'."""
    year, month, day = (int(part) for part in iso.split("-"))
    return f"{day}. {DA_MONTHS[month - 1]} {year}"


def reference_file_facts(makro_root: Path) -> dict[str, str]:
    """When the two reference points' files entered the MAKRO checkout: the calibration zip MAKROskop
    solves on (dump date from its members, last commit) and DREAM's baseline.gdx (last commit)."""
    from extract import input_commit, input_date, zip_dump_date

    zip_path, baseline_path = ["Model/deep_dynamic_calibration.zip"], ["Model/Gdx/baseline.gdx"]
    return {
        "dumped": zip_dump_date(makro_root),
        "zip_commit": input_commit(makro_root, zip_path),
        "zip_committed": input_date(makro_root, zip_path),
        "baseline_commit": input_commit(makro_root, baseline_path),
        "baseline_committed": input_date(makro_root, baseline_path),
    }


def reference_files_note(dumped: str, zip_commit: str, zip_committed: str,
                         baseline_commit: str, baseline_committed: str) -> str | None:
    """Danish sentence for the page's reference-point note, or None when there is nothing to state:
    a fact is missing, or both files came in one commit (which says nothing about separate runs)."""
    if not all((dumped, zip_commit, zip_committed, baseline_commit, baseline_committed)):
        return None
    if zip_commit == baseline_commit:
        return None
    return (f"De to filer er lagt i MAKRO-repositoriet hver for sig: zip-filen er dannet {date_da(dumped)} og lagt ud "
            f"{date_da(zip_committed)} (commit {zip_commit}), grundforløbet {date_da(baseline_committed)} "
            f"(commit {baseline_commit}).")


REPLAY_TOLERANCE = 1e-6  # scaled difference a replayed run may have from DREAM's file and still count as the same


def replay_agreement(ours: dict[str, float], dream: dict[str, float], base: dict[str, float],
                     dream_symbols: set[str], from_year: int) -> dict[str, float]:
    """How closely our replay of a DREAM run (freesolver solve-export --replay) matches DREAM's file.

    Compared are the variables that respond: dated `from_year` or later, held by DREAM's file, and moved
    against the baseline in either file (by more than 1e-9 x max(1, |baseline|)). Exogenous data and
    variables the shock does not touch are equal by construction and would only flatter the share. The
    difference is |ours - DREAM's| / max(1, |ours|, |DREAM's|): relative for large values, absolute
    below 1, so an adjustment term at 1e-11 in both files is not a disagreement by a factor of two.
    """
    import numpy as np

    diffs = []
    for key, a in ours.items():
        symbol, _, rest = key.partition("(")
        if symbol not in dream_symbols:
            continue
        tail = rest.rstrip(")").rpartition(",")[2]
        if not (len(tail) == 4 and tail.isdigit() and int(tail) >= from_year):
            continue
        b, c = dream.get(key, 0.0), base.get(key, 0.0)
        moved = 1e-9 * max(1.0, abs(c))
        if abs(a - c) <= moved and abs(b - c) <= moved:
            continue
        diffs.append(abs(a - b) / max(1.0, abs(a), abs(b)))
    values = np.array(diffs)
    return {"variables": int(len(values)),
            "within1e6Pct": round(100.0 * float((values <= REPLAY_TOLERANCE).mean()), 2),
            "medianDiff": float(np.median(values)),
            "maxDiff": float(values.max())}


def require_reproduction(name: str, stats: dict[str, float]) -> None:
    """The page says our solver reproduces DREAM's runs: a replay that does not must stop the comparison."""
    if stats["maxDiff"] > REPLAY_TOLERANCE:
        raise SystemExit(f"{name}: differs from DREAM's file by up to {stats['maxDiff']:.2e} (scaled), more than "
                         f"{REPLAY_TOLERANCE:g}: not a reproduction - find out why before publishing")


def max_series_gap(ours: dict[str, dict[int, float]], dream: dict[str, dict[int, float]],
                   keys: list[str], years: list[int]) -> float:
    """Largest |ours - dream| over the given series and years, in the series' own unit (pct. or pct.-points)."""
    return max((abs(ours[key][year] - dream[key][year])
                for key in keys if key in ours and key in dream
                for year in years if year in ours[key] and year in dream[key]), default=0.0)


def replay_check(replay_path: Path, dream_path: Path, dream_dev: dict[str, dict[int, float]],
                 ours_detrended: dict[str, dict[int, float]], reference_meta: dict[str, str],
                 base_point: dict[str, float]) -> dict | None:
    """Agreement of our replay of DREAM's run with DREAM's file, or None when it has not been solved.

    Refuses a file that replays another version of DREAM's file or started from another reference.
    """
    from extract import deviation_series, open_gdx, read_stamp, reference_errors
    from freesolver import gdx_point

    if not replay_path.exists():
        return None
    stamp = read_stamp(replay_path)
    errors = replay_errors(stamp, dream_path.name, sha256(dream_path)) + reference_errors(reference_meta, {replay_path.name: stamp})
    if errors:
        raise SystemExit(f"{replay_path.name}: " + "; ".join(errors))
    ours_point, _ = gdx_point(replay_path)
    dream_point, dream_symbols = gdx_point(dream_path)
    stats = replay_agreement(ours_point, dream_point, base_point, dream_symbols, SHOCK_YEAR)
    require_reproduction(replay_path.name, stats)
    replay_dev, _ = deviation_series(open_gdx(replay_path), ours_detrended)
    stats["maxSeriesGap"] = max_series_gap(replay_dev, dream_dev, [key for key, _, _ in SERIES], HORIZON)
    stats["file"] = replay_path.name
    return stats


def replay_errors(stamp: dict[str, str], dream_name: str, dream_sha256: str) -> list[str]:
    """Why a file in shock_gdx_replay is not a replay of this DREAM file (empty when it is)."""
    if stamp.get("shock") != "replay":
        return [f"is not a replay (shock '{stamp.get('shock', '')}')"]
    want = f"{dream_name} {dream_sha256[:12]}"
    if stamp.get("replay") != want:
        return [f"replays '{stamp.get('replay', '')}', but DREAM's file is '{want}'"]
    return []


def same_baseline(reference_stamp: str, baseline_sha256: str) -> bool:
    """True when our runs started from DREAM's own baseline file (freesolver `reference`, makroskop-f67):
    their stamp names the file and the first 12 hex digits of its SHA-256."""
    return reference_stamp == f"baseline.gdx {baseline_sha256[:12]}"


def ours_baseline_da(shared: bool) -> str:
    """What our deviations are measured against, for the page."""
    if shared:
        return ("DREAMs grundforløb, Model/Gdx/baseline.gdx, læst ind i ligningerne fra modellens zip-fil "
                "(etl/shock_gdx/_reference.gdx)")
    return "kalibreringspunktet i Model/deep_dynamic_calibration.zip (etl/shock_gdx/_reference.gdx)"


def checkout_reference_note(makro_root: Path, solved_fingerprint: str) -> str | None:
    """reference_files_note for the checkout, withheld unless its zip is the one our scenarios were solved on."""
    from extract import model_fingerprint

    if not solved_fingerprint or model_fingerprint(makro_root) != solved_fingerprint:
        return None
    return reference_files_note(**reference_file_facts(makro_root))


@dataclass(frozen=True)
class RefLevels:
    """Shock-year reference levels behind the unit conversions (one set per solver)."""

    employment_thousands: float  # nL(tot), 1,000 persons
    export_share: float  # vX(xTot) / vBNP
    consumption_share: float  # vC(cTot) / vBNP


def convert(key: str, pct_deviation: float, scale: float, ref: RefLevels) -> float:
    """A pct. deviation (or pct.-point one for saldo2bnp) in the table's unit at `scale` x the shock."""
    if key == "nL":
        return pct_deviation / 100.0 * ref.employment_thousands * scale
    if key == "qX":
        return pct_deviation * ref.export_share * scale
    if key == "qC":
        return pct_deviation * ref.consumption_share * scale
    if key in ("qBNP", "qI", "vhW", "pBolig", "saldo2bnp"):
        return pct_deviation * scale
    raise KeyError(f"no table unit defined for series {key}")


def instrument_change(shock: dict[tuple, float], base: dict[tuple, float], mode: str) -> float:
    """The instrument's change in the shock year, checked to be the same in every shocked cell."""
    changes = []
    for cell, value in shock.items():
        before = base.get(cell)
        if before is None or (mode == "rel" and before == 0):
            continue
        changes.append(value / before - 1 if mode == "rel" else value - before)
    if not changes:
        raise ValueError("no shocked cells with a nonzero base")
    spread = max(changes) - min(changes)
    tolerance = 1e-6 if mode == "rel" else 1e-6 * max(abs(c) for c in changes)
    if spread > tolerance:
        raise ValueError(f"instrument change is not uniform across cells: {min(changes):.6g}..{max(changes):.6g}")
    return sum(changes) / len(changes)


def cellwise_gap(ours: dict[tuple, float], ours_base: dict[tuple, float],
                 dream: dict[tuple, float], dream_base: dict[tuple, float]) -> tuple[int, float]:
    """(shared cells, largest gap between the two files' relative changes) for an instrument that moves
    by a different amount per cell; cells only one model has, or with a zero base, are left out."""
    gaps = [abs(ours[cell] / ours_base[cell] - dream[cell] / dream_base[cell])
            for cell in ours.keys() & dream.keys()
            if ours_base.get(cell) and dream_base.get(cell)]
    if not gaps:
        raise ValueError("no shared cells with a nonzero base in both files")
    return len(gaps), max(gaps)


def shock_scale(dream_change: float, ours_change: float) -> float:
    """DREAM's shock size over ours — the factor our deviations are scaled with."""
    return dream_change / ours_change


def _da(value: float, decimals: int = 2) -> str:
    return f"{value:+.{decimals}f}".replace(".", ",")


def format_change(change: float, mode: str, unit_da: str = "pct.", display: float = 100.0) -> str:
    return f"{_da(change * display)} {unit_da}"


def size_note(scale: float, instrument_da: str, dream_change: float, ours_change: float, mode: str,
              unit_da: str = "pct.", display: float = 100.0) -> str:
    """Danish caption: the same shock, or DREAM's size read from the file and the factor applied."""
    dream_da = format_change(dream_change, mode, unit_da, display)
    if abs(scale - 1.0) < 1e-6:
        return f"Samme stød i begge modeller: {instrument_da} {dream_da}."
    ours_da = format_change(ours_change, mode, unit_da, display)
    return (f"DREAMs stød aflæst i filen: {instrument_da} {dream_da} i {SHOCK_YEAR} (normeret til 1 pct. af BNP) "
            f"= {scale:.2f} × MAKROskops {ours_da}; MAKROskops tal er skaleret lineært op med den faktor."
            .replace(f"{scale:.2f}", f"{scale:.2f}".replace(".", ",")))


def _clean(value: float | None, digits: int) -> float | None:
    if value is None:
        return None
    rounded = round(value, digits)
    return 0.0 if rounded == 0 else rounded  # no "-0.0" in the output


def build_row(key: str, dream: dict[int, float], ours: dict[int, float] | None, scale: float | None,
              dream_ref: RefLevels, ours_ref: RefLevels, horizon: list[int], columns: list[int]) -> dict:
    """One series: both solvers' pct. series over `horizon` and the table columns in DREAM's unit."""
    row: dict = {
        "series": key,
        "dreamPct": [_clean(dream.get(year), 4) for year in horizon],
        "dream": {str(year): _clean(convert(key, dream[year], 1.0, dream_ref), 2) if year in dream else None
                  for year in columns},
        "oursPct": None,
        "ours": None,
    }
    if ours is not None:
        factor = 1.0 if scale is None else scale
        row["oursPct"] = [_clean(ours[year] * factor, 4) if year in ours else None for year in horizon]
        row["ours"] = {str(year): _clean(convert(key, ours[year], factor, ours_ref), 2) if year in ours else None
                       for year in columns}
    return row


def check_preshock(deviations: dict[str, dict[int, float]], name: str) -> None:
    """DREAM's shock files must sit on the baseline in the year before the shock."""
    year = SHOCK_YEAR - 1
    moved = {key: values[year] for key, values in deviations.items()
             if year in values and abs(values[year]) > PRESHOCK_TOLERANCE}
    if moved:
        worst = max(moved, key=lambda k: abs(moved[k]))
        raise SystemExit(f"{name}: {len(moved)} series deviate from baseline.gdx in {year} "
                         f"(e.g. {worst} {moved[worst]:.3g}); wrong reference or an anticipated run")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check_baseline_marker(marker: Path, model_baseline: Path) -> str:
    """DREAM ships a copy of baseline.gdx next to the shocks as a consistency marker (Høegh,
    2026-10-02). "verified" when it matches Model/Gdx/baseline.gdx, "absent" when not shipped;
    a differing copy means the shocks were solved from another baseline — stop."""
    if not marker.exists():
        return "absent"
    if sha256(marker) != sha256(model_baseline):
        raise SystemExit(f"{marker} and {model_baseline} differ (sha256): DREAM's shock files were not "
                         f"solved from this baseline — do not compare")
    return "verified"


def cells_at(container, name: str, selector: tuple[str, ...], year: int) -> dict[tuple, float]:
    """{domain tuple: level} of one symbol in `year`, filtered by `selector` ("*" = any element)."""
    frame = container.data[name].records
    domain = [c for c in frame.columns if c not in ("level", "marginal", "lower", "upper", "scale")]
    frame = frame[frame[domain[-1]].astype(str) == str(year)]
    for column, element in zip(domain[:-1], selector):
        if element != "*":
            frame = frame[frame[column] == element]
    return {tuple(row[c] for c in domain[:-1]): float(row["level"]) for _, row in frame.iterrows()}


def reference_levels(container) -> RefLevels:
    from multipliers import series

    gdp = series(container, "vBNP", None, SHOCK_YEAR)
    return RefLevels(employment_thousands=series(container, "nL", "tot", SHOCK_YEAR),
                     export_share=series(container, "vX", "xTot", SHOCK_YEAR) / gdp,
                     consumption_share=series(container, "vC", "cTot", SHOCK_YEAR) / gdp)


def level_gap(ours_detrended: dict[str, dict[int, float]], dream_detrended: dict[str, dict[int, float]],
              keys: tuple[str, ...] = ("vBNP", "qBNP", "nL", "qC", "pBolig")) -> dict[str, float]:
    """Our reference point relative to DREAM's baseline in the shock year, pct. — the honest caveat."""
    return {key: round((ours_detrended[key][SHOCK_YEAR] / dream_detrended[key][SHOCK_YEAR] - 1) * 100, 2)
            for key in keys if key in ours_detrended and key in dream_detrended}


def main() -> None:
    from catalog import SHOCKS as CATALOG, stamp_mismatches
    from extract import (deviation_series, extract_detrended, open_gdx, read_solver_meta, read_stamp,
                         reference_errors)

    here = Path(__file__).parent
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--makro-root", type=Path, default=Path.home() / "vserver" / "MAKRO")
    parser.add_argument("--dream-dir", type=Path, default=None,
                        help="DREAM's shock GDX files (default <makro-root>/Analysis/Standard_shocks/Gdx)")
    parser.add_argument("--dream-baseline", type=Path, default=None,
                        help="DREAM's reference (default <makro-root>/Model/Gdx/baseline.gdx)")
    parser.add_argument("--shocks-dir", type=Path, default=here / "shock_gdx")
    parser.add_argument("--replay-dir", type=Path, default=here / "shock_gdx_replay",
                        help="our replays of DREAM's runs (cloud/run_dream_replay.sh): replay_<shock>_ufin.gdx")
    parser.add_argument("--out", type=Path, default=here.parent / "app" / "static" / "data" / "dream_comparison.json")
    args = parser.parse_args()
    dream_dir = args.dream_dir or args.makro_root / "Analysis" / "Standard_shocks" / "Gdx"
    dream_baseline = args.dream_baseline or args.makro_root / "Model" / "Gdx" / "baseline.gdx"

    marker = check_baseline_marker(dream_dir / "baseline.gdx", dream_baseline)
    dream_model = dream_files_version(args.makro_root)
    dream_base = open_gdx(dream_baseline)
    dream_detrended = extract_detrended(dream_base)
    dream_ref = reference_levels(dream_base)
    ours_base = open_gdx(args.shocks_dir / "_reference.gdx")
    reference_meta = read_stamp(args.shocks_dir / "_reference.gdx")
    ours_reference = reference_meta.get("reference", "calibration point")
    shared = same_baseline(ours_reference, sha256(dream_baseline))
    ours_detrended = extract_detrended(ours_base)
    ours_ref = reference_levels(ours_base)
    gap = level_gap(ours_detrended, dream_detrended)
    labels = {shock.name: shock.label_da for shock in CATALOG}
    print(f"DREAM baseline {dream_baseline.name} ({marker} marker): nL {dream_ref.employment_thousands:.1f} k, "
          f"vX/vBNP {dream_ref.export_share:.4f}, vC/vBNP {dream_ref.consumption_share:.4f}")
    print(f"ours _reference: nL {ours_ref.employment_thousands:.1f} k, vX/vBNP {ours_ref.export_share:.4f}, "
          f"vC/vBNP {ours_ref.consumption_share:.4f}; level gap {SHOCK_YEAR} ours/DREAM: "
          + ", ".join(f"{k} {v:+.2f} %" for k, v in gap.items()))

    # DREAM's baseline by variable name, for the replay check (which variables respond)
    base_point: dict[str, float] = {}
    if shared and any(args.replay_dir.glob("replay_*.gdx")):
        from freesolver import gdx_point

        base_point, _ = gdx_point(dream_baseline)
    if ours_reference.startswith("baseline.gdx ") and not shared:
        raise SystemExit(f"our runs started from '{ours_reference}', which is not the checkout's {dream_baseline.name} "
                         f"({sha256(dream_baseline)[:12]}): scenarios and DREAM's files do not share a baseline")

    files = []
    shocks = []
    ours_model: dict[str, str] = {}
    for shock_id, ours_run, note in SHOCKS:
        dream_path = dream_dir / f"{shock_id}_ufin.gdx"
        if not dream_path.exists():
            print(f"{shock_id}: DREAM file missing, skipped")
            continue
        dream_gdx = open_gdx(dream_path)
        files.append({"name": dream_path.name, "sha256": sha256(dream_path), "bytes": dream_path.stat().st_size})
        dream_dev, _ = deviation_series(dream_gdx, dream_detrended)
        check_preshock(dream_dev, dream_path.name)
        instrument = INSTRUMENTS[shock_id]

        def at(container):
            return cells_at(container, instrument.gdx_name, instrument.selector, SHOCK_YEAR)

        cellwise = instrument.mode == "cell"
        dream_change = None if cellwise else instrument_change(at(dream_gdx), at(dream_base), instrument.mode)

        ours_path = args.shocks_dir / f"{ours_run}_ufin.gdx"
        ours_dev = None
        scale = None
        solved = None
        if ours_path.exists():
            ours_gdx = open_gdx(ours_path)
            ours_dev, _ = deviation_series(ours_gdx, ours_detrended)
            stamp = read_solver_meta(ours_gdx)
            if mismatches := stamp_mismatches(ours_run, "_ufin", stamp, HORIZON_END):
                raise SystemExit(f"{ours_path.name}: solver stamp disagrees with the catalog: {mismatches}")
            if errors := reference_errors(reference_meta, {ours_path.name: stamp}):
                raise SystemExit("; ".join(errors))
            solved = {"exported": stamp.get("exported"), "fingerprint": stamp.get("fingerprint")}
            ours_model.setdefault("fingerprint", stamp.get("fingerprint", ""))
            if cellwise:
                cells, worst = cellwise_gap(at(ours_gdx), at(ours_base), at(dream_gdx), at(dream_base))
                if worst > 1e-9:
                    raise SystemExit(f"{shock_id}: ours and DREAM's file move {instrument.gdx_name} differently in "
                                     f"{SHOCK_YEAR} (largest gap {worst:.3g} over {cells} cells); not the same shock")
                scale = 1.0
                scale_note = (f"Samme stød i begge modeller: {instrument.gdx_name} ændres ens i alle {cells} fælles "
                              f"celler i {SHOCK_YEAR} (kontrolleret i begge filer).")
            else:
                ours_change = instrument_change(at(ours_gdx), at(ours_base), instrument.mode)
                scale = shock_scale(dream_change, ours_change)
                scale_note = size_note(scale, instrument.label_da, dream_change, ours_change, instrument.mode,
                                       instrument.unit_da, instrument.display)
        elif cellwise:
            scale_note = "Samme stød-definition i begge modeller."
        else:
            scale_note = (f"DREAMs stød aflæst i filen: {instrument.label_da} "
                          f"{format_change(dream_change, instrument.mode, instrument.unit_da, instrument.display)} "
                          f"i {SHOCK_YEAR}.")

        rows = [build_row(key, dream_dev[key], ours_dev[key] if ours_dev and key in ours_dev else None, scale,
                          dream_ref, ours_ref, HORIZON, COLUMNS)
                for key, _, _ in SERIES if key in dream_dev]
        shocks.append({
            "id": shock_id, "labelDa": labels[shock_id], "scenario": f"{ours_run}_ufin",
            "dreamFile": dream_path.name, "solved": solved,
            "scale": None if scale is None else round(scale, 4), "scaleNoteDa": scale_note, "noteDa": note,
            "replay": replay_check(args.replay_dir / f"replay_{dream_path.name}", dream_path, dream_dev,
                                   ours_detrended, reference_meta, base_point) if shared else None,
            "rows": rows,
        })
        gdp = next(row for row in rows if row["series"] == "qBNP")
        ours_text = "afventer" if gdp["ours"] is None else f"{gdp['ours']['2030']:+.2f}/{gdp['ours']['2129']:+.2f}"
        print(f"{labels[shock_id]:34s} x{(scale or float('nan')):6.3f}  BNP 2030/2129  DREAM "
              f"{gdp['dream']['2030']:+.2f}/{gdp['dream']['2129']:+.2f}  ours {ours_text}")

    out = {
        "generated": datetime.date.today().isoformat(),
        "shockYear": SHOCK_YEAR,
        "years": HORIZON,
        "columns": COLUMNS,
        "dream": {
            "source": "DREAM: standardstød løst på MAKRO 2026-September, offentliggjort som GDX-filer i MAKRO-repositoriet",
            "url": GDX_URL,
            "modelDa": f"{dream_model['name']} (commit {dream_model['commit']})",
            "commit": dream_model["commit"],
            "baselineDa": "Model/Gdx/baseline.gdx — DREAMs grundforløb, som nulstødet reproducerer (standard_shocks.gms)",
            "baselineSha256": sha256(dream_baseline),
            "baselineMarker": marker,
            "files": files,
            "paper": PAPER,
        },
        "ours": {
            "fingerprint": ours_model.get("fingerprint", ""),
            "baselineDa": ours_baseline_da(shared),
            "reference": ours_reference,
            "sharedBaseline": shared,
            "levelGapPct": gap,
            # only when the two reference points differ is it worth saying when each file was made
            "referenceFilesDa": None if shared else checkout_reference_note(args.makro_root,
                                                                            ours_model.get("fingerprint", "")),
        },
        "series": [{"key": key, "labelDa": label, "unitDa": unit} for key, label, unit in SERIES],
        "shocks": shocks,
    }
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {args.out} ({len(shocks)} shocks, {len(files)} DREAM files)")


if __name__ == "__main__":
    main()
