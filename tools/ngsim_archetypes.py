"""Stage 14: turn the per-episode NGSIM fits into archetype car-following parameters.

  python tools/ngsim_archetypes.py [--max-err 0.25]

Cars only (NGSIM v_class 2), fits with relative gap error <= max-err. Episodes are split by
fitted time headway T into the archetypes' car shares (aggressive 20 : normal 50 : cautious
20 of the 90% that are cars), and each segment's mean and SD of T, s0, a and b become that
archetype's [mean, sd]. Segmenting on T and averaging the rest inside each segment keeps
the parameters' correlations (IDM fits trade T against s0); drawing marginals
independently would not. v0 is not identifiable from these data (the drivers rarely
approach free speed) and is left as it is. Trucks are fitted separately if there are
enough truck-follower episodes. Prints the result and writes results/ngsim-archetypes.json.
"""
import argparse, json, os
import numpy as np, pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('--max-err', type=float, default=0.25)
ap.add_argument('--min-trucks', type=int, default=15)
args = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(here, '..', 'results', 'ngsim-calib.json')))
r = pd.DataFrame(d['episodes'])
good = r[r.err <= args.max_err]
cars, trucks = good[good.vclass == 2], good[good.vclass == 3]
print(f'{len(r)} episodes; {len(good)} with err <= {args.max_err}; cars {len(cars)}, trucks {len(trucks)}')

shares = {'aggressive': 0.20, 'normal': 0.50, 'cautious': 0.20}
tot = sum(shares.values())
cuts = np.cumsum([0] + [v / tot for v in shares.values()])
q = cars['T'].quantile(cuts[1:-1]).to_numpy()
edges = np.concatenate([[-np.inf], q, [np.inf]])
out = {}
for i, name in enumerate(shares):
    seg = cars[(cars['T'] > edges[i]) & (cars['T'] <= edges[i + 1])]
    out[name] = {k: [round(float(seg[k].mean()), 2), round(float(seg[k].std()), 2)] for k in ['T', 's0', 'a', 'b']}
    out[name]['n'] = int(len(seg))
if len(trucks) >= args.min_trucks:
    out['truck'] = {k: [round(float(trucks[k].mean()), 2), round(float(trucks[k].std()), 2)] for k in ['T', 's0', 'a', 'b']}
    out['truck']['n'] = int(len(trucks))
for k, v in out.items():
    print(f'  {k:10s} n={v["n"]:4d}  ' + '  '.join(f'{p} {v[p][0]:.2f}±{v[p][1]:.2f}' for p in ['T', 's0', 'a', 'b']))
fleet = cars[['T', 's0', 'a', 'b']].describe().loc[['mean', 'std', '25%', '50%', '75%']].round(2)
print(fleet.to_string())
json.dump(dict(max_err=args.max_err, n_cars=int(len(cars)), n_trucks=int(len(trucks)), archetypes=out),
          open(os.path.join(here, '..', 'results', 'ngsim-archetypes.json'), 'w'), indent=1)
print('wrote results/ngsim-archetypes.json')
