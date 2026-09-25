"""Stage 14: latent-class calibration of the archetypes against NGSIM car-following.

  python tools/ngsim_classes.py [--iters 6]

Per-episode IDM fits (ngsim_calib.py) are not transferable: in congested data half the
fits sit at a bound for s0 or b, and small-T/large-s0 fits reproduce the same gaps at 7 m/s
while implying half-second headways at 30 m/s. So the archetypes are calibrated as a
POPULATION instead: K car classes plus trucks, each ONE parameter set, fitted jointly over
the episodes assigned to it, with every episode assigned to the class that explains it best
(hard-assignment EM). Bounds are kept to values plausible at highway speed. v0 is fixed at
each archetype's current value (not identifiable at these speeds). The class shares come
out of the data.

Objective per class: mean over its episodes of min(relative gap error, 1) — capped so a few
tracking failures cannot dominate. Also reports the same statistics for the sim's current
(pre-calibration) archetypes on the same episodes. Writes results/ngsim-classes.json.
"""
import argparse, json, os, time
import numpy as np
from scipy.optimize import differential_evolution
from ngsim_common import load_episodes, Batch, HERE

ap = argparse.ArgumentParser()
ap.add_argument('--iters', type=int, default=6)
ap.add_argument('--seed', type=int, default=3)
ap.add_argument('--fix-b', action='store_true',
                help='hold b at each archetype literature value (not identifiable from congested data)')
ap.add_argument('--holdout', action='store_true',
                help='fit on even-numbered followers, report errors on the odd-numbered (held-out drivers)')
args = ap.parse_args()
t0 = time.time()
eps = load_episodes()
MPH = 0.44704
# current archetypes: v0mult × 65 mph, T, s0, a, b
OLD = {'aggressive': (1.16, 1.00, 2.0, 1.4, 2.1), 'normal': (1.04, 1.45, 2.5, 1.0, 1.7),
       'cautious': (0.94, 1.85, 3.0, 0.8, 1.4), 'truck': (0.88, 1.70, 3.5, 0.6, 1.2)}
v0 = {k: m * 65 * MPH for k, (m, *_rest) in OLD.items()}
# plausible at highway speed: headway, standstill gap, acceleration, comfortable braking
BOUNDS = [(0.8, 2.4), (1.0, 4.0), (0.4, 3.0), (0.8, 4.0)]

def bounds_for(name):
    if not args.fix_b:
        return BOUNDS
    b = OLD[name][4]
    return BOUNDS[:3] + [(b - 1e-6, b + 1e-6)]

cars = [e for e in eps if e['vclass'] == 2]
trucks = [e for e in eps if e['vclass'] == 3]
test_cars = []
if args.holdout:   # split by DRIVER, so no driver is in both halves
    test_cars = [e for e in cars if e['follower'] % 2 == 1]
    cars = [e for e in cars if e['follower'] % 2 == 0]
print(f'{len(cars)} car-follower episodes, {len(trucks)} truck-follower episodes', flush=True)
Bc, Bt = Batch(cars), Batch(trucks)

def full(name, p):   # p = (T, s0, a, b) → (v0, T, s0, a, b)
    return np.array([v0[name], *p])

def fit_class(name, B, idx, x0=None):
    if len(idx) == 0:
        return x0
    sub = lambda P: np.minimum(B.errors(np.column_stack([np.full(P.shape[1], v0[name]), P.T]))[:, idx], 1.0).mean(1)
    bd = bounds_for(name)
    res = differential_evolution(sub, bd, vectorized=True, updating='deferred', popsize=10,
                                 maxiter=60, tol=1e-7, seed=args.seed, polish=False,
                                 init='latinhypercube' if x0 is None else np.vstack([np.clip(x0, [b[0] for b in bd], [b[1] for b in bd]), np.random.default_rng(args.seed).uniform([b[0] for b in bd], [b[1] for b in bd], (39, 4))]))
    return res.x

names = ['aggressive', 'normal', 'cautious']
# baseline: the current archetypes on these episodes
oldP = np.array([full(k, OLD[k][1:]) for k in names])
E_old = Bc.errors(oldP)
Et_old = Bt.errors(np.array([full('truck', OLD['truck'][1:])]))[0] if trucks else np.array([])
# initialise from the current archetypes' car-following parameters
params = {k: np.clip(np.array(OLD[k][1:]), [b[0] for b in bounds_for(k)], [b[1] for b in bounds_for(k)]) for k in names}
assign = E_old.argmin(0)
for it in range(args.iters):
    for ci, k in enumerate(names):
        params[k] = fit_class(k, Bc, np.where(assign == ci)[0], params[k])
    E = Bc.errors(np.array([full(k, params[k]) for k in names]))
    new = E.argmin(0)
    changed = int((new != assign).sum()); assign = new
    shares = [round(float((assign == ci).mean()), 3) for ci in range(len(names))]
    print(f'iter {it}: moved {changed}  shares {shares}  median assigned err {np.median(E.min(0)):.3f}  '
          + '  '.join(f'{k} T{params[k][0]:.2f} s0{params[k][1]:.2f} a{params[k][2]:.2f} b{params[k][3]:.2f}' for k in names)
          + f'  [{(time.time() - t0) / 60:.1f} min]', flush=True)
    if changed == 0:
        break
truckP = fit_class('truck', Bt, np.arange(len(trucks))) if trucks else None
Et = Bt.errors(np.array([full('truck', truckP)]))[0] if trucks else np.array([])

def stats(e):
    e = np.minimum(e, 10)
    return dict(median=round(float(np.median(e)), 3), p75=round(float(np.quantile(e, .75)), 3),
                p90=round(float(np.quantile(e, .9)), 3), crashes=int((e >= 10).sum()))
summary = dict(
    n_cars=len(cars), n_trucks=len(trucks), bounds=BOUNDS,
    classes={k: dict(T=round(float(params[k][0]), 3), s0=round(float(params[k][1]), 3), a=round(float(params[k][2]), 3),
                     b=round(float(params[k][3]), 3), share=round(float((assign == i).mean()), 3), v0=round(v0[k], 2))
             for i, k in enumerate(names)},
    truck=dict(T=round(float(truckP[0]), 3), s0=round(float(truckP[1]), 3), a=round(float(truckP[2]), 3),
               b=round(float(truckP[3]), 3), v0=round(v0['truck'], 2)) if trucks else None,
    errors=dict(new_best_of_classes=stats(E.min(0)), old_best_of_archetypes=stats(E_old.min(0)),
                old_normal=stats(E_old[1]), new_normal=stats(E[1]),
                trucks_new=stats(Et) if trucks else None, trucks_old=stats(Et_old) if trucks else None))
if args.holdout:
    Bx = Batch(test_cars)
    Ex_new = Bx.errors(np.array([full(k, params[k]) for k in names]))
    Ex_old = Bx.errors(oldP)
    summary['holdout'] = dict(n_test=len(test_cars), new_best_of_classes=stats(Ex_new.min(0)),
                              old_best_of_archetypes=stats(Ex_old.min(0)))
summary['fix_b'] = bool(args.fix_b)
fname = 'ngsim-classes' + ('-fixb' if args.fix_b else '') + ('-holdout' if args.holdout else '') + '.json'
json.dump(summary, open(os.path.join(HERE, '..', 'results', fname), 'w'), indent=1)
print(json.dumps(summary, indent=1))
print(f'[{(time.time() - t0) / 60:.1f} min]')
