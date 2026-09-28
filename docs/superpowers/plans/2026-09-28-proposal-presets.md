# Proposal presets (Pakker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /pakke/ offers named, published policy proposals, sized from the Finance Ministry's own figures by one published method, each checked against a joint model solve, with a method note at /pakke/metode/.

**Architecture:** Proposals are verbatim source figures in `app/src/lib/proposals.ts`; a pure function turns them into a package (catalog shocks + scales) using per-shock static saldo effects and sizing data that the ETL writes into meta.json from `_reference.gdx`. The same package query drives a new `freesolver solve-export --package` joint solve; `etl/proposals_check.py` compares that solve with the linear sum and writes `static/data/proposals.json`, which gates which presets the page lists.

**Tech Stack:** Python 3 (uv, gams.transfer, numpy, pytest) in `etl/`; SvelteKit 2 / Svelte 5 runes, TypeScript, vitest, bun in `app/`; bash on the compute box (`cloud/`).

**Spec:** `docs/superpowers/specs/2026-09-28-proposal-presets-design.md` (read it first).

## Global Constraints

- Danish-first UI copy; MAKRO teal #14AFA6 is UI-only, never a chart series colour.
- Scales are never typed by hand: every scale comes from `proposalPackage()`.
- The `Proposal` type has no per-proposal override field (no manual scale, wording, headline set).
- Sign convention everywhere: static saldo effect, positive = strengthens the public balance.
- Presets open unfinanced (`variant=_ufin`); financing is the proposal's own rows.
- A preset ships only when its joint solve's max relative gap to the linear sum is ≤ 0.10 on qBNP, nL, saldo2bnp, qC, vhW over 2030–2060.
- Full-horizon solves only on the box (`nodalit`), sequential, launched with `setsid nohup`; never two at once; box time needs the owner's go-ahead.
- Solver runs use `--from-year 2030 --shock-years 2030-2129`.
- Commit only with the owner's go-ahead (repo profile is conservative); each task's commit step is "stage and propose the commit" unless the owner has said to commit. Commit style: descriptive body, `Claude-Session` trailer, issue id `makroskop-48o` in the subject.
- ETL tests: `cd etl && uv run --with pytest pytest tests`. App tests: `cd app && bun run test`. App types: `cd app && bun run check`.

## Review Focus

1. Two elements of one proposal on the same shock (mellem/top/toptop → Topskat): their scales must be summed into one package row, and the card must still list each element's chain — test in Task 4.
2. A package whose members overlap on instruments (Offentligt_forbrug and Offentlig_varekoeb both move `qR(off,*)`): the joint solve must add the increments, and an overlapping endogenize member must be refused — test in Task 3.
3. A reader who edits a preset (changes one scale, removes the structural row, flips the closure): the page must stop calling it the proposal, in the card, the share link and the exports — test in Task 9.
4. A proposal whose joint solve is missing or older than its current query (figures revised after the solve): it must not be listed or prerendered — test in Task 8.
5. A price year outside the sizing table (e.g. 2021 figures): conversion must report a problem, not produce NaN scales — test in Task 4.

---

### Task 1: Catalog: Topskat and Beskæftigelsesfradrag shocks

**Files:**
- Modify: `etl/catalog.py` (SHOCKS list near line 126; SHOCK_RUNS after the AM_bidrag run near line 279)
- Test: `etl/tests/test_shock_stamp.py`

**Interfaces:**
- Produces: catalog shock names `"Topskat"` (solver `tTop`, delta 0.01) and `"Beskaeftigelsesfradrag"` (solver `tBeskFradrag`, delta 0.01), used by Tasks 2, 3, 6, 7.

- [ ] **Step 1: Write the failing test** — append to `etl/tests/test_shock_stamp.py`:

```python
def test_the_income_tax_steps_are_catalogued_as_rate_deltas() -> None:
    top = catalog.expected_stamp("Topskat", "_ufin", LAST)
    assert (top["shock"], top["factor"], top["delta"]) == ("tTop", 1.0, 0.01)
    fradrag = catalog.expected_stamp("Beskaeftigelsesfradrag", "_perm", LAST)
    assert (fradrag["shock"], fradrag["delta"], fradrag["closure"]) == ("tBeskFradrag", 0.01, "tax-reaction")
    names = [s.name for s in catalog.SHOCKS]
    assert names.index("Topskat") == names.index("Bundskat") + 1
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd etl && uv run --with pytest pytest tests/test_shock_stamp.py -k income_tax_steps -v`
Expected: FAIL (`expected_stamp` returns None → TypeError).

- [ ] **Step 3: Implement** — in `SHOCKS`, directly after the Bundskat entry:

```python
    ShockDef("Topskat", "Topskat", "Top-bracket income tax", "Skatter og afgifter"),
    ShockDef("Beskaeftigelsesfradrag", "Beskæftigelsesfradrag", "Earned income tax credit", "Skatter og afgifter"),
```

and after the AM_bidrag `ShockRun`:

```python
    # makroskop-48o: the instruments of the personal income tax proposals. MAKRO June 2026 has one
    # working topskat step: tMellem and tTopTop are set from 2026, but their bases rMellemSkatInd and
    # rTopTopSkatInd are zero (GovRevenues.gms:826), so shocking them moves nothing.
    ShockRun("Topskat", "tTop", "Topskattesats", 1.0, 0.01, "+1 pct.-point", 2030,
             "DREAM har intet standardstød på topskatten; MAKROskop hæver satsen med 1 pct.-point. I denne "
             "udgave af MAKRO er topskatten ét trin (15 pct. af indkomsten over topskattegrænsen); mellem- "
             "og toptopskatten har endnu ikke data i modellen.",
             channel=("qC>qBNP>nL>ledighedsgrad>vhW>qX", "pBolig>qI>qBNP", "saldo2bnp")),
    ShockRun("Beskaeftigelsesfradrag", "tBeskFradrag", "Beskæftigelsesfradrag, sats af lønindkomsten",
             1.0, 0.01, "+1 pct.-point", 2030,
             "DREAM har intet standardstød på beskæftigelsesfradraget; MAKROskop hæver fradragets sats "
             "(ca. 7,4 pct. af lønindkomsten) med 1 pct.-point. Fradraget trækkes fra den skattepligtige "
             "indkomst og er derfor værd som kommune- og kirkeskatten; det indgår ikke i MAKROs marginalskat.",
             channel=("qC>qBNP>nL>ledighedsgrad>vhW>qX", "pBolig>qI>qBNP", "saldo2bnp")),
```

(No explainers yet: they are written from the solved results in Task 11, as for every other run.)

- [ ] **Step 4: Run the whole ETL suite**

Run: `cd etl && uv run --with pytest pytest tests -q`
Expected: all pass (test_change_display words both as "+1 pct.-point"; test_channel checks the chains).

- [ ] **Step 5: Stage and propose the commit**

```bash
git add etl/catalog.py etl/tests/test_shock_stamp.py
# proposed: git commit -m "Catalog: Topskat and Beskæftigelsesfradrag shocks (makroskop-48o)"
```

---

### Task 2: Static saldo effects and sizing in meta.json

**Files:**
- Create: `etl/static_saldo.py`
- Create: `etl/tests/test_static_saldo.py`
- Modify: `etl/extract.py` (`main`, around lines 406–460)
- Modify: `app/src/lib/data.ts` (`Meta` interface)

**Interfaces:**
- Consumes: `catalog.SHOCK_RUNS` (Task 1 names).
- Produces: `static_saldo.STATIC_SALDO: dict[str, Callable[[Reference], float]]`, `static_saldo.all_static(ref) -> dict[str, float]`, `static_saldo.GdxReference(container)`; meta.json key `sizing` = `{"year": 2030, "vBNP": {"2022": float, …, "2030": float}, "snL2030": float, "staticSaldoPct": {shock: float}}`; TS type `Sizing` exported from `app/src/lib/data.ts` and `Meta.sizing?: Sizing`.

- [ ] **Step 1: Write the failing test** — `etl/tests/test_static_saldo.py`:

```python
"""Static saldo effects at ×1 (makroskop-48o): hand calculations from reference-like values."""

import pytest

import static_saldo as ss


class FakeReference:
    def __init__(self, values: dict[tuple[str, ...], float]) -> None:
        self.values = values

    def value(self, symbol: str, *keys: str) -> float:
        return self.values[(symbol, *keys)]


REF = FakeReference({
    ("vBNP", "2030"): 2747.2,
    ("tBund", "2030"): 0.1201, ("vtBund", "tot", "2030"): 175.49,
    ("tTop", "2030"): 0.15, ("vtTop", "tot", "2030"): 22.75,
    ("tAMbidrag", "2030"): 0.08, ("vtHhAM", "tot", "2030"): 110.0,
    ("tBeskFradrag", "2030"): 0.0744, ("vBeskFradrag", "tot", "2030"): 113.25,
    ("tKommune", "2030"): 0.2497, ("ftKommune", "tot", "2030"): 0.98,
    ("tKirke", "2030"): 0.0087, ("ftKirke", "2030"): 1.0, ("rtKirke", "2030"): 0.697,
    ("vR", "off", "2030"): 233.1, ("vE", "off", "2030"): 12.22,
    ("vLoensum", "off", "2030"): 419.26, ("vI_s", "iTot", "off", "2030"): 103.11,
})


def test_a_rate_tax_is_its_revenue_times_the_relative_rate_change() -> None:
    assert ss.STATIC_SALDO["Bundskat"](REF) == pytest.approx(175.49 * 0.01 / 0.1201 / 2747.2 * 100)
    assert ss.STATIC_SALDO["Topskat"](REF) == pytest.approx(22.75 * 0.01 / 0.15 / 2747.2 * 100)


def test_a_higher_fradrag_costs_its_kommune_and_kirke_value() -> None:
    value = 0.2497 * 0.98 + 0.0087 * 1.0 * 0.697
    expected = -113.25 * 0.01 / 0.0744 * value / 2747.2 * 100
    assert ss.STATIC_SALDO["Beskaeftigelsesfradrag"](REF) == pytest.approx(expected)
    assert expected < 0


def test_more_public_consumption_costs_one_pct_of_its_inputs() -> None:
    expected = -0.01 * (233.1 + 12.22 + 419.26 + 103.11) / 2747.2 * 100
    assert ss.STATIC_SALDO["Offentligt_forbrug"](REF) == pytest.approx(expected)
    assert ss.STATIC_SALDO["Offentlig_Beskaeftigelse"](REF) == pytest.approx(-0.01 * 419.26 / 2747.2 * 100)


def test_every_formula_is_a_catalogued_shock_and_nonfiscal_shocks_have_none() -> None:
    import catalog
    names = {r.shock for r in catalog.SHOCK_RUNS}
    assert set(ss.STATIC_SALDO) <= names
    assert "Rente" not in ss.STATIC_SALDO
    assert set(ss.all_static(REF)) == set(ss.STATIC_SALDO)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd etl && uv run --with pytest pytest tests/test_static_saldo.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'static_saldo'`.

