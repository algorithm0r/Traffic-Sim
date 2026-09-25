"""Stage 14: gaps at lane changes in NGSIM I-80 — the data side of the gap-acceptance
comparison (probes/gapaccept.mjs is the model side).

  python tools/ngsim_lanechange.py

A lane change is a switch of lane_id between consecutive frames among mainline lanes 1-6.
NGSIM switches lane_id when the vehicle's centre crosses the line, so gaps are measured at
that moment: the lead gap to the nearest vehicle ahead in the new lane (bumper to bumper)
and the lag gap from the nearest vehicle behind in it, in metres and in seconds (lag gap /
lag speed; lead gap / changer speed). Writes results/ngsim-lanechange.json.
"""
import json, os
import numpy as np, pandas as pd
from ngsim_common import default_csv, FT, HERE

df = pd.read_csv(default_csv()).drop_duplicates(['vehicle_id', 'frame_id'])
df['y'] = df.local_y * FT; df['len'] = df.v_length * FT; df['v'] = df.v_vel * FT
by_frame = {fr: g for fr, g in df.groupby('frame_id')}
df = df.sort_values(['vehicle_id', 'frame_id'])
rows = []
for vid, g in df.groupby('vehicle_id'):
    lanes, frames = g.lane_id.to_numpy(), g.frame_id.to_numpy()
    for i in range(1, len(g)):
        a, b = lanes[i - 1], lanes[i]
        if a == b or a > 6 or b > 6 or abs(a - b) != 1 or frames[i] - frames[i - 1] != 1:
            continue
        me = g.iloc[i]
        f = by_frame[frames[i]]
        same = f[(f.lane_id == b) & (f.vehicle_id != vid)]
        ahead = same[same.y > me.y]; behind = same[same.y <= me.y]
        rec = dict(vehicle=int(vid), frame=int(frames[i]), from_lane=int(a), to_lane=int(b),
                   v=float(me.v), vclass=int(me.v_class))
        if len(ahead):
            L = ahead.loc[ahead.y.idxmin()]
            rec['lead_gap'] = float(L.y - L['len'] - me.y); rec['lead_v'] = float(L.v)
        if len(behind):
            F = behind.loc[behind.y.idxmax()]
            rec['lag_gap'] = float(me.y - me['len'] - F.y); rec['lag_v'] = float(F.v)
        rows.append(rec)
r = pd.DataFrame(rows)
r = r[(r.get('lead_gap', 0) > -5) & (r.get('lag_gap', 0) > -5)]   # drop gross tracking overlaps
r['lag_time'] = r.lag_gap / r.lag_v.clip(lower=1.0)
r['lead_time'] = r.lead_gap / r.v.clip(lower=1.0)
def q(s):
    s = s.dropna()
    return {p: round(float(s.quantile(p)), 2) for p in (.1, .25, .5, .75, .9)}
out = dict(n=int(len(r)), v=q(r.v), lead_gap=q(r.lead_gap), lag_gap=q(r.lag_gap),
           lead_time=q(r.lead_time), lag_time=q(r.lag_time),
           lag_time_under_1s=round(float((r.lag_time < 1).mean()), 3))
json.dump(dict(summary=out, changes=r.to_dict('records')), open(os.path.join(HERE, '..', 'results', 'ngsim-lanechange.json'), 'w'))
print(json.dumps(out, indent=1))
