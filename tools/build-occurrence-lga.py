#!/usr/bin/env python3
"""
Resolve every catalogued occurrence to the LGA whose polygon contains it.

Nearest-centroid assignment is wrong often enough to matter — "Maru Gold Belt"
lands in Kaura Namoda because that centroid happens to be closer than Maru's.
Point-in-polygon is the correct test, with nearest-centroid kept only as a
fallback for points that fall just outside every polygon (coastline slivers,
simplified boundaries).

Writes data/occurrence-lga.json:  { "NMI-0001": {"lga": "Anka", "exact": true}, ... }

Run:  python3 tools/build-occurrence-lga.py
"""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LGA_DIR = ROOT / 'data' / 'lga'
OUT = ROOT / 'data' / 'occurrence-lga.json'


def load_deposits():
    """Pull the DEPOSITS array out of the ES module without a JS runtime."""
    src = (ROOT / 'js' / 'data' / 'fixtures.js').read_text()
    start = src.index('export const DEPOSITS = [') + len('export const DEPOSITS = ')
    depth, i = 0, start
    while i < len(src):
        if src[i] == '[':
            depth += 1
        elif src[i] == ']':
            depth -= 1
            if depth == 0:
                break
        i += 1
    return json.loads(src[start:i + 1])


def state_codes():
    src = (ROOT / 'js' / 'data' / 'fixtures.js').read_text()
    block = src[src.index('export const STATES = {'):src.index('export const DEPOSITS')]
    out = {}
    for m in re.finditer(r'"([^"]+)":\s*\{\s*"code":\s*"([A-Z]{2})"', block):
        out[m.group(1)] = m.group(2)
    return out


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


def contains(geom, x, y):
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    for poly in polys:
        if in_ring(x, y, poly[0]) and not any(in_ring(x, y, h) for h in poly[1:]):
            return True
    return False


def main():
    deposits = load_deposits()
    codes = state_codes()
    cache, out = {}, {}
    exact = fallback = missing = 0

    for d in deposits:
        code = codes.get(d['state'])
        path = LGA_DIR / f'{code}.geojson'
        if not code or not path.exists():
            missing += 1
            continue

        if code not in cache:
            cache[code] = json.loads(path.read_text())['features']
        feats = cache[code]

        hit = next((f for f in feats if contains(f['geometry'], d['lng'], d['lat'])), None)
        if hit:
            out[d['id']] = {'lga': hit['properties']['name'], 'exact': True}
            exact += 1
            continue

        # Outside every polygon — snap to the nearest centroid so the record is
        # still usable, but flag it so the UI can say "approximate".
        best, bd = None, 1e18
        for f in feats:
            c = f['properties']['centroid']
            q = (c[0] - d['lat']) ** 2 + (c[1] - d['lng']) ** 2
            if q < bd:
                bd, best = q, f['properties']['name']
        out[d['id']] = {'lga': best, 'exact': False}
        fallback += 1

    OUT.write_text(json.dumps(out, indent=0, sort_keys=True))
    print(f'{len(out)} occurrences  exact={exact} fallback={fallback} missing={missing}')
    print(f'wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