- [ ] **Step 3: Implement** — `etl/static_saldo.py`:

```python
"""Static saldo effect of a fiscal catalog shock at ×1 (makroskop-48o).

The change in the public balance before any behaviour, in pct. of 2030 GDP, positive when it
strengthens the balance. A proposal's Finance Ministry figure (umiddelbar provenuvirkning, same sign)
divided by this number is the scale of that shock in the package. Formulas follow the revenue
equations in MAKRO's GovRevenues.gms; only shocks a published preset needs have one.
"""

from typing import Callable, Protocol

import catalog

YEAR = "2030"


class Reference(Protocol):
    def value(self, symbol: str, *keys: str) -> float: ...


class GdxReference:
    """Reads single records from the solver reference (_reference.gdx)."""

    def __init__(self, container) -> None:
        self.container = container

    def value(self, symbol: str, *keys: str) -> float:
        records = self.container[symbol].records
        mask = None
        for position, key in enumerate(keys):
            column = records.iloc[:, position].astype(str) == key
            mask = column if mask is None else (mask & column)
        selected = records if mask is None else records[mask]
        if len(selected) != 1:
            raise KeyError(f"{symbol}{keys}: {len(selected)} records")
        row = selected.iloc[0]
        return float(row["level"] if "level" in selected.columns else row["value"])


def _run(shock: str) -> catalog.ShockRun:
    return next(r for r in catalog.SHOCK_RUNS if r.shock == shock)


def _relative_change(ref: Reference, shock: str, rate: str) -> float:
    """(t_new − t_ref) / t_ref for a rate instrument shocked by the catalog's factor and delta."""
    run = _run(shock)
    t = ref.value(rate, YEAR)
    return (t * run.factor + run.delta) / t - 1


def _pct_of_gdp(ref: Reference, amount: float) -> float:
    return amount / ref.value("vBNP", YEAR) * 100


def _rate_tax(shock: str, rate: str, revenue: str) -> Callable[[Reference], float]:
    """vtX = tX · base (GovRevenues.gms), so the static revenue is vtX · Δt/t."""
    return lambda ref: _pct_of_gdp(ref, ref.value(revenue, "tot", YEAR) * _relative_change(ref, shock, rate))


def _beskaeftigelsesfradrag(ref: Reference) -> float:
    """vBeskFradrag = tBeskFradrag · vWHh is deducted from vSkatteplInd (GovRevenues.gms:462,499),
    so it is worth the kommune- and kirkeskat on it (:298, :433)."""
    fradrag = ref.value("vBeskFradrag", "tot", YEAR) * _relative_change(ref, "Beskaeftigelsesfradrag", "tBeskFradrag")
    worth = (ref.value("tKommune", YEAR) * ref.value("ftKommune", "tot", YEAR)
             + ref.value("tKirke", YEAR) * ref.value("ftKirke", YEAR) * ref.value("rtKirke", YEAR))
    return _pct_of_gdp(ref, -fradrag * worth)


def _spending(shock: str, *inputs: tuple[str, ...]) -> Callable[[Reference], float]:
    """A factor on public inputs costs (factor − 1) of their nominal value."""
    def formula(ref: Reference) -> float:
        cost = sum(ref.value(symbol, *keys, YEAR) for symbol, *keys in inputs)
        return _pct_of_gdp(ref, -(_run(shock).factor - 1) * cost)
    return formula


STATIC_SALDO: dict[str, Callable[[Reference], float]] = {
    "Bundskat": _rate_tax("Bundskat", "tBund", "vtBund"),
    "Topskat": _rate_tax("Topskat", "tTop", "vtTop"),
    "AM_bidrag": _rate_tax("AM_bidrag", "tAMbidrag", "vtHhAM"),
    "Beskaeftigelsesfradrag": _beskaeftigelsesfradrag,
    "Offentligt_forbrug": _spending("Offentligt_forbrug", ("vR", "off"), ("vE", "off"), ("vLoensum", "off"),
                                    ("vI_s", "iTot", "off")),
    "Offentlig_varekoeb": _spending("Offentlig_varekoeb", ("vR", "off")),
    "Offentlig_Beskaeftigelse": _spending("Offentlig_Beskaeftigelse", ("vLoensum", "off")),
}


def all_static(ref: Reference) -> dict[str, float]:
    return {shock: formula(ref) for shock, formula in STATIC_SALDO.items()}
```

Before running, confirm the AM-bidrag symbols exist in the reference (`vtHhAM(tot,2030)`, `tAMbidrag(2030)`) with a one-off `GdxReference(open_gdx(Path("shock_gdx/_reference.gdx"))).value("vtHhAM","tot","2030")`; if a key differs, fix the formula, not the test values.

- [ ] **Step 4: Run the test**

Run: `cd etl && uv run --with pytest pytest tests/test_static_saldo.py -v`
Expected: PASS.

- [ ] **Step 5: Wire it into extract.py** — in `main()`, after `shock_reference = extract_detrended(...)`:

```python
        reference_container = open_gdx(reference_path)
        shock_reference = extract_detrended(reference_container, factors)
        sizing = build_sizing(reference_container, shock_reference, factors)
    else:
        shock_reference = detrended
        sizing = None
```

(replace the existing two-line `if/else`), add near `lukning_share`:

```python
SIZING_YEARS = range(2022, 2031)


def build_sizing(reference: gt.Container, detrended: dict[str, dict[int, float]],
                 factors: dict[str, dict[int, float]]) -> dict:
    """What proposal presets are sized with (makroskop-48o): nominal GDP in mia. kr. by price year,
    structural employment in 2030 (1.000 persons) and each fiscal shock's static saldo effect at ×1."""
    vbnp = apply_trend(detrended["vBNP"], "fvt", factors)
    return {
        "year": 2030,
        "vBNP": {str(year): sig_round(vbnp[year]) for year in SIZING_YEARS},
        "snL2030": sig_round(detrended["snL"][2030]),
        "staticSaldoPct": {k: sig_round(v) for k, v in static_saldo.all_static(static_saldo.GdxReference(reference)).items()},
    }
```

(`import static_saldo` at the top), and before writing meta.json:

```python
    meta = build_meta(baseline, args.makro_root, available)
    if sizing is not None:
        meta["sizing"] = sizing
    (args.out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
```

- [ ] **Step 6: TS type** — in `app/src/lib/data.ts` add and reference it from `Meta`:

```ts
/** Proposal sizing from the solver reference (etl/extract.py build_sizing, makroskop-48o). */
export interface Sizing {
	year: number;
	/** Nominal GDP in mia. kr. by year (price years of the Finance Ministry's figures). */
	vBNP: Record<string, number>;
	/** Structural employment in 2030, 1.000 persons. */
	snL2030: number;
	/** Static saldo effect of each fiscal shock at ×1, pct. of 2030 GDP, positive = strengthens. */
	staticSaldoPct: Record<string, number>;
}
```

and in `Meta`: `sizing?: Sizing;`

- [ ] **Step 7: Run the ETL and the guards**

Run: `cd etl && uv run python extract.py && cd ../app && bun run test && bun run check`
Expected: meta.json gains `sizing` with `staticSaldoPct.Topskat` ≈ 0.055 and `Bundskat` ≈ 0.53; no other data file changes (`git diff --stat app/static/data` shows only meta.json). If the open-data guard test fails on meta.json, run `bun run data:release --changelog "meta.json: sizing for proposal presets (makroskop-48o)"` and rerun.

- [ ] **Step 8: Stage and propose the commit**

```bash
git add etl/static_saldo.py etl/tests/test_static_saldo.py etl/extract.py app/src/lib/data.ts app/static/data/meta.json app/static/data/udgivelse.json
# proposed: git commit -m "ETL: static saldo effects and proposal sizing in meta.json (makroskop-48o)"
```

---

### Task 3: freesolver `--package` joint solve

**Files:**
- Modify: `etl/freesolver.py` (`cmd_solve_export` lines 584–660; `main` argparse ~2079 and dispatch ~2139)
- Create: `etl/tests/test_package_solve.py`

**Interfaces:**
- Consumes: `catalog.SHOCK_RUNS` fields `shock`, `solver_shock`, `instrument`, `factor`, `delta`, `endogenize`.
- Produces: `freesolver.package_members(query: str) -> list[PackageMember]`, `freesolver.package_targets(convert_dir, system_like, members, years, profile) -> tuple[np.ndarray, np.ndarray]`; CLI `solve-export --package "<query>"`; GDX stamp key `package` (the query exactly as passed) with `shock` = `"package"`.

- [ ] **Step 1: Write the failing tests** — `etl/tests/test_package_solve.py`:

