/**
 * LIVE DATA SOURCE
 * ================
 * Loads the real government datasets in `data/reference/` and reshapes them to
 * the exact contracts the app already consumes, so switching between sample and
 * live data changes the numbers without changing a single component.
 *
 *   liveMode.enabled          -> boolean
 *   liveMode.set(true)        -> persist + notify, api cache cleared by caller
 *   liveMode.subscribe(fn)
 *
 * Datasets (see docs/DATA-INVENTORY.md for provenance):
 *   mining-titles.json      10,125 titles, Mining Cadastre Office, 31 May 2026
 *   titles-summary.json     per-state + national aggregates derived from above
 *   protected-areas.geojson 325 WDPA protected areas
 *   ng-settlements-osm.json 911 OSM settlements
 *
 * Anything the real files cannot supply (petroleum blocks, occurrence grades)
 * stays on the sample generator and is labelled as such in the Data Center —
 * we never dress placeholder numbers up as official ones.
 */

const KEY = 'nmi.liveData';
const listeners = new Set();

let enabled = (() => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
})();

export const liveMode = {
  get enabled() { return enabled; },

  set(on) {
    const next = !!on;
    if (next === enabled) return false;
    enabled = next;
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* quota */ }
    listeners.forEach((fn) => { try { fn(enabled); } catch (e) { console.error('[live]', e); } });
    return true;
  },

  toggle() { return liveMode.set(!enabled); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/* ------------------------------------------------------------------ *
 * Loaders — each file fetched once, then memoised
 * ------------------------------------------------------------------ */

const cache = new Map();

async function load(name, path) {
  if (cache.has(name)) return cache.get(name);
  const p = fetch(path)
    .then((r) => {
      if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
      return r.json();
    })
    .catch((err) => {
      console.error('[live] failed to load', path, err);
      cache.delete(name);           // allow a retry on the next call
      throw err;
    });
  cache.set(name, p);
  return p;
}

export const loadTitles = () => load('titles', 'data/reference/mining-titles.json');
export const loadTitlesSummary = () => load('summary', 'data/reference/titles-summary.json');
export const loadProtectedAreas = () => load('protected', 'data/reference/protected-areas.geojson');
export const loadSettlements = () => load('settlements', 'data/reference/ng-settlements-osm.json');
export const loadMineralSites = () => load('sites', 'data/reference/mineral-sites.json');
export const loadFootprints = () => load('footprints', 'data/reference/mining-footprints.geojson');

/* ------------------------------------------------------------------ *
 * Shaping — real records into the app's existing contracts
 * ------------------------------------------------------------------ */

const TYPE_LABEL = {
  EL: 'Exploration Licence',
  ML: 'Mining Lease',
  SSML: 'Small Scale Mining Lease',
  QL: 'Quarry Lease',
  QLS: 'Quarry Lease (Small)',
  RP: 'Reconnaissance Permit',
};

/** Register expects hectares; the cadastre publishes km². */
const KM2_TO_HA = 100;

/**
 * The published cadastre contains a handful of corrupt dates — raw Excel serial
 * numbers (`46059`), transposed digits (`0810/2030`, `4048`) and placeholders
 * (`1900-02-02`). Rather than render a title as expiring in the year 810, treat
 * an implausible year as unknown so the UI can say so honestly.
 */
function plausibleYear(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})/);
  if (!m) return null;
  const y = +m[1];
  return y >= 1960 && y <= 2100 ? y : null;
}

/**
 * Real mining titles in the shape `js/modules/titles.js` already renders.
 *
 * A title granted across several states stays ONE row — splitting it per state
 * would inflate the register (10,125 titles became 10,789 rows) and misreport
 * the national total. The primary state drives filtering; every state and LGA
 * on the grant is kept so the record reads truthfully.
 */
