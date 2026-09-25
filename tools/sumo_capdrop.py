"""Stage 16: the capacity-drop experiment reproduced in SUMO, side by side with capdrop.mjs.

  python tools/sumo_capdrop.py [--seeds 1,2,3,4,5] [--workers 3] [--cases merge,drop]
                               [--lc LC2013,SL2015] [--drivers ideal,human,default]

Same geometry, demand and driver population as capdrop.mjs:
  merge: 2 lanes; an onramp joins at 3160 m through an acceleration lane that ENDS at
         3440 m (260 m + half the 35-m taper); 600 veh/h on the ramp.
  drop:  3 lanes for 3000 m, the rightmost lane ENDS, 2 lanes after.
  Upstream demand (Poisson): 5 min fill, 30-min linear ramp to over-capacity, 30-min hold;
  merge 1800 → 3600 veh/h, drop 1800 → 4200 veh/h. Road ends at 8400 m. 8% trucks.
  Drivers: the archetypes read from src/params.js (via node), 10 sampled vTypes per class
  with the within-class spreads; SUMO's IDM (delta 4) with accel = a, decel = b, tau = T,
  minGap = s0, speedFactor = v0mult × 65 mph. 'ideal' = actionStepLength 0.1 s (every
  step); 'human' = actionStepLength = each class's mean reaction time — SUMO's action step
  is the same mechanism as our tReact (decide, then hold). SUMO has no attention model.
  'default' = SUMO out of the box: its default passenger and truck vTypes (Krauss, sigma 0.5,
  speedFactor spread), nothing matched to our drivers.
  Lane changing: LC2013 (lane-based) and SL2015 (sublane, continuous lateral, 0.8 m).
SUMO settings: step 0.1 s; teleporting DISABLED (a stuck vehicle stays stuck, as in ours);
collisions warned and counted. SSM device: TTC < 1.5 s and DRAC ≥ 4.9 m/s² encounters.
Detectors at the capdrop positions, 60-s bins, analysed with capdrop.mjs's exact rules, plus
one threshold-free measure applied identically to both models (SUMO's congested state sits
near the 60%-of-free-speed breakdown line, which makes rule-based breakdown timing fragile):
  P = highest 5-min mean downstream flow before minute 45; H = mean downstream flow over
  minutes 45-65, when demand has exceeded capacity for 10+ min in both; hold drop = 1 - H/P.
Our own runs are read from results/capdrop.json and scored by the same function.
Insertion: departPos base, departSpeed = the last vehicle's on the lane (leader-matched, as
our entrance inserts at an equilibrium gap). SUMO's default departSpeed 'max' at a fixed
position caps a mixed-speed fleet near 1,800 veh/h, since a fast type cannot enter behind a
slow one; departPos 'last' is worse, silently inserting vehicles far down the road.
Raw SUMO output goes to data/sumo/ (gitignored); results/sumo-capdrop.{json,md}.
"""
import argparse, json, os, re, subprocess, sys, time, random, math, zlib
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
import sumo
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
BIN = os.path.join(sumo.SUMO_HOME, 'bin')
ap = argparse.ArgumentParser()
ap.add_argument('--seeds', default='1,2,3,4,5')
ap.add_argument('--workers', type=int, default=3)  # a workstation: keep it light
ap.add_argument('--cases', default='merge,drop')
ap.add_argument('--lc', default='LC2013,SL2015')
ap.add_argument('--drivers', default='ideal,human,default')
ap.add_argument('--timeout', type=float, default=5400, help='wall-clock seconds per run before it is stopped')
ap.add_argument('--reuse', action='store_true', help='re-score existing data/sumo output instead of re-simulating')
args = ap.parse_args()
seeds = [int(s) for s in args.seeds.split(',')]
OUT = os.path.join(ROOT, 'data', 'sumo'); os.makedirs(OUT, exist_ok=True)

# ---- the model's archetypes, read from the sim itself so the two cannot drift apart
node = subprocess.run(['node', '-e', "import('./headless.mjs').then(({loadSim})=>{const c=loadSim();"
                       "console.log(JSON.stringify({arch:c.ARCHETYPES, mph:c.PARAMETERS.speedLimitMph, lw:c.PARAMETERS.laneWidth}))})"],
                      cwd=ROOT, capture_output=True, text=True, check=True)
