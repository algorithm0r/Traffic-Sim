"""Stage 17: cut-ins in NGSIM I-80, the data side of the question Stage 16 raised: do real
lane changers enter in front of followers closing fast, and how hard do those followers brake?

  python tools/ngsim_cutins.py

Lane changes as in tools/ngsim_lanechange.py (a switch of lane_id between consecutive frames
among mainline lanes 1-6, i.e. the changer's centre crossing the line), but with positions
smoothed as in the Stage 14 calibration (Savitzky-Golay 2.1 s, cubic) so speeds and
accelerations are not raw-tracking noise. At the crossing: the new follower's (lag's) gap,
closing speed (lag speed - changer speed), TTC and required deceleration (closing² / 2 gap);
and the lag's hardest deceleration over the next 4 s (its response; the smoothing window
blunts peaks, so this is a lower bound on true peak braking). Braking is also reported as
the hardest 1-s mean deceleration (Δv over 1 s), the measure compared with the model, and
against a CONTROL: the same statistic for random vehicle-moments in lanes 1-6 with no lane
change nearby — congested followers brake for stop-and-go anyway. Writes
results/ngsim-cutins.json.

AT ENTRY: the same kinematics at the moment the changer's near edge first crossed the line
(smoothed lateral centre ± half width past the lane line, scanning back from the lane_id
switch; lane lines = median smoothed lateral position at switches between each lane pair).
This is when the model's conflicts begin (probes/mergeconflict.mjs: median onset 0.5 s into
the change); at the centre crossing the follower has usually already responded.
"""
import json, os
import numpy as np, pandas as pd
from scipy.signal import savgol_filter
from ngsim_common import default_csv, FT, DT, HERE

df = pd.read_csv(default_csv()).drop_duplicates(['vehicle_id', 'frame_id']).sort_values(['vehicle_id', 'frame_id'])
tracks = {}
for vid, g in df.groupby('vehicle_id'):
    fr = g.frame_id.to_numpy()
    if len(fr) < 50 or np.any(np.diff(fr) != 1):
        continue
    y = savgol_filter(g.local_y.to_numpy() * FT, 21, 3)
    v = np.gradient(y, DT)
    tracks[int(vid)] = dict(f0=int(fr[0]), y=y, v=v, acc=np.gradient(v, DT), lane=g.lane_id.to_numpy(),
                            x=savgol_filter(g.local_x.to_numpy() * FT, 21, 3), w=float(g.v_width.iloc[0]) * FT,
                            len=float(g.v_length.iloc[0]) * FT, vclass=int(g.v_class.iloc[0]))

# lane lines from where lane ids switch
sw = {}
for t in tracks.values():
    for i in range(1, len(t['lane'])):
        a, b = int(t['lane'][i - 1]), int(t['lane'][i])
        if abs(a - b) == 1 and max(a, b) <= 7: sw.setdefault(min(a, b), []).append(t['x'][i])
LINE = {a: float(np.median(xs)) for a, xs in sw.items()}   # line between lane a and a+1
print('lane lines (m):', {k: round(v, 2) for k, v in sorted(LINE.items())})

def at(t, frame):
    i = frame - t['f0']
    return i if 0 <= i < len(t['y']) else None

# index vehicles by frame for neighbour lookup
by_frame = {}
for vid, t in tracks.items():
    for i in range(len(t['y'])):
        by_frame.setdefault(t['f0'] + i, []).append(vid)

def lag_at(vid, b, frame, me_y, me_len):
    best, bg, bj = None, np.inf, None
    for o in by_frame.get(frame, []):
        if o == vid: continue
        u = tracks[o]; j = at(u, frame)
        if j is None or int(u['lane'][j]) != b: continue
        g = me_y - me_len - u['y'][j]
        if u['y'][j] <= me_y and g < bg: best, bg, bj = o, g, j
    return best, bg, bj