```python
"""solve-export --package: a /pakke/ query solved as one run (makroskop-48o)."""

from pathlib import Path

import numpy as np
import pytest

import freesolver as fs

DICT_TXT = """CNS written by GAMS Convert
Equations 1 to 1
  e1  E_a(2030)
Variables 1 to 6
  x1  tBund(2030)
  x2  tTop(2030)
  x3  qR(off,2030)
  x4  qE(off,2030)
  x5  hL(off,2030)
  x6  qI_s(bygningsinv,off,2030)
"""
LEVELS = np.array([0.12, 0.15, 200.0, 10.0, 400.0, 100.0])


class FakeSystem:
    def __init__(self) -> None:
        self.levels = LEVELS.copy()
        self.is_fixed = np.ones(len(LEVELS), dtype=bool)

    def swap(self, fix_ids, free_ids) -> None:
        raise AssertionError("no swap expected")


def convert_dir(tmp_path: Path) -> Path:
    (tmp_path / "dict.txt").write_text(DICT_TXT, encoding="utf-8")
    return tmp_path


def test_members_come_from_the_catalog_in_query_order() -> None:
    members = fs.package_members("Topskat=-0.8&Bundskat=0.5")
    assert [(m.name, m.solver_shock, m.delta, m.scale) for m in members] == [
        ("Topskat", "tTop", 0.01, -0.8), ("Bundskat", "tBund", 0.01, 0.5)]


@pytest.mark.parametrize("query", ["", "Momsx=1", "Bundskat=abc", "Bundskat=0", "Bundskat=1&Bundskat=2",
                                   "Bundskat=1&variant=_ufin"])
def test_bad_queries_are_refused(query: str) -> None:
    with pytest.raises(SystemExit):
        fs.package_members(query)


def test_targets_scale_each_member_by_its_weight(tmp_path: Path) -> None:
    members = fs.package_members("Bundskat=-2&Topskat=0.5")
    ids, targets = fs.package_targets(convert_dir(tmp_path), FakeSystem(), members, (2030, 2030), "permanent")
    got = dict(zip(ids.tolist(), targets.tolist()))
    assert got[0] == pytest.approx(0.12 - 0.02)
    assert got[1] == pytest.approx(0.15 + 0.005)


def test_overlapping_members_add_their_increments(tmp_path: Path) -> None:
    members = fs.package_members("Offentligt_forbrug=1&Offentlig_varekoeb=-0.5")
    ids, targets = fs.package_targets(convert_dir(tmp_path), FakeSystem(), members, (2030, 2030), "permanent")
    got = dict(zip(ids.tolist(), targets.tolist()))
    assert got[2] == pytest.approx(200.0 * (1 + 0.01 - 0.005))  # qR(off): both members
    assert got[4] == pytest.approx(400.0 * 1.01)                 # hL(off): Offentligt_forbrug only
    assert len(ids) == len(set(ids.tolist()))


def test_a_swap_member_may_not_overlap_another(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    members = [fs.PackageMember("A", "tBund", 1.0, 0.01, "uDeltag", 1.0),
               fs.PackageMember("B", "tBund", 1.0, 0.01, "", 1.0)]
    monkeypatch.setattr(fs, "find_swap_pairs", lambda d, matched, endo: [(v, v + 100, y) for v, y in matched])

    class SwapSystem(FakeSystem):
        def swap(self, fix_ids, free_ids) -> None:
            pass

    with pytest.raises(SystemExit, match="overlap"):
        fs.package_targets(convert_dir(tmp_path), SwapSystem(), members, (2030, 2030), "permanent")
```

- [ ] **Step 2: Run to verify failure**

Run: `cd etl && uv run --with pytest pytest tests/test_package_solve.py -v`
Expected: FAIL (`AttributeError: module 'freesolver' has no attribute 'package_members'`).

- [ ] **Step 3: Implement** — in `freesolver.py`, next to `bundle_instances`:

```python
@dataclass(frozen=True)
class PackageMember:
    """One catalog shock of a /pakke/ query, as solve-export --package applies it (makroskop-48o)."""
    name: str
    solver_shock: str
    factor: float
    delta: float
    endogenize: str
    scale: float


def package_members(query: str) -> list[PackageMember]:
    """'Topskat=-0.8&Offentligt_forbrug=-0.3' → the catalog runs with their scales, in query order.
    The closure is solve-export's --closure, so a 'variant' parameter is refused rather than ignored."""
    from urllib.parse import parse_qsl
    import catalog

    members: list[PackageMember] = []
    for name, raw in parse_qsl(query, keep_blank_values=True):
        if name == "variant":
            raise SystemExit("--package: pass the closure with --closure, not variant=")
        run = next((r for r in catalog.SHOCK_RUNS if r.shock == name), None)
        if run is None:
            raise SystemExit(f"--package: {name!r} is not a catalog shock")
        try:
            scale = float(raw)
        except ValueError:
            raise SystemExit(f"--package: {name}={raw!r} is not a number") from None
        if not math.isfinite(scale) or scale == 0:
            raise SystemExit(f"--package: {name} needs a finite, non-zero scale")
        if any(m.name == name for m in members):
            raise SystemExit(f"--package: {name} appears twice")
        members.append(PackageMember(name, run.solver_shock or run.instrument, run.factor, run.delta,
                                     run.endogenize, scale))
    if not members:
        raise SystemExit("--package is empty")
    return members


def package_targets(convert_dir: Path, system, members: list[PackageMember],
                    years: tuple[int, int] | None, profile: str) -> tuple[np.ndarray, np.ndarray]:
    """Shock variable ids and targets for a whole package. Each member moves its instances by
    level·(factor−1)·w + delta·w with w = profile weight × bundle weight × scale — the rule a single
    run uses at weight 1 — and members that share an instance add their increments (the package is
    a linear combination of instruments). Exo/endo swaps are applied here; a swapped member may not
    share instances with any other member."""
    increments: dict[int, float] = {}
    owner: dict[int, str] = {}
    for member in members:
        matched, bundle_scale = bundle_instances(convert_dir, member.solver_shock, years, system.levels)
        if member.endogenize:
            pairs = find_swap_pairs(convert_dir, matched, member.endogenize)
            system.swap(np.array([s for s, _, _ in pairs]), np.array([e for _, e, _ in pairs]))
            matched = [(s, year) for s, _, year in pairs]
        first_year = min(year for _, year in matched)
        for var_id, year in matched:
            if var_id in owner and (member.endogenize or _run_endogenizes(members, owner[var_id])):
                raise SystemExit(f"--package: {member.name} and {owner[var_id]} overlap on a swapped instance")
            if not system.is_fixed[var_id]:
                continue  # aggregates of a symbol-level shock (e.g. nPop), as in the single-run path
            w = profile_weight(profile, year - first_year) * bundle_scale.get(var_id, 1.0) * member.scale
            level = system.levels[var_id]
            increments[var_id] = increments.get(var_id, 0.0) + level * (member.factor - 1.0) * w + member.delta * w
            owner.setdefault(var_id, member.name)
    if not increments:
        raise SystemExit("--package: no exogenous instance to shock")
    ids = np.array(sorted(increments))
    return ids, system.levels[ids] + np.array([increments[i] for i in ids])


def _run_endogenizes(members: list[PackageMember], name: str) -> bool:
    return any(m.name == name and m.endogenize for m in members)
```

Note: a swapped member's instances are fixed *by* the swap (`system.swap` flips `is_fixed`), so the `is_fixed` filter keeps them. Check `from dataclasses import dataclass` and `import math` are already imported at the top of `freesolver.py`; add them if not.

Then in `cmd_solve_export`, add a `package: str = ""` parameter and replace the block from `matched, scale = bundle_instances(...)` down to the `print(f"shock: ...")` line with:

```python
    if package:
        members = package_members(package)
        shock_vars, targets = package_targets(convert_dir, system, members, shock_years, shock_profile)
        print(f"shock: package {package} x {len(shock_vars)} instances (years {shock_years})", flush=True)
    else:
        shock_vars, targets = single_shock_targets(convert_dir, system, shock_name, shock_years,
                                                   shock_factor, shock_delta, shock_profile, endogenize)
    extra = tax_reaction_closure(system, convert_dir, from_year) if closure == "tax-reaction" else None
    window = Window(system, convert_dir, from_year, extra)
    print(f"window: {len(window.eq_sel):,} equations ({window.n_years} years)")
```

where `single_shock_targets` is today's code moved verbatim into a function (bundle_instances, swap, weights, `fixed_ok` filtering, `targets = levels * (1.0 + (shock_factor - 1.0) * weights) + shock_delta * weights`, the `shock:` print) returning `(shock_vars, targets)`. The `Window` must still be built after the swap, which this order keeps. In `meta`, set:

```python
        "shock": "package" if package else shock_name,
        "package": package,
```

- [ ] **Step 4: CLI** — add to argparse:

```python
    parser.add_argument("--package", default="",
                        help="solve-export: a /pakke/ query 'Topskat=-0.8&Offentligt_forbrug=-0.3' solved as "
                             "one run (catalog runs, scales as weights; makroskop-48o). Use with --shock-years.")
```

and pass `package=parsed.package` into `cmd_solve_export`. Refuse `--package` together with `--shock-name` (`SystemExit`).

- [ ] **Step 5: Run unit tests**

Run: `cd etl && uv run --with pytest pytest tests -q`
Expected: all pass, including `test_bundle_weights.py`, `test_swap.py`, `test_closure.py` unchanged.

- [ ] **Step 6: Equivalence check on a 12-year window (laptop, ~3 min each)**

```bash
cd etl
uv run python freesolver.py solve-export --from-year 2118 --shock-name tBund --shock-years 2118-2129 --shock-delta 0.01 --out cache/pkg_a.gdx
uv run python freesolver.py solve-export --from-year 2118 --package "Bundskat=1" --shock-years 2118-2129 --out cache/pkg_b.gdx
uv run python compare_gdx.py cache/pkg_a.gdx cache/pkg_b.gdx
```

Expected: every symbol agrees to ≤ 1e-11 relative. Then one swap member: `--package "Arbejdsudbud_beskaeftigelse=0.5"` vs `--shock-name snLHh --endogenize uDeltag --shock-factor 1.005` — same agreement. Watch RSS (16 GB laptop): run in the foreground and stop if swap grows.

- [ ] **Step 7: Stage and propose the commit**

```bash
git add etl/freesolver.py etl/tests/test_package_solve.py
# proposed: git commit -m "freesolver: solve-export --package solves a /pakke/ query as one run (makroskop-48o)"
```

---

### Task 4: Proposal conversion logic (`proposal.ts`)

**Files:**
- Create: `app/src/lib/proposal.ts`
- Create: `app/src/lib/proposal.test.ts`

**Interfaces:**
- Consumes: `Sizing` (Task 2), `PackageComponent`, `packageQuery` from `./package`, `formatSigned`, `formatValue` from `./format`.
- Produces (exact names used by Tasks 5, 6, 8, 9, 10):

```ts
export type ProposalStatus = 'vedtaget' | 'forslag';
export interface ProposalSource { labelDa: string; url: string }
export interface ProposalElement { shock: string; labelDa: string; kr: number; priceYear: number; source: number; mappedDa?: string }
export interface Proposal {
	id: string; titleDa: string; proposerDa: string; status: ProposalStatus; date: string;
	sources: ProposalSource[]; elements: ProposalElement[];
	structural: { fte: number; source: number } | null;
	financing: ProposalElement[]; omittedDa: string[];
	revisions: { date: string; noteDa: string }[];
}
export interface ChainRow { role: 'element' | 'financing' | 'structural'; shock: string; labelDa: string;
	kr: number | null; priceYear: number | null; gdpPct: number | null; fte: number | null; scale: number; mappedDa?: string }
export interface ProposalPackage { components: PackageComponent[]; chain: ChainRow[]; problems: string[] }
export const STRUCTURAL_SHOCK = 'Arbejdsudbud_beskaeftigelse';
export const PROPOSAL_VARIANT = '_ufin';
export const PROPOSAL_KEYS: readonly string[];
export function proposalPackage(p: Proposal, sizing: Sizing): ProposalPackage;
export function proposalQuery(p: Proposal, sizing: Sizing): string;       // packageQuery(components, '_ufin')
export function chainLineDa(row: ChainRow): string;
export function verificationLineDa(maxGapPct: number): string;
export function statusDa(status: ProposalStatus): string;
```