M = json.loads(node.stdout)
ARCH, LIMIT, LW = M['arch'], M['mph'] * 0.44704, M['lw']

GEOM = {
    'merge': dict(lanesDown=2, up=(1800, 3600), ramp=600, det=(2400, 4400)),
    'drop':  dict(lanesDown=2, up=(1800, 4200), ramp=0, det=(2200, 4200)),
}
END = 8400

def write(path, text):
    with open(path, 'w') as f: f.write(text)

def build_net(case, d):
    nod, edg, con = [], [], []
    if case == 'merge':
        nod = [('n0', 0, 0), ('gore', 3160, 0), ('accend', 3440, 0), ('end', END, 0), ('r0', 3100, -10)]
        edg = [('up', 'n0', 'gore', 2, LIMIT), ('acc', 'gore', 'accend', 3, LIMIT), ('down', 'accend', 'end', 2, LIMIT),
               ('ramp', 'r0', 'gore', 1, 12.0)]
        con = [('up', 0, 'acc', 1), ('up', 1, 'acc', 2), ('ramp', 0, 'acc', 0), ('acc', 1, 'down', 0), ('acc', 2, 'down', 1)]
        dets = [('up', 2400, 2, 'u'), ('down', 4400 - 3440, 2, 'd')]
    else:
        nod = [('n0', 0, 0), ('drop', 3000, 0), ('end', END, 0)]
        edg = [('up', 'n0', 'drop', 3, LIMIT), ('down', 'drop', 'end', 2, LIMIT)]
        con = [('up', 1, 'down', 0), ('up', 2, 'down', 1)]
        dets = [('up', 2200, 3, 'u'), ('down', 4200 - 3000, 2, 'd')]
    write(f'{d}/net.nod.xml', '<nodes>' + ''.join(f'<node id="{i}" x="{x}" y="{y}" type="priority"/>' for i, x, y in nod) + '</nodes>')
    write(f'{d}/net.edg.xml', '<edges>' + ''.join(f'<edge id="{i}" from="{a}" to="{b}" numLanes="{n}" speed="{v:.3f}" width="{LW}"/>' for i, a, b, n, v in edg) + '</edges>')
    write(f'{d}/net.con.xml', '<connections>' + ''.join(f'<connection from="{a}" fromLane="{fl}" to="{b}" toLane="{tl}"/>' for a, fl, b, tl in con) + '</connections>')
    subprocess.run([os.path.join(BIN, 'netconvert'), '-n', f'{d}/net.nod.xml', '-e', f'{d}/net.edg.xml', '-x', f'{d}/net.con.xml',
                    '-o', f'{d}/net.net.xml', '--no-turnarounds', '--junctions.corner-detail', '0', '--offset.disable-normalization'],
                   check=True, capture_output=True)
    add = '<additional>'
    for e, pos, n, tag in dets:
        for ln in range(n):
            add += f'<inductionLoop id="{tag}_{ln}" lane="{e}_{ln}" pos="{pos}" freq="60" file="det.xml"/>'
    add += '<edgeData id="ed" freq="60" file="edge.xml"/></additional>'
    write(f'{d}/add.xml', add)
    return dets

def vtypes(drivers, rng, lc):
    if drivers == 'default':   # SUMO out of the box: vClass defaults only
        return ('<vTypeDistribution id="fleet">'
                f'<vType id="car" probability="0.92" vClass="passenger" laneChangeModel="{lc}"/>'
                f'<vType id="lorry" probability="0.08" vClass="truck" laneChangeModel="{lc}"/></vTypeDistribution>')
    cars = {k: v for k, v in ARCH.items() if not v['truck']}
    tot = sum(v['share'] for v in cars.values())
    classes = [(k, 0.92 * v['share'] / tot) for k, v in cars.items()] + [('truck', 0.08)]
    out = '<vTypeDistribution id="fleet">'
    g = lambda pair, lo, hi: min(hi, max(lo, rng.gauss(pair[0], pair[1])))
    for k, share in classes:
        a = ARCH[k]
        for i in range(10):
            act = 0.1 if drivers == 'ideal' else max(0.1, round(a['tReact'][0], 1))
            out += (f'<vType id="{k}{i}" probability="{share / 10:.5f}" carFollowModel="IDM" delta="4" '
                    f'accel="{g(a["a"], 0.3, 2.5):.3f}" decel="{g(a["b"], 0.8, 3.0):.3f}" tau="{g(a["T"], 0.6, 3.0):.3f}" '
                    f'minGap="{g(a["s0"], 1.0, 5.0):.3f}" speedFactor="{g(a["v0mult"], 0.7, 1.4):.3f}" speedDev="0" '
                    f'length="{a["len"]}" width="{a["width"]}" emergencyDecel="9" maxSpeed="45" '
                    f'actionStepLength="{act}" laneChangeModel="{lc}" vClass="{"truck" if a["truck"] else "passenger"}"'
                    + (' latAlignment="center" maxSpeedLat="1.5"' if lc == 'SL2015' else '') + '/>')
    return out + '</vTypeDistribution>'

