#!/usr/bin/env node
/**
 * Resolve every catalogued occurrence to the LGA whose polygon contains it.
 *
 * Nearest-centroid assignment is wrong often enough to matter — "Maru Gold
 * Belt" lands in Kaura Namoda because that centroid happens to be closer than
 * Maru's. Point-in-polygon is the correct test, with nearest-centroid kept
 * only as a fallback for points that fall just outside every polygon
 * (coastline slivers, simplified boundaries).
 *
 * Writes data/occurrence-lga.json:
 *   { "NMI-0001": { "lga": "Anka", "exact": true }, ... }
 *
 * Run:  node tools/build-occurrence-lga.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LGA_DIR = path.join(ROOT, 'data', 'lga');
const OUT = path.join(ROOT, 'data', 'occurrence-lga.json');
const FIXTURES = path.join(ROOT, 'js', 'data', 'fixtures.js');

/** Pull an exported array/object literal out of the ES module by brace matching. */
function extractLiteral(src, exportName, open, close) {
  const marker = `export const ${exportName} = `;
  const start = src.indexOf(marker) + marker.length;
  let depth = 0;
  let i = start;
  for (; i < src.length; i += 1) {
    if (src[i] === open) depth += 1;
    else if (src[i] === close) {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return JSON.parse(src.slice(start, i + 1));
}

function loadDeposits(src) {
  return extractLiteral(src, 'DEPOSITS', '[', ']');
}

/** name -> two-letter code, read straight from the STATES block. */
function stateCodes(src) {
  const block = src.slice(src.indexOf('export const STATES = {'), src.indexOf('export const DEPOSITS'));
  const out = {};
  const re = /"([^"]+)":\s*\{\s*"code":\s*"([A-Z]{2})"/g;
  let m;
  while ((m = re.exec(block)) !== null) out[m[1]] = m[2];
  return out;
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y)) {
      const xint = ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-15) + xi;
      if (x < xint) inside = !inside;
    }
  }
  return inside;
}

function contains(geom, x, y) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.some((poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h)));
}

function main() {
  const src = fs.readFileSync(FIXTURES, 'utf8');
  const deposits = loadDeposits(src);
  const codes = stateCodes(src);

  const cache = new Map();
  const out = {};
  let exact = 0;
  let fallback = 0;
  let missing = 0;

  for (const d of deposits) {
    const code = codes[d.state];
    const file = path.join(LGA_DIR, `${code}.geojson`);
    if (!code || !fs.existsSync(file)) { missing += 1; continue; }

    if (!cache.has(code)) {
      cache.set(code, JSON.parse(fs.readFileSync(file, 'utf8')).features);
    }
    const feats = cache.get(code);

    const hit = feats.find((f) => contains(f.geometry, d.lng, d.lat));
    if (hit) {
      out[d.id] = { lga: hit.properties.name, exact: true };
      exact += 1;
      continue;
    }

    // Outside every polygon — snap to the nearest centroid so the record is
    // still usable, but flag it so the UI can say "approximate".
    let best = null;
    let bd = Infinity;
    for (const f of feats) {
      const c = f.properties.centroid;
      const q = (c[0] - d.lat) ** 2 + (c[1] - d.lng) ** 2;
      if (q < bd) { bd = q; best = f.properties.name; }
    }
    out[d.id] = { lga: best, exact: false };
    fallback += 1;
  }

  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 0));
  console.log(`${Object.keys(out).length} occurrences  exact=${exact} fallback=${fallback} missing=${missing}`);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}

main();