export async function getLiveTitles(states) {
  const raw = await loadTitles();
  const year = new Date().getFullYear();

  return raw.titles.map((t, i) => {
    const list = t.states.length ? t.states : ['Unknown'];
    const primary = list[0];
    const meta = states?.[primary];
    const expiryYear = plausibleYear(t.expiry);
    const grantedYear = plausibleYear(t.granted);
    const life = expiryYear === null ? null : expiryYear - year;

    return {
      id: String(t.code || `T-${i}`),
      cadastreId: String(t.code || ''),
      type: t.type,
      typeLabel: TYPE_LABEL[t.type] || t.type,
      state: primary,
      states: list,
      code: meta?.code || '',
      lga: t.lgas[0] || null,
      lgas: t.lgas,
      holder: t.holder || 'Not recorded',
      commodity: (t.minerals[0] || 'unspecified').toLowerCase(),
      commodities: t.minerals,
      areaHa: Math.round((t.areaKm2 || 0) * KM2_TO_HA),
      areaKm2: t.areaKm2 || 0,
      cu: t.cu || null,
      granted: grantedYear,
      expiry: expiryYear,
      grantedDate: t.granted,
      expiryDate: t.expiry,
      status: life === null ? 'Unknown' : life < 0 ? 'Expired' : life <= 1 ? 'Expiring' : 'Active',
      // A grant spanning more than one state is the cadastre's real
      // cross-boundary flag — surfaced in the register's Integrity filter.
      overlap: list.length > 1,
      centroid: meta?.centroid || null,
    };
  }).sort((a, b) => (a.expiry ?? 9999) - (b.expiry ?? 9999));
}

/**
 * Per-state analytical attributes rebuilt from the real cadastre.
 * Keeps every field `STATES[name]` provides so prospectivity, risk and the map
 * continue to work; only the title-derived numbers become real.
 */
export async function getLiveStates(sampleStates) {
  const [summary, protectedAreas] = await Promise.all([
    loadTitlesSummary(),
    loadProtectedAreas().catch(() => null),
  ]);

  // Protected-area count per state is not in WDPA attributes, so use the
  // national figure as context rather than inventing a per-state split.
  const out = {};
  Object.entries(sampleStates).forEach(([name, rec]) => {
    const s = summary.byState[name];
    out[name] = {
      ...rec,
      titles: s ? s.titles : 0,
      titlesActive: s ? s.active : 0,
      titlesExpiring: s ? s.expiring : 0,
      titlesExpired: s ? s.expired : 0,
      licensedKm2: s ? s.areaKm2 : 0,
      titleLgas: s ? s.lgaCount : 0,
      topMinerals: s ? s.topMinerals : [],
      _liveTitles: true,
    };
  });

  return { states: out, summary, protectedAreas };
}

/** National headline figures from the real cadastre. */
export async function getLiveNational() {
  const summary = await loadTitlesSummary();
  return summary.national;
}

/**
 * Provenance rows for the Data Center, describing what live mode actually
 * swapped in. Honest about what is still sample data.
 */
export function liveDatasetStatus() {
  return {
    titles: { status: 'Connected', source: 'Mining Cadastre Office', records: 10125,
      quality: 92, updated: '31 May 2026', format: 'XLSX → JSON' },
    protected: { status: 'Connected', source: 'Protected Planet / WDPA', records: 325,
      quality: 95, updated: 'Aug 2026', format: 'Shapefile → GeoJSON' },
    settlements: { status: 'Connected', source: 'OpenStreetMap (Overpass)', records: 911,
      quality: 88, updated: '17 Aug 2026', format: 'JSON' },
    population: { status: 'Connected', source: 'WorldPop 1 km', records: 0,
      quality: 90, updated: '2020', format: 'GeoTIFF' },
    footprints: { status: 'Connected', source: 'Maus et al. 2022 / OSM (Zenodo)', records: 160,
      quality: 84, updated: '2022', format: 'GeoPackage → GeoJSON' },
    sites: { status: 'Partial', source: 'USGS minfac + MRDS + OpenStreetMap', records: 165,
      quality: 61, updated: '2026', format: 'CSV + Overpass → JSON' },
  };
}
