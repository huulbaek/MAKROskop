"""Per-shock digest for explainer audits (makroskop-gnp.7): catalog text + _ufin/_perm deviations at key years.

Usage (from etl/): uv run python explainer_digest.py <out-dir>  → <out-dir>/<Shock>.txt, one per ShockRun.
vSaldo/vPrimSaldo/vOff13Net are raw level differences; read saldo2bnp/primsaldo2bnp/nettoformue2bnp instead.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, '.')
import catalog
DATA = Path('../app/static/data'); OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
meta = json.loads((DATA / 'meta.json').read_text()); y0 = meta['yearStart']
series = {s['key']: s for s in meta['series']}
YEARS = [2030, 2031, 2032, 2033, 2035, 2040, 2050, 2060, 2080, 2100]
KEYS = [k for k in series if not any(k.endswith(f'_{s}') for s in ('tje','fre','byg','lan','soe','bol','ene','udv','off'))] + ['qBVT_off', 'nL_off']
index = []
for run in catalog.SHOCK_RUNS:
    lines = [f'# {run.shock}', f'instrument: {run.instrument}  ({run.instrument_da})', f'change: {run.change_da}  factor={run.factor} delta={run.delta}',
             f'solver_shock: {run.solver_shock or run.instrument}  endogenize: {run.endogenize or "-"}',
             f'dream_da: {run.dream_da}', f'explainer_da: {run.explainer_da}', f'channel: {run.channel}', '']
    for v in ('_ufin', '_perm'):
        f = DATA / 'shocks' / f'{run.shock}{v}.json'
        if not f.exists():
            lines.append(f'({run.shock}{v}: no data)'); continue
        dev = json.loads(f.read_text())['deviations']
        lines.append(f'## {v}  deviations from reference ({"pct" }; devMode pp = pct.-points). Years: {YEARS}  | min/max over 2030-2100')
        for k in KEYS:
            if k not in dev: continue
            col = dev[k]; vals = [col[y - y0] if y - y0 < len(col) else None for y in YEARS]
            rng = [x for x in col[2030 - y0:] if x is not None]
            fmt = lambda x: '   .   ' if x is None else f'{x:7.3f}'
            unit = series[k]['devMode'] if k in series else 'pp'
            lines.append(f'{k:15}{unit:4} ' + ' '.join(fmt(x) for x in vals) + (f'  | {min(rng):7.3f} {max(rng):7.3f}' if rng else ''))
        lines.append('')
    (OUT / f'{run.shock}.txt').write_text('\n'.join(lines))
    index.append(run.shock)
(OUT / 'INDEX.txt').write_text('\n'.join(index))
print(len(index), 'shocks')