- [ ] **Step 1: Write the failing tests** — `app/src/lib/proposal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Sizing } from './data';
import {
	PROPOSAL_KEYS, chainLineDa, proposalPackage, proposalQuery, verificationLineDa, type Proposal
} from './proposal';

const SIZING: Sizing = {
	year: 2030,
	vBNP: { '2024': 2800, '2025': 2900 },
	snL2030: 3000,
	staticSaldoPct: { Topskat: 0.05, Bundskat: 0.5, Offentligt_forbrug: -0.25 }
};

const BASE: Proposal = {
	id: 'test', titleDa: 'Testforslag', proposerDa: 'Regeringen', status: 'forslag', date: '2025-01-01',
	sources: [{ labelDa: 'Aftaletekst', url: 'https://fm.dk/a' }],
	elements: [{ shock: 'Topskat', labelDa: 'Lavere topskat', kr: -2.9, priceYear: 2025, source: 0 }],
	structural: { fte: 3000, source: 0 },
	financing: [{ shock: 'Offentligt_forbrug', labelDa: 'Mindre offentligt forbrug', kr: 2.9, priceYear: 2025, source: 0 }],
	omittedDa: [], revisions: []
};

describe('proposalPackage', () => {
	it('sizes each row by its static saldo effect in pct. of GDP', () => {
		const pkg = proposalPackage(BASE, SIZING);
		expect(pkg.problems).toEqual([]);
		// −2,9 mia. kr. of 2.900 = −0,1 pct. of GDP; Topskat ×1 = +0,05 → ×−2
		expect(pkg.components).toEqual([
			{ name: 'Topskat', scale: -2 },
			{ name: 'Arbejdsudbud_beskaeftigelse', scale: 0.1 },
			{ name: 'Offentligt_forbrug', scale: -0.4 }
		]);
	});
	it('sums elements that land on the same shock and keeps each in the chain', () => {
		const p: Proposal = { ...BASE, elements: [
			{ shock: 'Topskat', labelDa: 'Mellemskat', kr: 1.45, priceYear: 2025, source: 0, mappedDa: 'Mellemskatten regnes som topskat' },
			{ shock: 'Topskat', labelDa: 'Topskat', kr: -4.35, priceYear: 2025, source: 0 }
		] };
		const pkg = proposalPackage(p, SIZING);
		expect(pkg.components.filter((c) => c.name === 'Topskat')).toEqual([{ name: 'Topskat', scale: -2 }]);
		expect(pkg.chain.filter((r) => r.shock === 'Topskat').map((r) => r.scale)).toEqual([1, -3]);
	});
	it('reports problems instead of producing NaN scales', () => {
		const p: Proposal = { ...BASE, structural: null, elements: [
			{ shock: 'Rente', labelDa: 'Rente', kr: 1, priceYear: 2025, source: 0 },
			{ shock: 'Topskat', labelDa: 'Topskat', kr: 1, priceYear: 2021, source: 0 },
			{ shock: 'Topskat', labelDa: 'Topskat', kr: 1, priceYear: 2025, source: 3 }
		] };
		const { problems, components } = proposalPackage(p, SIZING);
		expect(problems).toHaveLength(4);
		expect(components.every((c) => Number.isFinite(c.scale))).toBe(true);
	});
	it('drops a zero structural estimate without a row', () => {
		const pkg = proposalPackage({ ...BASE, structural: { fte: 0, source: 0 } }, SIZING);
		expect(pkg.components.map((c) => c.name)).not.toContain('Arbejdsudbud_beskaeftigelse');
		expect(pkg.problems).toEqual([]);
	});
});

describe('proposalQuery', () => {
	it('is the package query, unfinanced', () => {
		expect(proposalQuery(BASE, SIZING)).toBe('Topskat=-2&Arbejdsudbud_beskaeftigelse=0.1&Offentligt_forbrug=-0.4&variant=_ufin');
	});
});

describe('card text', () => {
	it('words the conversion chain', () => {
		const [row] = proposalPackage(BASE, SIZING).chain;
		expect(chainLineDa(row)).toBe('Lavere topskat: −2,9 mia. kr. (2025) = −0,1 pct. af BNP → Topskat ×−2');
	});
	it('words the structural row', () => {
		const row = proposalPackage(BASE, SIZING).chain.find((r) => r.role === 'structural')!;
		expect(chainLineDa(row)).toBe('Strukturel virkning – Finansministeriets skøn: +3.000 fuldtidspersoner → Arbejdsudbud ×0,1');
	});
	it('words the verification gap', () => {
		expect(verificationLineDa(1.84)).toBe('Den lineære sum afviger højst 1,8 pct. fra en samlet modelkørsel af hele forslaget.');
	});
});

describe('PROPOSAL_KEYS', () => {
	it('is exactly the Proposal fields: no per-proposal override can sneak in', () => {
		expect([...PROPOSAL_KEYS].sort()).toEqual(Object.keys(BASE).sort());
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && bunx vitest run src/lib/proposal.test.ts`
Expected: FAIL (cannot resolve `./proposal`).

- [ ] **Step 3: Implement** — `app/src/lib/proposal.ts`:

```ts
/** Proposal presets (makroskop-48o): a published proposal's Finance Ministry figures turned into a
 *  package by one method for every proposal — see docs/superpowers/specs/2026-09-28-proposal-presets-design.md.
 *  kr is the static saldo effect in mia. kr. in the price year, positive = strengthens the balance. */

import type { Sizing } from './data';
import { formatSigned, formatValue } from './format';
import { formatScale, packageQuery, type PackageComponent } from './package';

export type ProposalStatus = 'vedtaget' | 'forslag';
export interface ProposalSource { labelDa: string; url: string }
export interface ProposalElement {
	shock: string;
	labelDa: string;
	kr: number;
	priceYear: number;
	/** Index into Proposal.sources. */
	source: number;
	/** Set when MAKRO lacks the element's own instrument and it is regnet on the nearest one. */
	mappedDa?: string;
}
export interface Proposal {
	id: string;
	titleDa: string;
	proposerDa: string;
	status: ProposalStatus;
	date: string;
	sources: ProposalSource[];
	elements: ProposalElement[];
	structural: { fte: number; source: number } | null;
	financing: ProposalElement[];
	omittedDa: string[];
	revisions: { date: string; noteDa: string }[];
}
export const PROPOSAL_KEYS: readonly string[] = [
	'id', 'titleDa', 'proposerDa', 'status', 'date', 'sources', 'elements', 'structural', 'financing',
	'omittedDa', 'revisions'
];

export interface ChainRow {
	role: 'element' | 'financing' | 'structural';
	shock: string;
	labelDa: string;
	kr: number | null;
	priceYear: number | null;
	gdpPct: number | null;
	fte: number | null;
	scale: number;
	mappedDa?: string;
}
export interface ProposalPackage { components: PackageComponent[]; chain: ChainRow[]; problems: string[] }

export const STRUCTURAL_SHOCK = 'Arbejdsudbud_beskaeftigelse';
export const PROPOSAL_VARIANT = '_ufin';

/** Scales are rounded to 4 decimals, so a query is stable and readable. */
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function proposalPackage(p: Proposal, sizing: Sizing): ProposalPackage {
	const problems: string[] = [];
	const chain: ChainRow[] = [];
	const sourceOk = (i: number, what: string) => {
		if (!Number.isInteger(i) || i < 0 || i >= p.sources.length) problems.push(`${what}: ukendt kilde ${i}`);
	};
	const sizeRow = (e: ProposalElement, role: 'element' | 'financing') => {
		sourceOk(e.source, e.labelDa);
		const gdp = sizing.vBNP[String(e.priceYear)];
		const unit = sizing.staticSaldoPct[e.shock];
		if (gdp == null) problems.push(`${e.labelDa}: prisår ${e.priceYear} findes ikke i BNP-tabellen`);
		if (unit == null) problems.push(`${e.labelDa}: ${e.shock} har ingen statisk provenuvirkning`);
		if (gdp == null || unit == null) return;
		const gdpPct = (e.kr / gdp) * 100;
		chain.push({ role, shock: e.shock, labelDa: e.labelDa, kr: e.kr, priceYear: e.priceYear, gdpPct,
			fte: null, scale: round4(gdpPct / unit), mappedDa: e.mappedDa });
	};
	for (const e of p.elements) sizeRow(e, 'element');
	if (p.structural == null) {
		problems.push('Finansministeriets skøn over den strukturelle beskæftigelse mangler');
	} else {
		sourceOk(p.structural.source, 'Strukturel virkning');
		if (p.structural.fte !== 0) {
			chain.push({ role: 'structural', shock: STRUCTURAL_SHOCK, labelDa: 'Strukturel virkning', kr: null,
				priceYear: null, gdpPct: null, fte: p.structural.fte,
				scale: round4(p.structural.fte / (0.01 * sizing.snL2030 * 1000)) });
		}
	}
	for (const e of p.financing) sizeRow(e, 'financing');

	const scales = new Map<string, number>();
	for (const row of chain) scales.set(row.shock, (scales.get(row.shock) ?? 0) + row.scale);
	const components = [...scales]
		.map(([name, scale]) => ({ name, scale: round4(scale) }))
		.filter((c) => c.scale !== 0);
	return { components, chain, problems };
}

export function proposalQuery(p: Proposal, sizing: Sizing): string {
	return packageQuery(proposalPackage(p, sizing).components, PROPOSAL_VARIANT);
}

const SHOCK_SHORT: Record<string, string> = { [STRUCTURAL_SHOCK]: 'Arbejdsudbud' };
const minus = (s: string) => s.replace('-', '−');

export function chainLineDa(row: ChainRow): string {
	const target = `${SHOCK_SHORT[row.shock] ?? row.shock.replaceAll('_', ' ')} ×${minus(formatScale(row.scale))}`;
	if (row.role === 'structural') {
		return `Strukturel virkning – Finansministeriets skøn: ${formatSigned(row.fte ?? 0)} fuldtidspersoner → ${target}`;
	}
	return `${row.labelDa}: ${minus(formatSigned(row.kr ?? 0))} mia. kr. (${row.priceYear}) = ${minus(formatSigned(row.gdpPct ?? 0))} pct. af BNP → ${target}`;
}

export function verificationLineDa(maxGapPct: number): string {
	return `Den lineære sum afviger højst ${formatValue(Math.round(maxGapPct * 10) / 10)} pct. fra en samlet modelkørsel af hele forslaget.`;
}

export function statusDa(status: ProposalStatus): string {
	return status === 'vedtaget' ? 'Vedtaget' : 'Forslag';
}
```

