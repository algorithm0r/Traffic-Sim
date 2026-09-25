"""Stage 14: calibrate IDM to NGSIM car-following episodes.

  python tools/ngsim_calib.py [csv] [--min-secs 30] [--max-secs 90] [--max-episodes 600]

For every car-following episode (same follower, same leader, both in the same mainline
lane, continuously for >= min-secs), the follower is simulated with IDM driven by the
leader's OBSERVED trajectory, from the follower's observed initial position and speed. The
five IDM parameters (v0, T, s0, a, b; delta = 4 as in the sim) are fitted per episode by
differential evolution on the relative gap error
    e = sqrt(mean((s_sim - s_obs)^2)) / mean(s_obs)
the standard objective for trajectory calibration (gap, not speed, because gap errors do
not cancel over time). A simulated collision is penalised. The same episodes are also
scored with the sim's current archetype parameters, as a baseline.

NGSIM positions are noisy: the longitudinal position of each vehicle is smoothed with a
Savitzky-Golay filter (2.1 s window, cubic) and speeds are taken from the smoothed
positions. Episodes whose smoothed acceleration exceeds 8 m/s^2 are dropped as tracking
errors. Units are converted to SI.

Writes results/ngsim-calib.json (per-episode) and prints distribution summaries.
"""
import argparse, glob, json, os, sys, time
import numpy as np
import pandas as pd
from scipy.optimize import differential_evolution
from scipy.signal import savgol_filter

FT = 0.3048
ap = argparse.ArgumentParser()
ap.add_argument('csv', nargs='?', default=None)
ap.add_argument('--min-secs', type=float, default=30)
ap.add_argument('--max-secs', type=float, default=90)
ap.add_argument('--max-episodes', type=int, default=600)
ap.add_argument('--max-lane', type=int, default=6)
ap.add_argument('--seed', type=int, default=1)
args = ap.parse_args()

here = os.path.dirname(os.path.abspath(__file__))
path = args.csv or sorted(glob.glob(os.path.join(here, '..', 'data', 'ngsim', '*.csv')))[0]
t0 = time.time()
df = pd.read_csv(path)
df = df.drop_duplicates(['vehicle_id', 'frame_id']).sort_values(['vehicle_id', 'frame_id'])
print(f'{os.path.basename(path)}: {len(df)} rows, {df.vehicle_id.nunique()} vehicles', flush=True)

# per-vehicle smoothed longitudinal position (front bumper) and speed, SI
tracks = {}
for vid, g in df.groupby('vehicle_id'):
    fr = g.frame_id.to_numpy()
    if len(fr) < 50 or np.any(np.diff(fr) != 1):   # require contiguous 10 Hz frames
        continue
    y = g.local_y.to_numpy() * FT
    ys = savgol_filter(y, 21, 3)
    v = np.gradient(ys, 0.1)
    acc = np.gradient(v, 0.1)
    tracks[vid] = dict(frame=fr, y=ys, v=v, acc=acc, lane=g.lane_id.to_numpy(),
                       prec=g.preceding.to_numpy(), length=float(g.v_length.iloc[0]) * FT,
                       vclass=int(g.v_class.iloc[0]))
print(f'{len(tracks)} usable tracks', flush=True)

# episodes: maximal runs where the follower's leader, and both lanes, stay the same
episodes = []
minN, maxN = int(args.min_secs * 10), int(args.max_secs * 10)
for fid, f in tracks.items():
    n = len(f['frame']); i = 0
    while i < n:
        lead = f['prec'][i]; lane = f['lane'][i]
        j = i
        while j < n and f['prec'][j] == lead and f['lane'][j] == lane:
            j += 1
        if lead != 0 and lead in tracks and lane <= args.max_lane and j - i >= minN:
            L = tracks[lead]
            # align the leader's frames to the follower's
            f0, f1 = f['frame'][i], f['frame'][j - 1]
            li = np.searchsorted(L['frame'], f0)
            if li < len(L['frame']) and L['frame'][li] == f0 and li + (j - i) <= len(L['frame']) \
               and L['frame'][li + (j - i) - 1] == f1 and np.all(L['lane'][li:li + (j - i)] == lane):
                k = min(j - i, maxN)
                sl = slice(i, i + k); ll = slice(li, li + k)
                gap = L['y'][ll] - L['length'] - f['y'][sl]
                ok = (np.all(gap > 0.5) and np.max(np.abs(f['acc'][sl])) < 8
                      and np.max(np.abs(L['acc'][ll])) < 8 and np.min(f['v'][sl]) >= -0.5)
                if ok:
                    episodes.append(dict(follower=int(fid), leader=int(lead), lane=int(lane),
                                         vclass=f['vclass'], lead_len=L['length'],
                                         yf=f['y'][sl].copy(), vf=f['v'][sl].copy(),
                                         yl=L['y'][ll].copy(), vl=L['v'][ll].copy(), gap=gap))
        i = j
