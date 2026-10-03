"""DREAM's published standard-shock GDX files next to MAKROskop's unfinanced 2030 scenarios.

    uv run python dream_comparison.py [--makro-root PATH] [--dream-dir PATH] [--dream-baseline PATH]
                                      [--shocks-dir PATH] [--out PATH]

DREAM solved the 11 permanent unfinanced shocks of "Shock Reactions in MAKRO" (May 2025) on
MAKRO 2026-September and published them as Git LFS files in `Analysis/Standard_shocks/Gdx/`
(makroskop-ba1). Their deviations are measured against `Model/Gdx/baseline.gdx`: the zero shock
reproduces it by construction (standard_shocks.gms asserts it to 1e-5 before any shock file is
written), so no separate Nulstoed file exists. If DREAM's copy of baseline.gdx sits next to the
shock files it must be byte-identical to the model's — the run stops otherwise. MAKROskop's
deviations are against `etl/shock_gdx/_reference.gdx`, the calibration point of the zip, which
differs from baseline.gdx in levels (the gap is written to the output, not hidden).

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

# (catalog shock id, Danish note or None) — page order; the same-definition shock first
SHOCKS = [
    ("Rente", None),
    ("Eksportmarkedsvaekst", None),
    ("Offentlig_varekoeb", None),
    ("Offentlig_Beskaeftigelse", None),
    ("Offentlige_investeringer", None),
    ("Overforsel_privat", None),
    ("Importpris", None),
    ("Udenlandske_priser", None),
    ("Arbejdsudbud_beskaeftigelse",
     "Begge fastlåser den strukturelle beskæftigelse 1 pct. højere for hver alder og frigiver deltagelsesparameteren (exo/endo-bytte)."),
    ("ArbejdsProd", None),
    ("KapitalProd", "DREAMs stød er en eksponentfaktor på uK pr. branche; størrelsen kan ikke aflæses som én faktor."),
]


@dataclass(frozen=True)
class Instrument:
    """Where to read a shock's size: one exogenous cell (or every cell, "*") in the shock year."""

    gdx_name: str
    selector: tuple[str, ...]  # domain elements before t; "*" = all cells, which must move alike
    mode: str  # "rel": shock/base − 1 (DREAM's factor shocks); "abs": shock − base (additive ones)
    label_da: str
    unit_da: str = "pct."  # for "abs": the unit of the difference after `display`
    display: float = 100.0  # "rel" changes are shown ×100 as pct.; "abs" ones ×display


# None = the same definition in both solvers but no single readable size (KapitalProd).
INSTRUMENTS: dict[str, Instrument | None] = {
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
    "KapitalProd": None,
}