Check against the tests: the chain label uses the catalog name with spaces ("Topskat"); if `formatValue` renders 0,1 as "0,1" and 3000 as "3.000" (da-DK), the expected strings hold — if `formatValue` prints two decimals for small values (it uses `daNumber2`), adjust the **implementation** (e.g. strip trailing zeros with a local formatter), not the expected copy.

- [ ] **Step 4: Run the tests**

Run: `cd app && bunx vitest run src/lib/proposal.test.ts && bun run check`
Expected: PASS, no type errors.

- [ ] **Step 5: Stage and propose the commit**

```bash
git add app/src/lib/proposal.ts app/src/lib/proposal.test.ts
# proposed: git commit -m "Pakker: proposal conversion — figures to package by one method (makroskop-48o)"
```

---

### Task 5: Research the shortlist and write `proposals.ts` — GATE: owner approves the shortlist

**Files:**
- Create: `docs/superpowers/specs/2026-09-28-proposal-shortlist.md`
- Create: `app/src/lib/proposals.ts`
- Modify: `app/src/lib/proposal.test.ts` (same-method test over the real list)
- Possibly modify: `etl/static_saldo.py` + its test (a shock the shortlist needs)

**Interfaces:**
- Consumes: `Proposal` type (Task 4), `sizing.staticSaldoPct` keys (Task 2).
- Produces: `export const PROPOSALS: Proposal[]` in `app/src/lib/proposals.ts`, ordered by `date`.

- [ ] **Step 1: Research** Personskattereform 2025/26 and 4–6 candidate party proposals that meet rule (a): the Finance Ministry has published the static revenue per element **and** the structural employment effect. Sources to start from (see `bd memories makro-verification-sources`): L 138 spm 1+2 (2 May 2024), the reform's aftaletekst and lovforslag bemærkninger, FIU answers with per-proposal costings. ft.dk is behind Cloudflare: read it through the Chrome MCP tabs, not WebFetch/curl. For every element record: the FM figure (umiddelbar provenuvirkning, mia. kr., price year, fully phased-in), the page/table reference, the catalog shock it maps to, and whether the 2030 reference already carries it (check the instrument's 2025 vs 2030 value in `etl/shock_gdx/_reference.gdx`).

- [ ] **Step 2: Write the shortlist note** `docs/superpowers/specs/2026-09-28-proposal-shortlist.md`: one section per candidate with a table (element | FM figure | price year | source + page | shock | mapped? | in grundforløb?), the structural FTE with its source, the financing rows, and a line on political balance of the set as a whole (which parties/blocs, no ranking). Recommend 3–4 proposals including Personskattereform 2025/26.

- [ ] **Step 3: GATE — ask the owner to approve the shortlist.** Stop here until they do. Record the decision in the bead: `bd update makroskop-48o --notes "Shortlist approved <date>: <ids>"`.

- [ ] **Step 4: If an approved element needs a shock without a formula** in `STATIC_SALDO` (e.g. `Skattepligtig_indkomstoverforsel`, `Selskabsskat`), add the formula and a hand-calculation test to `etl/test_static_saldo.py` in the same style as Task 2 Step 1, rerun `uv run python extract.py`, and rerun the ETL tests.

- [ ] **Step 5: Write the failing same-method test** — append to `app/src/lib/proposal.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { PROPOSALS } from './proposals';

describe('PROPOSALS', () => {
	const meta = JSON.parse(readFileSync('static/data/meta.json', 'utf8'));
	it('is non-empty, ordered by date and has unique ids', () => {
		expect(PROPOSALS.length).toBeGreaterThan(0);
		expect(PROPOSALS.map((p) => p.date)).toEqual([...PROPOSALS.map((p) => p.date)].sort());
		expect(new Set(PROPOSALS.map((p) => p.id)).size).toBe(PROPOSALS.length);
	});
	for (const p of PROPOSALS) {
		it(`${p.id}: the same method, with a source for every figure`, () => {
			expect(Object.keys(p).sort()).toEqual([...PROPOSAL_KEYS].sort());
			expect(p.sources.every((s) => s.url.startsWith('https://'))).toBe(true);
			expect(proposalPackage(p, meta.sizing).problems).toEqual([]);
		});
	}
});
```

Run: `cd app && bunx vitest run src/lib/proposal.test.ts` — Expected: FAIL (no `./proposals`).

- [ ] **Step 6: Write `app/src/lib/proposals.ts`** with the approved entries, figures copied verbatim from the note. Shape of one entry (numbers below are placeholders for the shape only — use the researched values):

```ts
import type { Proposal } from './proposal';

/** Published proposals as the Finance Ministry costed them (makroskop-48o). Figures are copied
 *  verbatim from the sources; scales are computed (proposal.ts), never written here. Inclusion
 *  rule and method: /pakke/metode/. Ordered by date. */
export const PROPOSALS: Proposal[] = [
	{
		id: 'personskattereform-2025',
		titleDa: 'Personskattereform 2025/26',
		proposerDa: 'Regeringen (S, V, M)',
		status: 'vedtaget',
		date: '2024-…',
		sources: [{ labelDa: '…', url: 'https://…' }],
		elements: [
			{ shock: 'Topskat', labelDa: 'Mellemskat 7,5 pct.', kr: 0, priceYear: 2025, source: 0,
				mappedDa: 'MAKRO har ét topskattetrin; mellemskatten regnes som topskat med samme provenu' }
		],
		structural: { fte: 0, source: 0 },
		financing: [],
		omittedDa: [],
		revisions: []
	}
];
```

The plan cannot state the figures before Step 1; the test in Step 5 and the owner's gate are what keep them honest.

- [ ] **Step 7: Run the tests**

Run: `cd app && bun run test && bun run check`
Expected: PASS.

- [ ] **Step 8: Stage and propose the commit**

```bash
git add docs/superpowers/specs/2026-09-28-proposal-shortlist.md app/src/lib/proposals.ts app/src/lib/proposal.test.ts
# plus etl/static_saldo.py etl/tests/test_static_saldo.py app/static/data/meta.json if Step 4 ran
# proposed: git commit -m "Pakker: the approved proposal shortlist, verbatim figures (makroskop-48o)"
```

---

### Task 6: Joint-solve specs and the box script

**Files:**
- Create: `app/scripts/proposal-specs.ts`
- Create: `etl/proposal_specs.json` (generated, committed)
- Create: `cloud/run_proposals.sh`
- Modify: `app/package.json` (script `proposals:specs`)

**Interfaces:**
- Consumes: `PROPOSALS`, `proposalPackage`, `packageQuery` (Tasks 4–5), `readMeta` from `app/src/lib/server/scenarios`.
- Produces: `etl/proposal_specs.json` = `{ "<id>": { "package": "<query without variant>", "query": "<full /pakke/ query>" } }`; box outputs `etl/proposal_gdx/Forslag_<id>.gdx`.

- [ ] **Step 1: Write the script** `app/scripts/proposal-specs.ts`:

```ts
/** Writes etl/proposal_specs.json: each proposal's package as the joint solve takes it
 *  (freesolver solve-export --package), computed by the same function the page uses (makroskop-48o). */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageQuery } from '../src/lib/package';
import { PROPOSAL_VARIANT, proposalPackage } from '../src/lib/proposal';
import { PROPOSALS } from '../src/lib/proposals';
import { readMeta } from '../src/lib/server/scenarios';

const meta = readMeta();
if (!meta.sizing) throw new Error('meta.json has no sizing block — run etl/extract.py first');
const specs: Record<string, { package: string; query: string }> = {};
for (const p of PROPOSALS) {
	const pkg = proposalPackage(p, meta.sizing);
	if (pkg.problems.length) throw new Error(`${p.id}: ${pkg.problems.join('; ')}`);
	const query = packageQuery(pkg.components, PROPOSAL_VARIANT);
	specs[p.id] = { package: query.replace(/&?variant=[^&]*/, ''), query };
}
writeFileSync(join(process.cwd(), '..', 'etl', 'proposal_specs.json'), JSON.stringify(specs, null, '\t') + '\n');
console.log(`wrote etl/proposal_specs.json (${Object.keys(specs).length} proposals)`);
```

Add to `app/package.json` scripts: `"proposals:specs": "bun run scripts/proposal-specs.ts"`.

- [ ] **Step 2: Run it**

Run: `cd app && bun run proposals:specs && cat ../etl/proposal_specs.json`
Expected: one entry per proposal; each `package` has only catalog names and no `variant`.

- [ ] **Step 3: Write `cloud/run_proposals.sh`** (template: `cloud/run_offentlig_loen.sh`):

```bash
#!/bin/bash
# Proposal presets (makroskop-48o): the new catalog shocks, then one joint --package solve per proposal
# (etl/proposal_specs.json, generated by `bun run proposals:specs`). Shock runs go to etl/shock_gdx_48o/
# (NOT scanned by extract.py) until verified; joint solves go to etl/proposal_gdx/.
#   setsid nohup bash cloud/run_proposals.sh > proposals.log 2>&1 < /dev/null &
# Sequential (one factorization at a time), idempotent, resumable from checkpoints.
set -uo pipefail
cd "$(dirname "$0")/../etl"
export PATH="$HOME/.local/bin:$PATH"
export PYTHONUNBUFFERED=1
echo 1000 > /proc/self/oom_score_adj 2>/dev/null || true
mkdir -p shock_gdx_48o proposal_gdx

run() {
  local out="$1"; shift
  if [ -f "$out" ]; then echo "SKIP $out (already exported)"; return; fi
  echo "=============================================================="
  echo "SCENARIO $out  $(date -Is)"
  echo "=============================================================="
  uv run python freesolver.py solve-export --from-year 2030 --shock-years 2030-2129 "$@" --out "$out" \
    || echo "FAILED: $out (continuing with the rest)"
}

run shock_gdx_48o/Topskat_ufin.gdx --shock-name tTop --shock-delta 0.01
run shock_gdx_48o/Topskat_perm.gdx --shock-name tTop --shock-delta 0.01 --closure tax-reaction
run shock_gdx_48o/Beskaeftigelsesfradrag_ufin.gdx --shock-name tBeskFradrag --shock-delta 0.01
run shock_gdx_48o/Beskaeftigelsesfradrag_perm.gdx --shock-name tBeskFradrag --shock-delta 0.01 --closure tax-reaction

for id in $(uv run python -c "import json; print(' '.join(json.load(open('proposal_specs.json'))))"); do
  pkg=$(uv run python -c "import json,sys; print(json.load(open('proposal_specs.json'))[sys.argv[1]]['package'])" "$id")
  run "proposal_gdx/Forslag_${id}.gdx" --package "$pkg"
done
echo "=== $(date -Is) PROPOSAL RUNS DONE ==="
```