def routes(case, g, drivers, lc, seed):
    rng = random.Random(seed * 7919 + zlib.crc32(f'{case}|{drivers}|{lc}'.encode()) % 1000)  # stable across processes
    r = '<routes>' + vtypes(drivers, rng, lc)
    r += '<route id="main" edges="' + ('up acc down' if case == 'merge' else 'up down') + '"/>'
    if case == 'merge': r += '<route id="onramp" edges="ramp acc down"/>'
    # SUMO reads route files incrementally and expects departures sorted: the ramp flow (begin 0)
    # must precede the per-minute mainline flows or it is silently never loaded.
    if g['ramp']:
        r += (f'<flow id="ramp" type="fleet" route="onramp" begin="0" end="3900" period="exp({g["ramp"] / 3600:.5f})" '
              f'departLane="0" departSpeed="last" departPos="base"/>')
    lo, hi = g['up']
    for m in range(65):
        q = lo if m < 5 else (lo + (hi - lo) * (m - 5) / 30 if m < 35 else hi)
        r += (f'<flow id="up{m}" type="fleet" route="main" begin="{m * 60}" end="{(m + 1) * 60}" '
              f'period="exp({q / 3600:.5f})" departLane="free" departSpeed="last" departPos="base"/>')
    return r + '</routes>'

def hold_drop(bins):
    """Threshold-free: P = peak 5-min downstream flow before minute 45, H = mean over 45-64."""
    q = [b['downQ'] for b in bins]
    P = max(sum(q[i - 4:i + 1]) / 5 for i in range(8, 45))
    H = sum(q[45:65]) / 20
    return dict(P=P, H=H, holdDrop=1 - H / P)

# SUMO's outputs are parsed by regex, so a run killed at a deadlock (truncated XML) still reads
IV = re.compile(r'<interval begin="([\d.]+)"[^>]*? id="([ud])_\d+" nVehContrib="(\d+)"[^>]*? speed="([-\d.]+)"')

