"""Stage 17: how many through-lane vehicles overtake an onramp merger before it merges?
Daamen et al. (2010), cited by LMRS for gap creation: at an onramp "no merging vehicle is
overtaken by multiple vehicles". NGSIM I-80's Powell St auxiliary lane (7) merging into lane 6.

  python tools/ngsim_overtakes.py

For every vehicle that switches lane 7 -> 6, over its contiguous time in lane 7 before the
switch: the lane-6 vehicles that were behind it (within 150 m) at some frame and ahead of it at
a later frame (front positions, smoothed). Writes results/ngsim-overtakes.json.
"""
import json, os
import numpy as np, pandas as pd
from scipy.signal import savgol_filter
from ngsim_common import default_csv, FT, HERE

df = pd.read_csv(default_csv()).drop_duplicates(['vehicle_id', 'frame_id']).sort_values(['vehicle_id', 'frame_id'])
df['y'] = df.local_y * FT
lane6 = {fr: g[['vehicle_id', 'y']].to_numpy() for fr, g in df[df.lane_id == 6].groupby('frame_id')}
counts, dur = [], []
for vid, g in df.groupby('vehicle_id'):
    lanes, frames = g.lane_id.to_numpy(), g.frame_id.to_numpy()
    if len(g) < 25: continue
    y = savgol_filter(g.y.to_numpy(), 21, 3) if len(g) >= 21 else g.y.to_numpy()
    for i in range(1, len(lanes)):
        if not (lanes[i - 1] == 7 and lanes[i] == 6): continue
        s = i - 1
        while s - 1 >= 0 and lanes[s - 1] == 7 and frames[s] - frames[s - 1] == 1: s -= 1
        behind, passed = set(), set()
        for k in range(s, i):
            f = lane6.get(frames[k])
            if f is None: continue
            rel = f[:, 1] - y[k]
            for oid, r in zip(f[:, 0], rel):
                if -150 < r < 0: behind.add(oid)
                elif 0 < r < 150 and oid in behind: passed.add(oid)
        counts.append(len(passed)); dur.append((i - s) * 0.1)
c = np.array(counts)
out = dict(n=int(len(c)), secs_in_aux_lane={p: round(float(np.quantile(dur, p)), 1) for p in (.1, .5, .9)},
           overtaken_by={str(k): round(float((c == k).mean()), 3) for k in range(4)}, overtaken_by_4_plus=round(float((c >= 4).mean()), 3),
           mean=round(float(c.mean()), 2))
json.dump(dict(summary=out, counts=counts), open(os.path.join(HERE, '..', 'results', 'ngsim-overtakes.json'), 'w'))
print(json.dumps(out, indent=1))