- [ ] **Step 4: Dry-check the script locally** (no solve): `bash -n cloud/run_proposals.sh` — Expected: no output. Add `cloud/README.md` one line under the batch list: "`run_proposals.sh` — makroskop-48o: Topskat/Beskæftigelsesfradrag + one joint `--package` solve per proposal."

- [ ] **Step 5: Stage and propose the commit**

```bash
git add app/scripts/proposal-specs.ts app/package.json etl/proposal_specs.json cloud/run_proposals.sh cloud/README.md
# proposed: git commit -m "Proposal joint-solve specs and box script (makroskop-48o)"
```

---

### Task 7: Box runs — GATE: owner's go-ahead for box time

**Files:**
- Add (after verification): `etl/shock_gdx/Topskat_{ufin,perm}.gdx`, `etl/shock_gdx/Beskaeftigelsesfradrag_{ufin,perm}.gdx`, `etl/proposal_gdx/Forslag_<id>.gdx` (these directories follow the existing GDX handling — check `.gitignore` and do what the existing shock GDX files do).

- [ ] **Step 1: GATE — ask the owner** for box time: "4 shock runs (~5–10 min each with Pardiso) + N joint solves on nodalit, sequential; OK to start now?" Stop until yes. Check the box is quiet first (`ssh nodalit uptime; ssh nodalit free -g`); `bd memories nodalit-box-shared`.

- [ ] **Step 2: Ship the code to the box** the way `cloud/README.md` describes (pack.sh / git pull on the box — follow the README, do not improvise), including `etl/proposal_specs.json`.

- [ ] **Step 3: Launch**

```bash
ssh nodalit 'cd ~/makroskop-cloud && setsid nohup bash cloud/run_proposals.sh > proposals.log 2>&1 < /dev/null &'
```

Monitor `proposals.log` with a Monitor/until-loop, not polling sleeps. On a stall read the `worst residual (...)` lines before touching anything (CLAUDE.md, THE POLE).

- [ ] **Step 4: Pull and deep-verify** each GDX: stamp fields (`uv run python -c "import extract; print(extract.read_stamp(Path('…')))"`), the zero-2029 invariant (`etl/verify_2030.py` pattern: 2029 deviations exactly 0 vs `_reference.gdx`), and for Topskat_ufin a sanity number: first-year saldo effect ≈ `staticSaldoPct.Topskat` (~0.05 pct. of GDP) in sign and size. Then copy the four shock files into `etl/shock_gdx/`.

- [ ] **Step 5: Extract and run the guards**

Run: `cd etl && uv run python extract.py && uv run --with pytest pytest tests -q && cd ../app && bun run test`
Expected: two new scenarios in `static/data/shocks/`; the open-data guard fails on new data → `bun run data:release --changelog "Topskat og beskæftigelsesfradrag (makroskop-48o)"`, rerun, pass.

- [ ] **Step 6: Stage and propose the commit**

```bash
git add app/static/data etl/shock_gdx etl/proposal_gdx  # as the repo tracks GDX today
# proposed: git commit -m "Solve Topskat, Beskæftigelsesfradrag and the proposal joint solves (makroskop-48o)"
```

---

### Task 8: Joint-solve check → `proposals.json`

**Files:**
- Create: `etl/proposals_check.py`
- Create: `etl/tests/test_proposals_check.py`
- Create: `app/static/data/proposals.json` (generated)
- Modify: `app/src/lib/data.ts` (type + loader), `app/src/lib/proposal.test.ts` (verified test)

**Interfaces:**
- Consumes: `etl/proposal_specs.json`, `etl/proposal_gdx/Forslag_<id>.gdx`, `app/static/data/shocks/<shock>_ufin.json`, `extract.extract_shock`, `extract.read_stamp`, `extract.open_gdx`, `extract.extract_detrended`, `extract.read_trend_factors`.
- Produces: `app/static/data/proposals.json` = `{ "<id>": { "query": str, "gapPct": {"qBNP": float, …}, "maxGapPct": float, "exported": str } }`; TS `ProposalCheck` type and `loadProposalChecks(fetch)`; `isPublishable(p, sizing, checks) -> boolean` in `proposal.ts`.

- [ ] **Step 1: Write the failing tests** — `etl/tests/test_proposals_check.py`:

```python
"""Linear sum vs joint solve (makroskop-48o)."""

import pytest

import proposals_check as pc


def test_gap_is_the_largest_deviation_relative_to_the_joint_peak() -> None:
    joint = [0.0, 1.0, 2.0, -1.0]
    linear = [0.0, 1.1, 1.9, -1.0]
    assert pc.relative_gap(joint, linear) == pytest.approx(0.1 / 2.0)


def test_gap_ignores_missing_years_and_an_all_zero_series() -> None:
    assert pc.relative_gap([None, 1.0], [5.0, 1.0]) == 0.0
    assert pc.relative_gap([0.0, 0.0], [0.0, 0.0]) == 0.0


def test_linear_sum_scales_each_scenario() -> None:
    columns = {"Topskat": [1.0, 2.0], "Offentligt_forbrug": [0.5, None]}
    assert pc.linear_sum({"Topskat": -2.0, "Offentligt_forbrug": 1.0}, columns) == [-1.5, None]


def test_package_scales_come_from_the_query() -> None:
    assert pc.scales("Topskat=-2&Offentligt_forbrug=0.5") == {"Topskat": -2.0, "Offentligt_forbrug": 0.5}


def test_a_stale_joint_solve_is_refused() -> None:
    with pytest.raises(SystemExit, match="stale"):
        pc.check_stamp("x", {"package": "Topskat=-1"}, {"package": "Topskat=-2", "query": "…"})
```

Run: `cd etl && uv run --with pytest pytest tests/test_proposals_check.py -v` — Expected: FAIL (no module).

- [ ] **Step 2: Implement** `etl/proposals_check.py`:

```python
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
```

Check that `extract_shock` returns a dict with `"deviations"` keyed like the scenario JSON (it does in `extract.py` main: `payload = {..., **extracted}`) and that it tolerates the package stamp (it reads `solverMeta`; `lukningShare` is None for an unfinanced run). If `extract_shock` requires catalog fields, pass through what it needs; do not route joint solves through `stamp_errors`.

- [ ] **Step 3: Run tests, then the check**

Run: `cd etl && uv run --with pytest pytest tests -q && uv run python proposals_check.py`
Expected: tests pass; one line per proposal with its gaps; `app/static/data/proposals.json` written. Any proposal with `maxGapPct > 10` is reported to the owner and not listed (Step 4 enforces it) — do not tune it away.

- [ ] **Step 4: App side** — in `data.ts`:

```ts
/** Joint solve vs linear sum per proposal (etl/proposals_check.py, makroskop-48o). */
export interface ProposalCheck { query: string; gapPct: Record<string, number>; maxGapPct: number; exported: string }
export async function loadProposalChecks(fetcher: typeof fetch): Promise<Record<string, ProposalCheck>> {
	const response = await fetcher('/data/proposals.json');
	return response.ok ? response.json() : {};
}
```

in `proposal.ts` (import `type ProposalCheck` from `./data` next to `Sizing`):

```ts
export const MAX_GAP_PCT = 10;

/** Listed and prerendered only when the joint solve is of the current query and agrees within 10 %. */
export function isPublishable(p: Proposal, sizing: Sizing, checks: Record<string, ProposalCheck>): boolean {
	const check = checks[p.id];
	return check != null && check.query === proposalQuery(p, sizing) && check.maxGapPct <= MAX_GAP_PCT
		&& proposalPackage(p, sizing).problems.length === 0;
}
```

and the test (append to `proposal.test.ts`):

```ts
describe('isPublishable', () => {
	const check = { query: proposalQuery(BASE, SIZING), gapPct: {}, maxGapPct: 2, exported: '2026-10-01' };
	it('needs a current, agreeing joint solve', () => {
		expect(isPublishable(BASE, SIZING, { test: check })).toBe(true);
		expect(isPublishable(BASE, SIZING, {})).toBe(false);
		expect(isPublishable(BASE, SIZING, { test: { ...check, query: 'Topskat=-1&variant=_ufin' } })).toBe(false);
		expect(isPublishable(BASE, SIZING, { test: { ...check, maxGapPct: 10.5 } })).toBe(false);
	});
	it('every shipped proposal is publishable', () => {
		const checks = JSON.parse(readFileSync('static/data/proposals.json', 'utf8'));
		for (const p of PROPOSALS) expect(isPublishable(p, meta.sizing, checks), p.id).toBe(true);
	});
});
```

