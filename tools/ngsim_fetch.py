"""Fetch an NGSIM trajectory subset from the public data.transportation.gov API (Socrata
dataset 8ect-6jqj) into data/ngsim/ (gitignored). Stage 14.

  python tools/ngsim_fetch.py [--location i-80] [--start-ms 1113433135300] [--secs 900]

NGSIM units are feet, ft/s, ms. Only the columns the calibration needs are pulled.
Rows are paged (Socrata caps a page) and de-duplicated on (vehicle_id, frame_id).
"""
import argparse, csv, io, os, sys, time, urllib.parse, urllib.request

BASE = 'https://data.transportation.gov/resource/8ect-6jqj.csv'
COLS = 'vehicle_id,frame_id,global_time,local_x,local_y,v_length,v_width,v_class,v_vel,lane_id,preceding'

ap = argparse.ArgumentParser()
ap.add_argument('--location', default='i-80')
ap.add_argument('--start-ms', type=int, default=1113433135300)   # I-80 first period, 4:00 pm
ap.add_argument('--secs', type=int, default=900)
ap.add_argument('--page', type=int, default=100000)
args = ap.parse_args()

root = os.path.join(os.path.dirname(__file__), '..', 'data', 'ngsim')
os.makedirs(root, exist_ok=True)
out = os.path.join(root, f"{args.location.replace('-', '')}_{args.start_ms}_{args.secs}s.csv")
end = args.start_ms + args.secs * 1000
where = f"location='{args.location}' AND global_time >= {args.start_ms} AND global_time < {end}"

seen = set()
rows = 0
with open(out, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(COLS.split(','))
    offset = 0
    while True:
        q = urllib.parse.urlencode({'$select': COLS, '$where': where, '$order': ':id',
                                    '$limit': args.page, '$offset': offset})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(BASE + '?' + q, timeout=300) as r:
                    text = r.read().decode('utf-8')
                break
            except Exception as e:
                print('retry', attempt, e, file=sys.stderr); time.sleep(5 * (attempt + 1))
        else:
            sys.exit('fetch failed')
        rd = csv.reader(io.StringIO(text))
        header = next(rd)
        page = 0
        for r in rd:
            page += 1
            key = (r[0], r[1])
            if key in seen: continue
            seen.add(key)
            w.writerow(r); rows += 1
        print(f'offset {offset}: +{page} rows, kept {rows}', flush=True)
        if page < args.page: break
        offset += args.page
print('wrote', out, rows, 'rows')
