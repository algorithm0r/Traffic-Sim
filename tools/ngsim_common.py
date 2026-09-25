"""Shared NGSIM episode extraction and batched IDM simulation (Stage 14)."""
import glob, os
import numpy as np, pandas as pd
from scipy.signal import savgol_filter

FT = 0.3048
DT, DELTA = 0.1, 4.0
HERE = os.path.dirname(os.path.abspath(__file__))


def default_csv():
    return sorted(glob.glob(os.path.join(HERE, '..', 'data', 'ngsim', '*.csv')))[0]


def load_episodes(path=None, min_secs=30, max_secs=90, max_lane=6, verbose=True):
    """Car-following episodes: same follower, leader and lane for >= min_secs; positions
    smoothed (Savitzky-Golay 2.1 s, cubic); tracking errors (|acc| > 8) dropped."""
    path = path or default_csv()
    df = pd.read_csv(path).drop_duplicates(['vehicle_id', 'frame_id']).sort_values(['vehicle_id', 'frame_id'])
    tracks = {}
    for vid, g in df.groupby('vehicle_id'):
        fr = g.frame_id.to_numpy()
        if len(fr) < 50 or np.any(np.diff(fr) != 1):
            continue
        ys = savgol_filter(g.local_y.to_numpy() * FT, 21, 3)
        v = np.gradient(ys, DT)
        tracks[vid] = dict(frame=fr, y=ys, v=v, acc=np.gradient(v, DT), lane=g.lane_id.to_numpy(),
                           prec=g.preceding.to_numpy(), length=float(g.v_length.iloc[0]) * FT,
                           vclass=int(g.v_class.iloc[0]))
    eps = []
    minN, maxN = int(min_secs * 10), int(max_secs * 10)
    for fid, f in tracks.items():
        n = len(f['frame']); i = 0
        while i < n:
            lead, lane = f['prec'][i], f['lane'][i]
            j = i
            while j < n and f['prec'][j] == lead and f['lane'][j] == lane:
                j += 1
            if lead != 0 and lead in tracks and lane <= max_lane and j - i >= minN:
                L = tracks[lead]
                f0, f1 = f['frame'][i], f['frame'][j - 1]
                li = np.searchsorted(L['frame'], f0)
                if li < len(L['frame']) and L['frame'][li] == f0 and li + (j - i) <= len(L['frame']) \
                   and L['frame'][li + (j - i) - 1] == f1 and np.all(L['lane'][li:li + (j - i)] == lane):
                    k = min(j - i, maxN)
                    sl, ll = slice(i, i + k), slice(li, li + k)
                    gap = L['y'][ll] - L['length'] - f['y'][sl]
                    if (np.all(gap > 0.5) and np.max(np.abs(f['acc'][sl])) < 8
                            and np.max(np.abs(L['acc'][ll])) < 8 and np.min(f['v'][sl]) >= -0.5):
                        eps.append(dict(follower=int(fid), leader=int(lead), lane=int(lane), vclass=f['vclass'],
                                        lead_len=L['length'], yf=f['y'][sl].copy(), vf=f['v'][sl].copy(),
                                        yl=L['y'][ll].copy(), vl=L['v'][ll].copy(), gap=gap))
            i = j
    if verbose:
        print(f'{os.path.basename(path)}: {len(tracks)} tracks, {len(eps)} episodes >= {min_secs:.0f} s', flush=True)
    return eps


class Batch:
    """All episodes padded into arrays so one call simulates S parameter sets × E episodes."""
    def __init__(self, eps):
        self.E = len(eps)
        self.n = np.array([len(e['gap']) for e in eps])
        Tm = self.n.max()
        pad = lambda key: np.array([np.pad(e[key], (0, Tm - len(e[key])), mode='edge') for e in eps])
        self.yl, self.vl, self.gobs = pad('yl'), pad('vl'), pad('gap')
        self.L = np.array([e['lead_len'] for e in eps])
        self.x0 = np.array([e['yf'][0] for e in eps])
        self.v0_ = np.array([max(e['vf'][0], 0.0) for e in eps])
        self.mask = np.arange(Tm)[None, :] < self.n[:, None]
        self.gmean = np.array([np.mean(e['gap']) for e in eps])

    def errors(self, P):
        """P: (S, 5) rows of (v0, T, s0, a, b) → (S, E) relative gap errors (+10 if a crash)."""
        v0, T, s0, a, b = [P[:, k][:, None] for k in range(5)]
        S = P.shape[0]
        x = np.repeat(self.x0[None, :], S, 0); v = np.repeat(self.v0_[None, :], S, 0)
        err = np.zeros((S, self.E)); crashed = np.zeros((S, self.E), bool)
        sab = 2 * np.sqrt(a * b)
        for t in range(1, self.yl.shape[1]):
            live = self.mask[:, t][None, :]
            s = self.yl[:, t - 1][None, :] - self.L[None, :] - x
            crashed |= (s <= 0) & live
            s = np.maximum(s, 0.1)
            sstar = s0 + np.maximum(0.0, v * T + v * (v - self.vl[:, t - 1][None, :]) / sab)
            acc = np.maximum(a * (1 - (v / v0) ** DELTA - (sstar / s) ** 2), -9.0)
            vn = np.maximum(v + acc * DT, 0.0)
            x = x + (v + vn) / 2 * DT
            v = vn
            d = self.yl[:, t][None, :] - self.L[None, :] - x - self.gobs[:, t][None, :]
            err += np.where(live, d * d, 0.0)
        e = np.sqrt(err / (self.n[None, :] - 1)) / self.gmean[None, :]
        return np.where(crashed, e + 10.0, e)