(add `isPublishable` to the test's imports and hoist the `meta` read in the `PROPOSALS` describe to module scope so both blocks use it). If a proposal fails the 10 % rule, remove it from `PROPOSALS` with a `revisions`-style note in the shortlist doc and tell the owner.

- [ ] **Step 5: Run the app tests**

Run: `cd app && bun run test && bun run check`
Expected: PASS. (The open-data guard: proposals.json is not a scenario file; if the manifest covers it, run `data:release`.)

- [ ] **Step 6: Stage and propose the commit**

```bash
git add etl/proposals_check.py etl/tests/test_proposals_check.py app/static/data/proposals.json app/src/lib/data.ts app/src/lib/proposal.ts app/src/lib/proposal.test.ts
# proposed: git commit -m "Proposal presets: joint solve vs linear sum gates publication (makroskop-48o)"
```

---

### Task 9: Page — Forslag list, proposal card, edited state, `/pakke/forslag/<id>/`

**Files:**
- Move: `app/src/routes/pakke/+page.svelte` → `app/src/lib/components/PackageWorkbench.svelte` (`git mv`)
- Create: `app/src/routes/pakke/+page.svelte` (wrapper)
- Modify: `app/src/routes/pakke/+page.ts` (load checks)
- Create: `app/src/lib/components/ProposalCard.svelte`
- Create: `app/src/routes/pakke/forslag/[id]/+page.server.ts`, `+page.ts`, `+page.svelte`
- Modify: `app/src/lib/package.ts` (`scaleSteps` off-ladder value), `app/src/lib/package.test.ts`
- Modify: `app/src/lib/proposal.ts` (+test): `presetState`, `exportTitle`
- Modify: `app/scripts/verify-build.ts`

**Interfaces:**
- Consumes: everything from Tasks 4, 5, 8.
- Produces: `PackageWorkbench` props `{ meta: Meta; baseline: Baseline; checks: Record<string, ProposalCheck>; initialProposal?: string | null }`; `presetState(query, proposalId, sizing) -> { proposal: Proposal; edited: boolean } | null`; route data `{ proposalId: string; head: PageHead }`.

Use the `svelte:svelte-file-editor` agent / svelte MCP autofixer for every `.svelte` file.

- [ ] **Step 1: `scaleSteps` off-ladder — failing test** in `package.test.ts`:

```ts
describe('scaleSteps with a current value', () => {
	it('adds an off-ladder current value in order', () => {
		expect(scaleSteps(null, -0.63)).toEqual([-1, -0.75, -0.63, -0.5, -0.25, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
	});
	it('leaves the ladder alone for a ladder value', () => {
		expect(scaleSteps(null, 0.5)).toEqual(ALL_SCALE_STEPS);
	});
});
```

Implement: `export function scaleSteps(maxScale: number | null | undefined, current?: number): number[]` — after the existing logic, `if (current != null && Number.isFinite(current) && current !== 0 && !steps.includes(current)) return [...steps, current].sort((a, b) => a - b);`. Note the current value may exceed `maxScale` (a preset at ×−7,5): it is still shown, because the joint solve verified it. Run `bunx vitest run src/lib/package.test.ts` → PASS.

- [ ] **Step 2: `presetState` — failing test** in `proposal.test.ts`:

```ts
describe('presetState', () => {
	const PROPS = [BASE];
	const q = proposalQuery(BASE, SIZING);
	it('is the proposal, unedited, when the package is its query', () => {
		expect(presetState(q, 'test', SIZING, PROPS)).toEqual({ proposal: BASE, edited: false });
	});
	it('is edited after any change: scale, row, closure', () => {
		expect(presetState(q.replace('Topskat=-2', 'Topskat=-1'), 'test', SIZING, PROPS)?.edited).toBe(true);
		expect(presetState(q.replace('Arbejdsudbud_beskaeftigelse=0.1&', ''), 'test', SIZING, PROPS)?.edited).toBe(true);
		expect(presetState(q.replace('_ufin', '_perm'), 'test', SIZING, PROPS)?.edited).toBe(true);
	});
	it('is null for an unknown or missing id', () => {
		expect(presetState(q, 'nope', SIZING, PROPS)).toBeNull();
		expect(presetState(q, null, SIZING, PROPS)).toBeNull();
	});
});
describe('exportTitle', () => {
	it('names the proposal only while unedited', () => {
		expect(exportTitle({ proposal: BASE, edited: false })).toBe('Forslag: Testforslag (Regeringen)');
		expect(exportTitle({ proposal: BASE, edited: true })).toBeNull();
		expect(exportTitle(null)).toBeNull();
	});
});
```

Implement in `proposal.ts`:

```ts
export interface PresetState { proposal: Proposal; edited: boolean }

/** The package query (packageQuery form) against the proposal it was opened from. Any difference —
 *  a scale, a row, the closure — makes it an edited package that no longer carries the name. */
export function presetState(query: string, proposalId: string | null, sizing: Sizing,
	proposals: Proposal[]): PresetState | null {
	const proposal = proposalId ? proposals.find((p) => p.id === proposalId) : undefined;
	if (!proposal) return null;
	return { proposal, edited: query !== proposalQuery(proposal, sizing) };
}

export function exportTitle(state: PresetState | null): string | null {
	return state && !state.edited ? `Forslag: ${state.proposal.titleDa} (${state.proposal.proposerDa})` : null;
}
```

Run the tests → PASS.

- [ ] **Step 3: Move the page into a component**

```bash
git mv app/src/routes/pakke/+page.svelte app/src/lib/components/PackageWorkbench.svelte
```

In the component replace `let { data } = $props(); const meta = $derived(data.meta); const baseline = $derived(data.baseline);` with:

```ts
	let { meta, baseline, checks, initialProposal = null }: {
		meta: Meta; baseline: Baseline; checks: Record<string, ProposalCheck>; initialProposal?: string | null;
	} = $props();
```

New `app/src/routes/pakke/+page.svelte`:

```svelte
<script lang="ts">
	import PackageWorkbench from '$lib/components/PackageWorkbench.svelte';
	let { data } = $props();
</script>

<PackageWorkbench meta={data.meta} baseline={data.baseline} checks={data.checks} />
```

`+page.ts`: also `checks: await loadProposalChecks(fetch)`. Run `bun run check` and open /pakke/ in `bun run dev`: behaviour identical (examples, deep link, closure chips).

- [ ] **Step 4: Proposal state in the workbench** — add:

```ts
	const FORSLAG_PARAM = 'forslag';
	const listed = $derived(meta.sizing ? PROPOSALS.filter((p) => isPublishable(p, meta.sizing!, checks)) : []);
	let proposalId: string | null = $state(null);
	const preset = $derived(meta.sizing ? presetState(query, proposalId, meta.sizing, listed) : null);
```

- `apply(query)`: also `proposalId = new URLSearchParams(query).get(FORSLAG_PARAM);`.
- `openProposal(p)`: `apply(proposalQuery(p, meta.sizing!) + '&forslag=' + p.id)`.
- `onMount`: `if (initialProposal) { const p = listed.find(x => x.id === initialProposal); if (p) openProposal(p); } else if (page.url.search) apply(page.url.search);`
- `shareUrl`: unedited preset → `${page.url.origin}/pakke/forslag/${preset.proposal.id}/`; edited or none → today's `packagePermalink(origin, query)` plus `&forslag=<id>` when `preset` is set (so "Tilpasset fra" survives a reload).
- URL sync `$effect`: on the forslag route (`initialProposal` set) leave the address bar alone while `preset && !preset.edited`; on the first edit, `goto(resolve('/pakke/') + '?' + query + '&forslag=' + id, { replaceState: true, keepFocus: true, noScroll: true })`. On /pakke/ keep today's `replaceState`, with the `forslag` param appended when `preset` is set.
- Exports (`downloadCsv`, `downloadPng`, `copyLink` text): prepend `exportTitle(preset)` to the header/provenance lines when non-null.
- Empty state, above the `EXAMPLES` list:

```svelte
{#if listed.length > 0}
	<h3>Forslag</h3>
	<ul class="examples">
		{#each listed as p (p.id)}
			<li>
				<a href={resolve(`/pakke/forslag/${p.id}/`)} onclick={(e) => { e.preventDefault(); openProposal(p); }}>{p.titleDa}</a>
				<span class="muted">{p.proposerDa} · {statusDa(p.status)} · {p.date.slice(0, 4)}</span>
			</li>
		{/each}
	</ul>
	<p class="muted"><a href={resolve('/pakke/metode/')}>Sådan regner vi forslag</a></p>
{/if}
```

- Pass `scaleSteps(maxScale, c.scale)` wherever the row select is built (line ~121).
- Above the rows: `{#if preset}<ProposalCard state={preset} sizing={meta.sizing} check={checks[preset.proposal.id]} onreset={() => openProposal(preset.proposal)} />{/if}`.

- [ ] **Step 5: `ProposalCard.svelte`**

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProposalCheck, Sizing } from '$lib/data';
	import { chainLineDa, proposalPackage, statusDa, verificationLineDa, type PresetState } from '$lib/proposal';

	let { state, sizing, check, onreset }: {
		state: PresetState; sizing: Sizing; check: ProposalCheck | undefined; onreset: () => void;
	} = $props();
	const p = $derived(state.proposal);
	const chain = $derived(proposalPackage(p, sizing).chain);
	const STANDARD_OMITTED = [
		'Indfasning: forslaget er regnet fuldt indfaset og varigt fra 2030.',
		'Fordelingsvirkninger: MAKRO har alder, men ikke indkomstgrupper.',
		'Samspil mellem elementerne ud over det, den samlede modelkørsel viser.'
	];
</script>