rows, entries = [], []
for vid, t in tracks.items():
    lanes = t['lane']
    for i in range(1, len(lanes)):
        a, b = int(lanes[i - 1]), int(lanes[i])
        ramp = a == 7 and b == 6          # onramp (Powell St auxiliary lane) merges: entry only
        if not ramp and (a == b or a > 6 or b > 6 or abs(a - b) != 1):
            continue
        frame = t['f0'] + i
        me_y, me_v = t['y'][i], t['v'][i]
        # entry: scan back while the near edge is past the line toward b
        line, up = LINE[min(a, b)], b > a
        e = i
        while e - 1 >= 0 and i - (e - 1) <= 80 and int(t['lane'][e - 1]) == a and                 ((t['x'][e - 1] + t['w'] / 2 >= line) if up else (t['x'][e - 1] - t['w'] / 2 <= line)):
            e -= 1
        if e < i and i - e < 80:
            fe = t['f0'] + e
            lg, lgap, lj2 = lag_at(vid, b, fe, t['y'][e], t['len'])
            if lg is not None and -2 < lgap <= 100:
                cl = tracks[lg]['v'][lj2] - t['v'][e]
                entries.append(dict(ramp=ramp, v=float(t['v'][e]), lag_gap=float(lgap), closing=float(cl), lead_s=(i - e) * DT,
                                    req=float(cl ** 2 / (2 * max(lgap, 0.1))) if cl > 0 else 0.0,
                                    ttc=float(lgap / cl) if cl > 0 else None))
        lag, lag_gap = None, np.inf
        for o in by_frame.get(frame, []):
            if o == vid: continue
            u = tracks[o]; j = at(u, frame)
            if j is None or int(u['lane'][j]) != b: continue
            g = me_y - t['len'] - u['y'][j]
            if u['y'][j] <= me_y and g < lag_gap: lag, lag_gap, lj = o, g, j
        if ramp or lag is None or lag_gap < -2 or lag_gap > 100:   # none within 100 m, or a tracking overlap
            continue
        u = tracks[lag]
        closing = u['v'][lj] - me_v
        resp = u['acc'][lj:lj + 40]
        vv = u['v'][lj:lj + 41]
        brake1 = float(min(vv[k + 10] - vv[k] for k in range(len(vv) - 10))) if len(vv) >= 30 else None
        rows.append(dict(vehicle=vid, frame=frame, v=float(me_v), lag_v=float(u['v'][lj]), lag_gap=float(lag_gap),
                         closing=float(closing), req=float(closing ** 2 / (2 * max(lag_gap, 0.1)) if closing > 0 else 0.0),
                         ttc=float(lag_gap / closing) if closing > 0 else None,
                         lag_min_acc=float(resp.min()) if len(resp) >= 20 else None, lag_brake1=brake1,
                         changer_acc=float(t['acc'][i]), lag_vclass=u['vclass']))

r = pd.DataFrame(rows)
# control: random (vehicle, frame) moments on the mainline, same 4-s window, no lane change by
# the vehicle or its current leader within +-4 s of the moment (approximated by lane constancy)
rng = np.random.default_rng(1)
ctrl = []
ids = list(tracks)
while len(ctrl) < 3000:
    t = tracks[ids[rng.integers(len(ids))]]
    if len(t['v']) < 90: continue
    j = int(rng.integers(40, len(t['v']) - 45))
    if t['lane'][j] > 6 or np.any(t['lane'][j - 40:j + 41] != t['lane'][j]): continue
    vv = t['v'][j:j + 41]
    ctrl.append(float(min(vv[k + 10] - vv[k] for k in range(31))))
ctrl = pd.Series(ctrl)
def q(s):
    s = pd.Series(s).dropna()
    return {p: round(float(s.quantile(p)), 2) for p in (.1, .25, .5, .75, .9, .99)}
ttc = r.ttc.dropna()
out = dict(
    n=int(len(r)), changer_v=q(r.v), lag_v=q(r.lag_v), lag_gap=q(r.lag_gap), closing=q(r.closing),
    share_closing_over={str(c): round(float((r.closing > c).mean()), 3) for c in (2, 5, 8, 11)},
    required_decel=q(r.req), share_required_over={str(c): round(float((r.req > c).mean()), 3) for c in (1, 2, 3.4, 4.9)},
    share_ttc_under_1_5=round(float((ttc < 1.5).sum() / len(r)), 3),
    lag_min_acc=q(r.lag_min_acc), share_lag_braking_over={str(c): round(float((r.lag_min_acc < -c).mean()), 3) for c in (2, 3, 4.9)},
    lag_brake1=q(r.lag_brake1), control_brake1=q(ctrl),
    share_brake1_over={str(c): [round(float((r.lag_brake1 < -c).mean()), 3), round(float((ctrl < -c).mean()), 3)] for c in (1, 2, 3, 4.9)},
)
def entry_summary(E):
    ettc = E.ttc.dropna()
    return dict(n=int(len(E)), changer_v=q(E.v), secs_before_crossing=q(E.lead_s), lag_gap=q(E.lag_gap), closing=q(E.closing),
        share_closing_over={str(c): round(float((E.closing > c).mean()), 3) for c in (2, 5, 8)},
        share_required_over={str(c): round(float((E.req > c).mean()), 3) for c in (2, 3.4, 4.9)},
        share_ttc_under_1_5=round(float((ettc < 1.5).sum() / len(E)), 3))
E_all = pd.DataFrame(entries)
out['ramp_merges_at_entry'] = entry_summary(E_all[E_all.ramp])
E = E_all[~E_all.ramp]
ettc = E.ttc.dropna()
out['at_entry'] = dict(n=int(len(E)), secs_before_crossing=q(E.lead_s), lag_gap=q(E.lag_gap), closing=q(E.closing),
    share_closing_over={str(c): round(float((E.closing > c).mean()), 3) for c in (2, 5, 8)},
    share_required_over={str(c): round(float((E.req > c).mean()), 3) for c in (2, 3.4, 4.9)},
    share_ttc_under_1_5=round(float((ettc < 1.5).sum() / len(E)), 3))
json.dump(dict(summary=out, changes=r.to_dict('records'), entries=entries), open(os.path.join(HERE, '..', 'results', 'ngsim-cutins.json'), 'w'))
print(json.dumps(out, indent=1))