def down_flow(det_xml):
    """Per-minute downstream vehicle counts so far (for the deadlock watcher)."""
    q = {}
    for b, tag, n, _ in IV.findall(open(det_xml).read()):
        if tag == 'd': q[int(float(b) // 60)] = q.get(int(float(b) // 60), 0) + int(n)
    return q

def deadlock_minute(q, upto):
    """First minute of >= 5 consecutive minutes with nothing crossing the downstream detector."""
    for m in range(5, upto - 4):
        if all(q.get(k, 0) == 0 for k in range(m, m + 5)): return m
    return -1

def analyse(det_xml, lanesDown):
    counts = {}
    for b, tag, n, sp in IV.findall(open(det_xml).read()):
        m = int(round(float(b) / 60)); n = int(n); sp = float(sp)
        c = counts.setdefault(m, {'u_n': 0, 'u_s': 0.0, 'd_n': 0})
        if tag == 'u':
            c['u_n'] += n; c['u_s'] += sp * n if n > 0 and sp >= 0 else 0
        else:
            c['d_n'] += n
    bins = []
    for m in range(65):
        c = counts.get(m, {'u_n': 0, 'u_s': 0.0, 'd_n': 0})
        bins.append(dict(m=m, upV=c['u_s'] / c['u_n'] if c['u_n'] else float('nan'), downQ=c['d_n'] * 60 / lanesDown))
    fin = lambda x: not math.isnan(x)
    recorded = max(counts) + 1 if counts else 0   # a killed run's record stops here
    dl = deadlock_minute({b['m']: b['downQ'] for b in bins[:recorded]}, recorded)
    if recorded < 65 and dl < 0: return dict(deadlock=-1, truncated=recorded, tb=-1, drop=float('nan'), bins=bins)
    if dl >= 0: return dict(deadlock=dl, tb=-1, drop=float('nan'), bins=bins)
    free = sorted(b['upV'] for b in bins[3:8] if fin(b['upV']))
    vFree = free[len(free) // 2] if free else float('nan')
    thr = 0.6 * vFree
    tb = -1
    for i in range(6, len(bins) - 4):
        if all(fin(b['upV']) and b['upV'] < thr for b in bins[i:i + 5]):
            tb = i; break
    roll = lambda i: sum(b['downQ'] for b in bins[i - 4:i + 1]) / 5
    preMax = pre10 = qdr = float('nan'); qdrBins = 0; stalls = 0
    if tb > 0:
        preMax = max([roll(i) for i in range(8, tb)] or [float('nan')])
        pre = bins[max(8, tb - 10):tb]
        pre10 = sum(b['downQ'] for b in pre) / len(pre) if pre else float('nan')
        after = [b for b in bins[tb + 5:] if not fin(b['upV']) or b['upV'] < thr]
        qdrBins = len(after)
        if qdrBins >= 10: qdr = sum(b['downQ'] for b in after) / qdrBins
        stalls = sum(1 for b in bins[tb:] if b['downQ'] == 0)
    return dict(deadlock=-1, vFree=vFree, tb=tb, preMax=preMax, pre10=pre10, qdr=qdr, qdrBins=qdrBins, stalls=stalls, **hold_drop(bins),
                drop=1 - qdr / preMax if tb > 0 else float('nan'), drop10=1 - qdr / pre10 if tb > 0 else float('nan'), bins=bins)

def run(job):
    case, lc, drivers, seed = job
    d = os.path.join(OUT, f'{case}_{lc}_{drivers}_{seed}'); os.makedirs(d, exist_ok=True)
    g = GEOM[case]
    build_net(case, d)
    write(f'{d}/routes.rou.xml', routes(case, g, drivers, lc, seed))
    cmd = [os.path.join(BIN, 'sumo'), '-n', 'net.net.xml', '-r', 'routes.rou.xml', '-a', 'add.xml',
           '--step-length', '0.1', '--end', '3900', '--seed', str(seed), '--time-to-teleport', '-1',
           '--collision.action', 'warn', '--collision.mingap-factor', '0', '--no-step-log', 'true',
           '--duration-log.disable', 'true', '--statistic-output', 'stats.xml', '--default.action-step-length', '0.1',
           '--collision-output', 'col.xml',
           '--device.ssm.probability', '1', '--device.ssm.measures', 'TTC DRAC', '--device.ssm.thresholds', '1.5 4.9',
           '--device.ssm.trajectories', 'false', '--device.ssm.range', '60', '--device.ssm.file', 'ssm.xml']
    if lc == 'SL2015': cmd += ['--lateral-resolution', '0.8']
    t0 = time.time()
    killed = False
    finished = lambda: (os.path.exists(f'{d}/stats.xml') and '<vehicles' in open(f'{d}/stats.xml').read())                        or os.path.exists(f'{d}/killed.flag')   # stats.xml is created at startup, filled at the end
    if not (args.reuse and finished()):
        # watch the run: without teleporting a deadlock never clears, and SUMO then crawls
        # toward t=3900 s under a growing queue; stop it once nothing has crossed the
        # downstream detector for 5 min (recorded as a deadlock, not scored for capacity)
        for f in ('stats.xml', 'col.xml', 'killed.flag'):
            if os.path.exists(f'{d}/{f}'): os.remove(f'{d}/{f}')
        proc = subprocess.Popen(cmd, cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        while proc.poll() is None:
            time.sleep(20)
            q = down_flow(f'{d}/det.xml') if os.path.exists(f'{d}/det.xml') else {}
            reason = 'deadlock' if q and deadlock_minute(q, max(q) + 1) >= 0 else                      'timeout' if time.time() - t0 > args.timeout else None
            if reason:
                proc.kill(); proc.wait(); killed = reason; write(f'{d}/killed.flag', reason); break
        if not killed and proc.returncode != 0:
            return dict(case=case, lc=lc, drivers=drivers, seed=seed, error=proc.stderr.read()[-500:])
    res = analyse(f'{d}/det.xml', g['lanesDown'])
    txt = open(f'{d}/edge.xml').read()
    vkm = sum(float(ss) * float(sp) / 1000 for ss, sp in
              re.findall(r'<edge id="[^"]*" sampledSeconds="([\d.]+)"[^>]*? speed="([\d.]+)"', txt))
    col = open(f'{d}/col.xml').read().count('<collision ') if os.path.exists(f'{d}/col.xml') else 0
    ttc = drac = 0
    for blk in re.findall(r'<conflict .*?</conflict>', open(f'{d}/ssm.xml').read(), re.S):
        mt = re.search(r'<minTTC [^>]*value="([\d.]+)"', blk); md = re.search(r'<maxDRAC [^>]*value="([\d.]+)"', blk)
        if mt and float(mt.group(1)) < 1.5: ttc += 1
        if md and float(md.group(1)) >= 4.9: drac += 1
    res.update(case=case, lc=lc, drivers=drivers, seed=seed, vehKm=vkm, collisions=col, ttcConflicts=ttc,
               dracConflicts=drac, secs=round(time.time() - t0, 1),
               killed=killed or (open(f'{d}/killed.flag').read() if os.path.exists(f'{d}/killed.flag') else False))
    if res['killed'] == 'timeout': res.update(deadlock=-1, timeout=True, tb=-1, drop=float('nan'))
    return res

jobs = [(c, lc, dr, s) for c in args.cases.split(',') for lc in args.lc.split(',') for dr in args.drivers.split(',') for s in seeds]
t0 = time.time(); out = []
with ThreadPoolExecutor(args.workers) as ex:
    for r in ex.map(run, jobs):
        out.append(r)
        if 'error' in r: print('ERROR', r['case'], r['lc'], r['drivers'], r['seed'], r['error'], flush=True)
        else: print(f"  {r['case']:5s} {r['lc']} {r['drivers']:7s} seed {r['seed']}: " +
                    (f"DEADLOCK at minute {r['deadlock']}" if r['deadlock'] >= 0 else
                     f"STOPPED without deadlock ({r.get('killed') or 'truncated record'})" if r.get('timeout') or r.get('truncated') else
                     f"tb {r['tb']} pre-max {r['preMax']:.0f} QDR {r['qdr']:.0f} drop {100 * r['drop']:.1f}%  "
                     f"P {r['P']:.0f} H {r['H']:.0f} hold drop {100 * r['holdDrop']:.1f}%") +
                    f"  collisions {r['collisions']}  TTC<1.5 {r['ttcConflicts']}  DRAC>=0.5g {r['dracConflicts']}  "
                    f"veh-km {r['vehKm']:.0f}  [{r['secs']} s]", flush=True)

# ---- report: SUMO rows, then this model's capdrop.json runs scored by the same functions
NL = '\n'
fin = lambda x: x is not None and not math.isnan(x)

def summarise(label, c, lc, dr, rs, near=None):
    dead = [r for r in rs if r.get('deadlock', -1) >= 0]
    cut = [r for r in rs if r.get('timeout') or r.get('truncated')]   # stopped without a deadlock: unscored
    live = [r for r in rs if r.get('deadlock', -1) < 0 and r not in cut]
    ok = [r for r in live if r['tb'] > 0 and fin(r['drop'])]
    m = lambda k, rr: sum(r[k] for r in rr) / len(rr) if rr else float('nan')
    km = sum(r['vehKm'] for r in rs) or float('nan')
    row = dict(model=label, case=c, lc=lc, drivers=dr, n=len(rs), broke=len(ok), drop=m('drop', ok), qdr=m('qdr', ok),
               deadlocks=len(dead), deadlockMin=[r['deadlock'] for r in dead], unscored=len(cut),
               P=m('P', live), H=m('H', live), holdDrop=m('holdDrop', live),
               holdRange=[min(r['holdDrop'] for r in live), max(r['holdDrop'] for r in live)] if live else None,
               collisions=sum(r['collisions'] for r in rs), vehKm=km)
    if near: row.update(ttc=1000 * sum(r[near[0]] for r in rs) / km, hard=1000 * sum(r[near[1]] for r in rs) / km)
    return row

rows = []
for c in args.cases.split(','):
    for lc in args.lc.split(','):
        for dr in args.drivers.split(','):
            rs = [r for r in out if r.get('case') == c and r.get('lc') == lc and r.get('drivers') == dr and 'error' not in r]
            if rs: rows.append(summarise('SUMO', c, lc, dr, rs, ('ttcConflicts', 'dracConflicts')))
ours = []
# this model's baseline (capdrop.json) and, when present, its SUMO-style gap-acceptance variant
# (capdrop.mjs --gap follower --out capdrop-gapf-<case>): the mechanism test for the difference
import glob
srcs = [('this model', os.path.join(ROOT, 'results', 'capdrop.json'))] +        [('this model, follower gap', f) for f in sorted(glob.glob(os.path.join(ROOT, 'results', 'capdrop-gapf-*.json')))]
for label, fn in srcs:
    cj = json.load(open(fn))
    for name, runs in cj['cases'].items():
        if name.endswith(':bins'): continue
        geom, body, dr = name.split('-')
        rs = []
        for r, bins in zip(runs, cj['cases'][name + ':bins']):
            r = dict(r, **hold_drop(bins)); r['collisions'] = r.get('crashes', 0); rs.append(r)
        # the lane body runs the 1D passes, which keep no near-crash bookkeeping: not measured, not zero
        measured = 'near' in runs[0] and body != 'lane'
        ours.append(summarise(label, geom, body + ' body', dr, rs, ('near', 'evasive') if measured else None))

pct = lambda x: f'{100 * x:.1f}%' if fin(x) else '–'
num = lambda x, f='{:.0f}': f.format(x) if fin(x) else '–'

def line(r):
    rng_ = f" ({100 * r['holdRange'][0]:.0f} to {100 * r['holdRange'][1]:.0f})" if r['holdRange'] else ''
    return (f"| {r['model']} | {r['case']} | {r['lc']} | {r['drivers']} | {num(r['P'])} | {num(r['H'])} | {pct(r['holdDrop'])}{rng_} | "
            f"{r['broke']}/{r['n']}" + (f" ({r['deadlocks']} deadlocked)" if r['deadlocks'] else '') + f" | {pct(r['drop'])} | {r['collisions']} | {num(r.get('ttc', float('nan')), '{:.2f}')} | "
            f"{num(r.get('hard', float('nan')), '{:.2f}')} | {r['vehKm'] / 1000:.0f}k |" + NL)

ver = subprocess.run([os.path.join(BIN, 'sumo'), '--version'], capture_output=True, text=True).stdout.splitlines()[0]
md = ('# Capacity drop and conflicts: this model vs SUMO' + NL + NL +
      f'{ver}; same geometry, demand and driver population as capdrop.mjs; SUMO seeds {seeds}. '
      f'Generated {time.strftime("%Y-%m-%d %H:%M")}. Protocol: tools/sumo_capdrop.py; discussion: sumo-note.md.' + NL + NL +
      'P = peak 5-min downstream flow before minute 45; H = mean downstream flow over minutes 45-65 (veh/h/lane); '
      'hold drop = 1 - H/P. "Rule" columns use capdrop.mjs\'s breakdown rule (upstream speed below 60% of free flow '
      'for 5 min) and its drop vs the 5-min pre-breakdown max. Conflicts per 1000 veh·km: SUMO = SSM encounters with '
      'min TTC < 1.5 s / with max DRAC >= 4.9 m/s²; this model = near-crash episodes (TTC < 1.5 s, leader ahead) / '
      'those with braking >= 4.9 m/s².' + NL + NL +
      '| model | case | lane change / body | drivers | P | H | hold drop (range) | rule: broke | rule: drop | collisions | TTC<1.5 | hard (≥0.5 g) | veh·km |' + NL +
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|' + NL)
for r in ours + rows: md += line(r)
os.makedirs(os.path.join(ROOT, 'results'), exist_ok=True)
json.dump(dict(rows=rows, ours=ours, runs=[{k: v for k, v in r.items() if k != 'bins'} for r in out],
               downQ={f"{r['case']}_{r['lc']}_{r['drivers']}_{r['seed']}": [b['downQ'] for b in r['bins']] for r in out if 'bins' in r}),
          open(os.path.join(ROOT, 'results', 'sumo-capdrop.json'), 'w'), indent=1)
open(os.path.join(ROOT, 'results', 'sumo-capdrop.md'), 'w', encoding='utf-8').write(md)
print(md)
print(f'[{(time.time() - t0) / 60:.1f} min]')