print(f'{len(episodes)} car-following episodes >= {args.min_secs:.0f} s', flush=True)
rng = np.random.default_rng(args.seed)
if len(episodes) > args.max_episodes:
    episodes = [episodes[i] for i in sorted(rng.choice(len(episodes), args.max_episodes, replace=False))]

DT, DELTA = 0.1, 4.0
def simulate(ep, P):
    """P: (5, S) array of candidate parameter columns → (S,) relative gap errors."""
    v0, T, s0, a, b = P
    S = P.shape[1]
    x = np.full(S, ep['yf'][0]); v = np.full(S, max(ep['vf'][0], 0.0))
    yl, vl, Ll, gobs = ep['yl'], ep['vl'], ep['lead_len'], ep['gap']
    n = len(gobs); err = np.zeros(S); crashed = np.zeros(S, bool)
    for t in range(1, n):
        s = yl[t - 1] - Ll - x
        crashed |= s <= 0
        s = np.maximum(s, 0.1)
        sstar = s0 + np.maximum(0.0, v * T + v * (v - vl[t - 1]) / (2 * np.sqrt(a * b)))
        acc = a * (1 - (v / v0) ** DELTA - (sstar / s) ** 2)
        acc = np.maximum(acc, -9.0)
        vn = np.maximum(v + acc * DT, 0.0)
        x = x + (v + vn) / 2 * DT
        v = vn
        err += (yl[t] - Ll - x - gobs[t]) ** 2
    e = np.sqrt(err / (n - 1)) / np.mean(gobs)
    return np.where(crashed, e + 10.0, e)

BOUNDS = [(8, 45), (0.3, 3.0), (0.5, 6.0), (0.2, 4.0), (0.3, 5.0)]   # v0, T, s0, a, b
# the sim's current archetypes (v0 = v0mult × 65 mph), for the baseline error
MPH = 0.44704
ARCH = {'aggressive': (1.16 * 65 * MPH, 1.00, 2.0, 1.4, 2.1), 'normal': (1.04 * 65 * MPH, 1.45, 2.5, 1.0, 1.7),
        'cautious': (0.94 * 65 * MPH, 1.85, 3.0, 0.8, 1.4), 'truck': (0.88 * 65 * MPH, 1.70, 3.5, 0.6, 1.2)}
archP = np.array(list(ARCH.values())).T

out = []
for n_, ep in enumerate(episodes):
    res = differential_evolution(lambda P: simulate(ep, P), BOUNDS, vectorized=True, updating='deferred',
                                 popsize=12, maxiter=80, tol=1e-6, seed=int(rng.integers(1 << 30)), polish=False)
    base = simulate(ep, archP)
    rec = dict(follower=ep['follower'], leader=ep['leader'], lane=ep['lane'], vclass=ep['vclass'],
               secs=len(ep['gap']) / 10, v_mean=float(np.mean(ep['vf'])), v_max=float(np.max(ep['vf'])),
               gap_mean=float(np.mean(ep['gap'])), err=float(res.fun),
               v0=res.x[0], T=res.x[1], s0=res.x[2], a=res.x[3], b=res.x[4],
               base={k: float(e) for k, e in zip(ARCH, base)})
    out.append(rec)
    if n_ % 25 == 0:
        print(f'  {n_}/{len(episodes)}  err {res.fun:.3f}  T {res.x[1]:.2f}  base(normal) {base[1]:.3f}  '
              f'[{(time.time() - t0) / 60:.1f} min]', flush=True)

os.makedirs(os.path.join(here, '..', 'results'), exist_ok=True)
with open(os.path.join(here, '..', 'results', 'ngsim-calib.json'), 'w') as f:
    json.dump(dict(source=os.path.basename(path), min_secs=args.min_secs, max_secs=args.max_secs,
                   bounds=BOUNDS, episodes=out), f)

r = pd.DataFrame(out)
cars = r[r.vclass == 2]
def q(s): return f'{s.quantile(.1):.2f} / {s.quantile(.25):.2f} / {s.median():.2f} / {s.quantile(.75):.2f} / {s.quantile(.9):.2f}'
print(f'\n{len(r)} episodes fitted ({len(cars)} car followers), {(time.time() - t0) / 60:.1f} min')
print('quantiles 10/25/50/75/90 (cars):')
for k in ['err', 'v0', 'T', 's0', 'a', 'b', 'v_mean']:
    print(f'  {k:6s} {q(cars[k])}')
bb = pd.DataFrame(list(r.base))
print('baseline error, current archetypes (median): ' + ', '.join(f'{k} {bb[k].median():.3f}' for k in ARCH))
print('best-of-four-archetypes error (median):', f'{bb.min(axis=1).median():.3f}')