{#if state.edited}
	<p class="card adapted" role="note">
		Tilpasset fra: <em>{p.titleDa}</em> ({p.proposerDa}). Tallene er ikke længere forslagets.
		<button class="linklike" onclick={onreset}>Vis forslaget igen</button>
	</p>
{:else}
	<section class="card proposal" aria-label="Forslaget">
		<p class="kicker">{statusDa(p.status)} · {p.proposerDa} · {p.date}</p>
		<h3>{p.titleDa}</h3>
		<ul class="chain">
			{#each chain as row, i (i)}
				<li>{chainLineDa(row)}{#if row.mappedDa}<span class="muted"> – {row.mappedDa}</span>{/if}</li>
			{/each}
		</ul>
		{#if check}<p>{verificationLineDa(check.maxGapPct)}</p>{/if}
		<details>
			<summary>Ikke med i beregningen</summary>
			<ul>{#each [...p.omittedDa, ...STANDARD_OMITTED] as line (line)}<li>{line}</li>{/each}</ul>
		</details>
		<p class="sources">
			Kilder: {#each p.sources as s, i (s.url)}<a href={s.url} rel="external">{s.labelDa}</a>{i < p.sources.length - 1 ? ' · ' : ''}{/each}
			· <a href={resolve('/pakke/metode/')}>Metode</a>
		</p>
	</section>
{/if}
```

Style with the existing tokens (`--rule-strong`, `--ink-muted`, `.card`); no new colours. Check both colour schemes and 320 px width.

- [ ] **Step 6: The forslag route**

`app/src/routes/pakke/forslag/[id]/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EntryGenerator, PageServerLoad } from './$types';
import { isPublishable, proposalPackage } from '$lib/proposal';
import { PROPOSALS } from '$lib/proposals';
import { readMeta } from '$lib/server/scenarios';

export const prerender = true;

function publishable() {
	const meta = readMeta();
	const checks = JSON.parse(readFileSync(join(process.cwd(), 'static/data/proposals.json'), 'utf8'));
	return meta.sizing ? PROPOSALS.filter((p) => isPublishable(p, meta.sizing!, checks)) : [];
}

export const entries: EntryGenerator = () => publishable().map((p) => ({ id: p.id }));

export const load: PageServerLoad = ({ params }) => {
	const p = publishable().find((x) => x.id === params.id);
	if (!p) error(404, 'Ukendt forslag');
	const rows = proposalPackage(p, readMeta().sizing!).chain.length;
	return {
		proposalId: p.id,
		head: {
			title: `${p.titleDa} regnet i MAKRO · MAKROskop`,
			description: `${p.titleDa} (${p.proposerDa}) regnet i MAKRO med samme metode som alle forslag: ${rows} elementer sat i størrelse efter Finansministeriets tal, inkl. strukturel virkning, ufinansieret.`
		}
	};
};
```

(If `readMeta` in `lib/server/scenarios.ts` is typed without `sizing`, it returns `Meta` from `data.ts`, which now has it.) `+page.ts`: `export const load = async ({ data, fetch }) => ({ ...data, baseline: await loadBaseline(fetch), checks: await loadProposalChecks(fetch) });`. `+page.svelte`: `<PackageWorkbench meta={data.meta} baseline={data.baseline} checks={data.checks} initialProposal={data.proposalId} />`. Confirm the layout picks up `page.data.head` (it does for the front page, `+layout.svelte:67`).

- [ ] **Step 7: verify-build checks** — append to `app/scripts/verify-build.ts` before the failure report:

```ts
import { PROPOSALS } from '../src/lib/proposals';
import { isPublishable } from '../src/lib/proposal';
const proposalChecks = JSON.parse(readFileSync(join(process.cwd(), 'static/data/proposals.json'), 'utf8'));
for (const p of PROPOSALS) {
	const file = join(build, 'pakke', 'forslag', p.id, 'index.html');
	const listed = meta.sizing != null && isPublishable(p, meta.sizing, proposalChecks);
	check(existsSync(file) === listed, `/pakke/forslag/${p.id}/: page ${listed ? 'missing' : 'must not exist (not publishable)'}`);
	if (listed) check(readFileSync(file, 'utf8').includes(`<title>${p.titleDa} regnet i MAKRO · MAKROskop</title>`), `/pakke/forslag/${p.id}/: <title>`);
}
```

(move the imports to the top of the file with the others.)

- [ ] **Step 8: Build and verify**

Run: `cd app && bun run test && bun run check && bun run build && bun run verify:build`
Expected: all pass. Then `bun run preview` (restart it after each build — `bd memories vite-preview`) and check by hand in both colour schemes and at 375 px: open a proposal from the list; the card and rows show; change one scale → "Tilpasset fra", URL has `&forslag=`, CSV header lacks the title; "Vis forslaget igen" restores; `/pakke/forslag/<id>/` loads directly with the card; the share link of an unedited preset is the forslag URL.

- [ ] **Step 9: Stage and propose the commit**

```bash
git add app/src
git add app/scripts/verify-build.ts
# proposed: git commit -m "Pakker: proposal list, card, edited state and /pakke/forslag/<id>/ (makroskop-48o)"
```

---

### Task 10: Method note `/pakke/metode/`

**Files:**
- Create: `app/src/routes/pakke/metode/+page.svelte`, `+page.ts`
- Modify: `app/scripts/verify-build.ts`

**Interfaces:**
- Consumes: `meta.sizing`, `PROPOSALS`, `STATIC_SALDO` values via `meta.sizing.staticSaldoPct`, `MAX_GAP_PCT`, `statusDa`.
- Produces: page at `/pakke/metode/` with ids `#optagelse`, `#stoerrelse`, `#strukturel`, `#finansiering`, `#ikke`, `#rettelser`.

- [ ] **Step 1: `+page.ts`** — `export const load = () => ({ head: { title: 'Sådan regner vi forslag · MAKROskop', description: 'Metoden bag MAKROskops forslag: hvilke forslag der kommer med, hvordan de sættes i størrelse, og hvad beregningen ikke indeholder.' } });`

- [ ] **Step 2: `+page.svelte`** — six sections, Danish, no evaluative words. Content (write it out in full; numbers from data, not typed):

1. `#optagelse` **Hvilke forslag kommer med?** The three conditions (a)–(c) from the spec, with (c) reading `MAX_GAP_PCT` ("10 pct."). "Alle kan bede om, at et forslag kommer med; anmodninger behandles i den rækkefølge, de kommer, og et afslag begrundes med den betingelse, forslaget ikke opfylder." Contact: link to the repo's issues page (`https://github.com/huulbaek/makroskop/issues`).
2. `#stoerrelse` **Hvordan sættes et forslag i størrelse?** Formula in words and as `skala = (mia. kr. / BNP i prisåret) / stødets statiske provenuvirkning`; a table of every shock in `meta.sizing.staticSaldoPct` (label from `meta.shocks`, value with `formatSigned`, "pct. af BNP ved ×1") and one sentence per formula family (rate tax, fradrag at kommune- and kirkeskat, public inputs). Say: elements on instruments MAKRO lacks are regnet on the nearest instrument of the same tax with the same provenu, and the card says which; "MAKRO har i denne udgave ét topskattetrin".
3. `#strukturel` **Strukturel virkning** Why MAKRO needs it from outside (skatten påvirker ikke arbejdsudbuddet i MAKROs stødmodel), why the Finance Ministry's estimate is used for every proposal, applied as persons via Arbejdsudbud (beskæftigelse): `skala = fuldtidspersoner / (1 pct. af den strukturelle beskæftigelse i 2030 = {formatValue(sizing.snL2030 * 10)} personer)`.
4. `#finansiering` **Finansiering** The proposal's own financing as rows; unfinanced closure, so the saldo shows the remainder; the closure chips switch to lukkeskat financing, which makes it an edited package. Every proposal is laid on top of MAKROs grundforløb; elements already in the grundforløb are listed under "Ikke med".
5. `#ikke` **Hvad MAKROskop ikke er** Not the Finance Ministry's or DREAM's own calculation; no distribution; no phase-in; linear sum checked by one joint model run per proposal.
6. `#rettelser` **Rettelser** For each `PROPOSALS` entry with `revisions.length`, a dated list; else "Ingen rettelser endnu."

Link back to `/pakke/`. Run the svelte autofixer.

- [ ] **Step 3: verify-build** — add:

```ts
const metode = readFileSync(join(build, 'pakke', 'metode', 'index.html'), 'utf8');
check(metode.includes('<title>Sådan regner vi forslag · MAKROskop</title>'), '/pakke/metode/: <title>');
for (const id of ['optagelse', 'stoerrelse', 'strukturel', 'finansiering', 'ikke', 'rettelser']) {
	check(metode.includes(`id="${id}"`), `/pakke/metode/: section #${id} missing`);
}
check(readFileSync(join(build, 'pakke', 'index.html'), 'utf8').includes('href="/pakke/metode/"'), '/pakke/: no link to the method note');
```

- [ ] **Step 4: Build and verify**

Run: `cd app && bun run check && bun run build && bun run verify:build`
Expected: PASS. Read the page in both schemes and at 320 px.

- [ ] **Step 5: Stage and propose the commit**

```bash
git add app/src/routes/pakke/metode app/scripts/verify-build.ts
# proposed: git commit -m "Pakker: method note for proposal presets (makroskop-48o)"
```

---

### Task 11: Explainers, docs, review — GATE: owner's neutrality read before push

**Files:**
- Modify: `etl/catalog.py` (explainers for Topskat, Beskaeftigelsesfradrag)
- Modify: `CLAUDE.md` (Layout: Pakker line)
- Modify: `etl/tests/test_explainer.py` only if its shipped-scenario test needs the new names (it iterates the catalog)

- [ ] **Step 1: Explainers** — read the two new `_ufin`/`_perm` scenario JSON files (first-year and long-run qC, pBolig, qBNP, nL, vhW, saldo2bnp) and write `explainer_da` / `explainer_perm_da` in the style of the Bundskat run (2–3 sentences, numbers rounded as there, `{lukning}` slot in the financed text). Add `linearity_da` only if measured. Rerun `uv run python extract.py`, `uv run --with pytest pytest tests -q` (test_explainer checks the financed text and the slot), `bun run data:release --changelog "Forklaringer: topskat og beskæftigelsesfradrag (makroskop-48o)"` if the guard asks.

- [ ] **Step 2: CLAUDE.md** — extend the Pakker description in Layout with: "Proposal presets (makroskop-48o): verbatim Finance Ministry figures in `lib/proposals.ts`, sized by `lib/proposal.ts` from meta.json `sizing` (`etl/static_saldo.py`); each checked by a joint `freesolver solve-export --package` run (`cloud/run_proposals.sh`, `etl/proposals_check.py` → `static/data/proposals.json`, >10 % gap = not published); routes `/pakke/forslag/<id>/`, `/pakke/metode/`. Design: docs/superpowers/specs/2026-09-28-proposal-presets-design.md." Add to Critical knowledge: "MAKRO June 2026 has one working topskat step: tMellem/tTopTop are set but rMellemSkatInd/rTopTopSkatInd are 0 (GovRevenues.gms:826) — shocking them does nothing." Also `bd remember --key makro-topskat-one-step "…same sentence…"`.

- [ ] **Step 3: Full quality gates**

Run: `cd etl && uv run --with pytest pytest tests -q && cd ../app && bun run test && bun run check && bun run build && bun run verify:build`
Expected: all pass. Lighthouse a11y on `/pakke/forslag/<id>/` and `/pakke/metode/` in both colour schemes (`bd memories a11y-audit-both-schemes`).

- [ ] **Step 4: Whole-branch review** — superpowers:requesting-code-review over the branch, then fix findings.

- [ ] **Step 5: GATE — owner reads every Danish string on the card, list and method note for neutrality**, and approves the push. Do not push before that. Then close out: `bd close makroskop-48o`; file follow-ups: `bd create --title="Pakker: share-card images for proposal presets" --type=feature --priority=3 --parent=makroskop-gnp` and `bd create --title="Pakker: size any package row in mia. kr." --type=feature --priority=4 --parent=makroskop-gnp`.

- [ ] **Step 6: Stage and propose the commit**

```bash
git add etl/catalog.py CLAUDE.md app/static/data
# proposed: git commit -m "Topskat and Beskæftigelsesfradrag explainers; docs for proposal presets (makroskop-48o)"
```