PAPER = {
    "source": "DREAM: Shock Reactions in MAKRO (maj 2025), Høegh, Partsch og Bonde",
    "url": "https://dreamgruppen.dk/Media/638833322447461188/shock_reactions_in_makro_may_2025.pdf",
}
GDX_URL = "https://github.com/DREAM-DK/MAKRO/tree/main/Analysis/Standard_shocks/Gdx"


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
    from catalog import SHOCKS as CATALOG
    from extract import deviation_series, extract_detrended, model_version, open_gdx, read_solver_meta

    here = Path(__file__).parent
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--makro-root", type=Path, default=Path.home() / "vserver" / "MAKRO")
    parser.add_argument("--dream-dir", type=Path, default=None,
                        help="DREAM's shock GDX files (default <makro-root>/Analysis/Standard_shocks/Gdx)")
    parser.add_argument("--dream-baseline", type=Path, default=None,
                        help="DREAM's reference (default <makro-root>/Model/Gdx/baseline.gdx)")
    parser.add_argument("--shocks-dir", type=Path, default=here / "shock_gdx")
    parser.add_argument("--out", type=Path, default=here.parent / "app" / "static" / "data" / "dream_comparison.json")
    args = parser.parse_args()
    dream_dir = args.dream_dir or args.makro_root / "Analysis" / "Standard_shocks" / "Gdx"
    dream_baseline = args.dream_baseline or args.makro_root / "Model" / "Gdx" / "baseline.gdx"

    marker = check_baseline_marker(dream_dir / "baseline.gdx", dream_baseline)
    dream_model = model_version(args.makro_root)
    dream_base = open_gdx(dream_baseline)
    dream_detrended = extract_detrended(dream_base)
    dream_ref = reference_levels(dream_base)
    ours_base = open_gdx(args.shocks_dir / "_reference.gdx")
    ours_detrended = extract_detrended(ours_base)
    ours_ref = reference_levels(ours_base)
    gap = level_gap(ours_detrended, dream_detrended)
    labels = {shock.name: shock.label_da for shock in CATALOG}
    print(f"DREAM baseline {dream_baseline.name} ({marker} marker): nL {dream_ref.employment_thousands:.1f} k, "
          f"vX/vBNP {dream_ref.export_share:.4f}, vC/vBNP {dream_ref.consumption_share:.4f}")
    print(f"ours _reference: nL {ours_ref.employment_thousands:.1f} k, vX/vBNP {ours_ref.export_share:.4f}, "
          f"vC/vBNP {ours_ref.consumption_share:.4f}; level gap {SHOCK_YEAR} ours/DREAM: "
          + ", ".join(f"{k} {v:+.2f} %" for k, v in gap.items()))

    files = []
    shocks = []
    ours_model: dict[str, str] = {}
    for shock_id, note in SHOCKS:
        dream_path = dream_dir / f"{shock_id}_ufin.gdx"
        if not dream_path.exists():
            print(f"{shock_id}: DREAM file missing, skipped")
            continue
        dream_gdx = open_gdx(dream_path)
        files.append({"name": dream_path.name, "sha256": sha256(dream_path), "bytes": dream_path.stat().st_size})
        dream_dev, _ = deviation_series(dream_gdx, dream_detrended)
        check_preshock(dream_dev, dream_path.name)
        instrument = INSTRUMENTS[shock_id]
        dream_change = (instrument_change(cells_at(dream_gdx, instrument.gdx_name, instrument.selector, SHOCK_YEAR),
                                          cells_at(dream_base, instrument.gdx_name, instrument.selector, SHOCK_YEAR),
                                          instrument.mode) if instrument else None)

        ours_path = args.shocks_dir / f"{shock_id}_ufin.gdx"
        ours_dev = None
        scale = None
        solved = None
        if ours_path.exists():
            ours_gdx = open_gdx(ours_path)
            ours_dev, _ = deviation_series(ours_gdx, ours_detrended)
            stamp = read_solver_meta(ours_gdx)
            solved = {"exported": stamp.get("exported"), "fingerprint": stamp.get("fingerprint")}
            ours_model.setdefault("fingerprint", stamp.get("fingerprint", ""))
            if instrument:
                ours_change = instrument_change(
                    cells_at(ours_gdx, instrument.gdx_name, instrument.selector, SHOCK_YEAR),
                    cells_at(ours_base, instrument.gdx_name, instrument.selector, SHOCK_YEAR), instrument.mode)
                scale = shock_scale(dream_change, ours_change)
                scale_note = size_note(scale, instrument.label_da, dream_change, ours_change, instrument.mode,
                                       instrument.unit_da, instrument.display)
            else:
                scale = 1.0
                scale_note = "Samme stød-definition i begge modeller."
        elif instrument:
            scale_note = (f"DREAMs stød aflæst i filen: {instrument.label_da} "
                          f"{format_change(dream_change, instrument.mode, instrument.unit_da, instrument.display)} "
                          f"i {SHOCK_YEAR}.")
        else:
            scale_note = "Samme stød-definition i begge modeller."

        rows = [build_row(key, dream_dev[key], ours_dev[key] if ours_dev and key in ours_dev else None, scale,
                          dream_ref, ours_ref, HORIZON, COLUMNS)
                for key, _, _ in SERIES if key in dream_dev]
        shocks.append({
            "id": shock_id, "labelDa": labels[shock_id], "scenario": f"{shock_id}_ufin",
            "dreamFile": dream_path.name, "solved": solved,
            "scale": None if scale is None else round(scale, 4), "scaleNoteDa": scale_note, "noteDa": note,
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
            "baselineDa": "kalibreringspunktet i Model/deep_dynamic_calibration.zip (etl/shock_gdx/_reference.gdx)",
            "levelGapPct": gap,
        },
        "series": [{"key": key, "labelDa": label, "unitDa": unit} for key, label, unit in SERIES],
        "shocks": shocks,
    }
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {args.out} ({len(shocks)} shocks, {len(files)} DREAM files)")


if __name__ == "__main__":
    main()
