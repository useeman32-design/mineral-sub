/**
 * DATA ACCESS LAYER
 * =================
 * Every number rendered in the UI comes through this module.
 * Today it resolves local placeholder fixtures; when the Laravel backend is
 * ready, swap the body of each method for a fetch() against the real endpoint.
 * No component reads fixtures directly, so nothing else has to change.
 *
 *   const api = new Api({ baseUrl: '/api/v1' });
 *   await api.getDashboardSummary();   ->  GET /api/v1/dashboard/summary
 */

import { STATES, DEPOSITS, COMMODITIES, ACTIVITY, RESOURCE_META } from './fixtures.js?v=0521807';
import { seeded } from '../core/utils.js?v=0521807';

/* Operator names for the placeholder registry. Real holder records arrive with
   the mining cadastre import. */
const OPERATORS = [
  'Segilola Resources Operating Ltd', 'Thor Explorations Nigeria',
  'Kian Smith Trust & Co.', 'Comet Minerals Ltd', 'Ratel Mining Nigeria',
  'Symbol Mining', 'Dangote Industries', 'BUA Mining & Cement',
  'Multiverse Mining & Exploration', 'Rockshield Resources',
  'Sahelian Mining Company', 'Zamfara Gold Consortium',
  'Jos Tin Holdings', 'Benue Barite Partners', 'Kogi Iron Nigeria',
];
const OPERATOR_STATUS = ['Producing', 'Development', 'Exploration', 'Care & maintenance'];

/* Descriptive reference copy for the commodity register. Replaced by the
   geological survey's own text once the minerals endpoint is live. */
const GRADE_NOTES = {
  gold: 'Artisanal workings report 3–12 g/t in quartz-vein material; bulk-tonnage potential untested at depth.',
  lithium: 'Pegmatite-hosted spodumene and lepidolite, 1.2–2.4% Li₂O in channel samples across the Nasarawa–Kogi belt.',
  tin: 'Alluvial and eluvial cassiterite, 0.4–1.8 kg/m³, with columbite-tantalite as a routine by-product.',
  iron: 'Banded ironstone at 35–52% Fe, beneficiation required for direct-reduction feedstock.',
  lead: 'Galena-sphalerite lodes averaging 6–18% Pb with silver credits of 40–90 g/t.',
  barite: 'Vein barite at 4.10–4.25 specific gravity, meeting API drilling-mud specification after milling.',
  limestone: 'High-calcium facies above 92% CaCO₃, supporting clinker and agricultural lime production.',
  marble: 'Dolomitic and calcitic marble, low iron staining, dimension-stone and filler grades.',
  coal: 'Sub-bituminous to bituminous, 4,800–6,300 kcal/kg, low sulphur in the Anambra basin seams.',
  bitumen: 'Tar-sand horizons at 8–14% bitumen saturation across the Ondo–Ogun belt.',
  oil: 'Light sweet crude, 32–46° API, low sulphur, from Niger Delta reservoir intervals.',
  gas: 'Associated and non-associated gas, high methane fraction, feeding LNG and domestic obligation.',
  kaolin: 'Primary and sedimentary kaolin, 78–86% brightness after beneficiation.',
  gypsum: 'Evaporite gypsum above 85% purity, cement retarder and plaster feedstock.',
  talc: 'Talc-tremolite schist bodies, cosmetic and industrial filler grades.',
  granite: 'Fresh porphyritic granite, low absorption, aggregate and dimension-stone quality.',
  clay: 'Ball and fire clays with refractory grades above 1,580 °C pyrometric cone equivalent.',
};

const HOST_ROCK = {
  gold: 'Birimian-equivalent schist belts and quartz-vein systems in the Nigerian Basement Complex.',
  lithium: 'Rare-metal pegmatites intruding Pan-African granitoids and migmatitic gneiss.',
  tin: 'Jurassic Younger Granite ring complexes and derived alluvial terraces.',
  iron: 'Precambrian banded iron formation within gneiss-migmatite terrain.',
  lead: 'Cretaceous Benue Trough sediments, fracture-controlled hydrothermal lodes.',
  barite: 'Vein fill within Benue Trough shale and sandstone sequences.',
  limestone: 'Cretaceous to Tertiary marine carbonate platforms.',
  marble: 'Metamorphosed carbonate lenses in the Basement Complex.',
  coal: 'Maastrichtian Mamu and Nsukka Formation deltaic sequences.',
  bitumen: 'Cretaceous Afowo Formation tar-sand reservoirs of the eastern Dahomey basin.',
  oil: 'Agbada Formation paralic sandstone reservoirs, Niger Delta.',
  gas: 'Agbada and deeper Akata Formation intervals, Niger Delta and offshore.',
  kaolin: 'Weathered feldspathic granite and sedimentary basin deposits.',
  gypsum: 'Evaporitic horizons in Cretaceous marine sequences.',
  talc: 'Ultramafic schist belts within the Basement Complex.',
  granite: 'Pan-African older granite and Jurassic younger granite plutons.',
  clay: 'Alluvial floodplain and lacustrine sedimentary sequences.',
};

const END_USES = {
  gold: 'Bullion, jewellery, central-bank reserves, electronics.',
  lithium: 'Battery cathodes, ceramics, glass, lubricating greases.',
  tin: 'Solder, tinplate, alloys; tantalum for capacitors.',
  iron: 'Steelmaking feedstock, direct-reduced iron, foundry.',
  lead: 'Batteries, radiation shielding, galvanising, silver recovery.',
  barite: 'Drilling-mud weighting agent, filler, radiography.',
  limestone: 'Cement clinker, agricultural lime, flux, construction.',
  marble: 'Dimension stone, terrazzo, mineral filler.',
  coal: 'Power generation, cement kilns, industrial heat.',
  bitumen: 'Road asphalt, roofing, waterproofing membranes.',
  oil: 'Refined fuels, petrochemical feedstock, export earnings.',
  gas: 'LNG export, power generation, fertiliser, domestic supply.',
  kaolin: 'Paper coating, ceramics, paint, pharmaceuticals.',
  gypsum: 'Cement retarder, plasterboard, agricultural conditioner.',
  talc: 'Cosmetics, plastics filler, paint, ceramics.',
  granite: 'Crushed aggregate, kerbstone, cladding, monuments.',
  clay: 'Bricks, refractories, tiles, ceramic ware.',
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class Api {
  constructor({ baseUrl = '/api/v1', live = false, latency = 180 } = {}) {
    this.baseUrl = baseUrl;
    this.live = live;      // flip to true once Laravel endpoints exist
    this.latency = latency;
    this._cache = new Map();
  }

  async _req(path, fixtureFn) {
    if (this.live) {
      const res = await fetch(this.baseUrl + path, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`API ${res.status} ${path}`);
      return res.json();
    }
    if (this._cache.has(path)) return this._cache.get(path);
    await delay(this.latency);
    const data = fixtureFn();
    this._cache.set(path, data);
    return data;
  }

  /** GET /geo/states — GeoJSON FeatureCollection, ADM1 */
  async getStateBoundaries() {
    if (this._cache.has('geo')) return this._cache.get('geo');
    const res = await fetch('data/nigeria-states.geojson');
    if (!res.ok) throw new Error('Failed to load state boundaries');
    const geo = await res.json();
    // Join analytical attributes onto each feature
    geo.features.forEach((f) => {
      const rec = STATES[f.properties.name];
      if (rec) Object.assign(f.properties, rec);
    });
    this._cache.set('geo', geo);
    return geo;
  }

  /** GET /dashboard/summary */
  getDashboardSummary() {
    return this._req('/dashboard/summary', () => ({
      kpis: [
        { id: 'occurrences', label: 'Mineral Occurrences', value: 3134, unit: 'sites', delta: 4.2,
          ctx: '+126 this quarter', color: 'var(--green)',
          series: [2810, 2864, 2903, 2955, 3008, 3061, 3134] },
        { id: 'blocks', label: 'Active Petroleum Blocks', value: 187, unit: 'blocks', delta: 1.6,
          ctx: '58 under appraisal', color: 'var(--cyan)',
          series: [174, 176, 179, 181, 182, 184, 187] },
        { id: 'titles', label: 'Mining Titles Issued', value: 4218, unit: 'titles', delta: -2.1,
          ctx: '312 expiring < 90d', color: 'var(--gold)',
          series: [4392, 4361, 4330, 4301, 4272, 4245, 4218] },
        { id: 'risk', label: 'High-Risk Zones', value: 47, unit: 'zones', delta: 6.8,
          ctx: '11 escalated', color: 'var(--red)',
          series: [38, 39, 41, 42, 44, 45, 47] },
      ],

      mineral: {
        occurrences: 3134,
        commodities: 38,
        highProspectivity: 335,
        moderateProspectivity: 812,
        surveyedStates: 37,
        split: [
          { label: 'Industrial', value: 1180, color: 'var(--cyan)' },
          { label: 'Metallic',   value: 1046, color: 'var(--gold)' },
          { label: 'Energy',     value: 512,  color: 'var(--green)' },
          { label: 'Gemstone',   value: 396,  color: 'var(--purple)' },
        ],
      },

      petroleum: {
        oilFields: 420,
        gasFields: 178,
        activeBlocks: 187,
        reservesOil: 37.5,   // billion barrels
        reservesGas: 209.5,  // TCF
        production: [1.32, 1.28, 1.35, 1.41, 1.38, 1.44, 1.47], // mbpd
      },

      risk: [
        { id: 'security',  label: 'Security-Restricted Zones', value: 47, sev: 'high', pct: 78,
          note: 'NW & NC corridors' },
        { id: 'environ',   label: 'Environmental Constraints', value: 129, sev: 'med', pct: 54,
          note: 'Reserves, wetlands, watersheds' },
        { id: 'access',    label: 'Accessibility Concerns', value: 86, sev: 'med', pct: 47,
          note: 'No all-season road access' },
        { id: 'community', label: 'Community / Land Disputes', value: 34, sev: 'low', pct: 26,
          note: 'Active mediation cases' },
      ],

      coverage: [
        { id: 'geological',  label: 'Geological Mapping', pct: 92, color: 'var(--green)',
          scale: '1:100,000', updated: 'Q2 2026' },
        { id: 'geochemical', label: 'Geochemical Sampling', pct: 68, color: 'var(--cyan)',
          scale: '41,200 samples', updated: 'Q1 2026' },
        { id: 'geophysical', label: 'Airborne Geophysics', pct: 74, color: 'var(--purple)',
          scale: 'Mag / Rad · 500 m', updated: 'Q4 2025' },
        { id: 'satellite',   label: 'Satellite Imagery', pct: 99, color: 'var(--gold)',
          scale: 'Sentinel-2 · 10 m', updated: 'Live' },
      ],

      commodities: COMMODITIES,
      activity: ACTIVITY,
      resourceMeta: RESOURCE_META,
    }));
  }

  /** GET /geo/deposits?bbox=&resource= */
  getDeposits() {
    return this._req('/geo/deposits', () => DEPOSITS);
  }

  /** GET /geo/states/:code — detail card payload */
  getStateProfile(name) {
    return this._req('/geo/states/' + name, () => STATES[name] || null);
  }

  /**
   * GET /minerals — commodity register.
   * Derives per-commodity rollups from the occurrence table so the shape
   * matches what the Laravel endpoint will return.
   */
  getCommodities() {
    return this._req('/minerals', () => {
      const byRes = new Map();
      DEPOSITS.forEach((d) => {
        if (!byRes.has(d.resource)) byRes.set(d.resource, []);
        byRes.get(d.resource).push(d);
      });

      const statesFor = (id) =>
        Object.entries(STATES)
          .filter(([, s]) => s.commodities?.includes(id))
          .map(([name, s]) => ({ name, code: s.code, prospectivity: s.prospectivity }))
          .sort((a, b) => b.prospectivity - a.prospectivity);

      return Object.entries(RESOURCE_META).map(([id, meta]) => {
        const sites = byRes.get(id) || [];
        const reg = COMMODITIES.find((c) => c.id === id);
        const states = statesFor(id);
        const producing = sites.filter((s) => s.status === 'Producing').length;
        // Deterministic placeholder so the register is stable between reloads.
        const r = seeded(id);
        return {
          id,
          label: meta.label,
          hex: meta.hex,
          colorVar: meta.color,
          category: meta.cat,
          occurrences: reg?.n ?? Math.round(40 + r() * 260),
          trend: reg?.trend ?? (r() > 0.55 ? 'up' : r() > 0.25 ? 'flat' : 'down'),
          share: reg?.pct ?? Math.round(10 + r() * 70),
          sites,
          siteCount: sites.length,
          producing,
          exploration: sites.length - producing,
          states,
          stateCount: states.length,
          grade: GRADE_NOTES[id] || 'Grade and tonnage records pending laboratory upload.',
          hostRock: HOST_ROCK[id] || 'Host lithology under review.',
          uses: END_USES[id] || 'Industrial applications under review.',
          maturity: producing > 0 ? 'Producing' : sites.length ? 'Exploration' : 'Reconnaissance',
          image: `assets/minerals/${id}.png`,
        };
      }).sort((a, b) => b.occurrences - a.occurrences);
    });
  }

  /** GET /minerals/:id */
  async getCommodity(id) {
    const all = await this.getCommodities();
    return all.find((c) => c.id === id) || null;
  }

  /**
   * GET /prospectivity/inputs — the scoring model's input table.
   * The model itself runs client-side today so criteria weights respond
   * instantly; once Laravel hosts it, POST the weights and return scored
   * targets from here instead.
   */
  getProspectivityInputs() {
    return this._req('/prospectivity/inputs', () =>
      Object.entries(STATES).map(([name, s]) => ({ name, ...s })));
  }

  /** Occurrence -> LGA lookup, resolved offline by point-in-polygon. */
  async getOccurrenceLgas() {
    if (this._cache.has('occlga')) return this._cache.get('occlga');
    const res = await fetch('data/occurrence-lga.json');
    const json = res.ok ? await res.json() : {};
    this._cache.set('occlga', json);
    return json;
  }

  /** LGA list for a state, from the ADM2 boundary files. */
  async getLgas(stateCode) {
    const key = 'lga:' + stateCode;
    if (this._cache.has(key)) return this._cache.get(key);
    const res = await fetch(`data/lga/${stateCode}.geojson`);
    if (!res.ok) return [];
    const geo = await res.json();
    const list = geo.features.map((f) => f.properties)
      .sort((a, b) => a.name.localeCompare(b.name));
    this._cache.set(key, list);
    return list;
  }

  /**
   * GET /minerals/:id/states/:state — commodity presence within one state,
   * broken down by LGA with operator records and geoscience evidence.
   */
  async getCommodityInState(commodityId, stateName) {
    const [all, occLga, meta] = await Promise.all([
      this.getCommodities(),
      this.getOccurrenceLgas(),
      Promise.resolve(STATES[stateName]),
    ]);
    const c = all.find((x) => x.id === commodityId);
    if (!c || !meta) return null;

    const lgas = await this.getLgas(meta.code);
    const sites = c.sites.filter((s) => s.state === stateName)
      .map((s) => ({ ...s, lga: occLga[s.id]?.lga || null, lgaExact: !!occLga[s.id]?.exact }));

    const withSites = new Map();
    sites.forEach((s) => {
      if (!s.lga) return;
      if (!withSites.has(s.lga)) withSites.set(s.lga, []);
      withSites.get(s.lga).push(s);
    });

    const rnd = seeded(commodityId + stateName);
    const operators = sites.filter((s) => s.tier === 'major' || rnd() > 0.45).map((s) => {
      const r = seeded(s.id + 'op');
      return {
        site: s.name,
        lga: s.lga,
        name: OPERATORS[Math.floor(r() * OPERATORS.length)],
        status: s.status === 'Producing' ? 'Producing'
          : OPERATOR_STATUS[Math.floor(r() * OPERATOR_STATUS.length)],
        since: 2009 + Math.floor(r() * 15),
        licence: `${meta.code}/${commodityId.slice(0, 2).toUpperCase()}/${1000 + Math.floor(r() * 8999)}`,
      };
    });

    // LGAs recording the commodity but with no operator on file — the open ground.
    const operatedLgas = new Set(operators.map((o) => o.lga));
    const unoperated = lgas
      .filter((l) => !operatedLgas.has(l.name))
      .map((l) => ({
        ...l,
        hasOccurrence: withSites.has(l.name),
        note: withSites.has(l.name)
          ? 'Occurrence recorded, no titled operator'
          : 'No catalogued occurrence',
      }));

    return {
      commodity: c,
      state: { name: stateName, ...meta },
      lgas,
      sites,
      byLga: [...withSites.entries()]
        .map(([name, list]) => ({
          name,
          sites: list,
          centroid: lgas.find((l) => l.name === name)?.centroid || null,
        }))
        .sort((a, b) => b.sites.length - a.sites.length),
      operators,
      unoperated,
      evidence: this._evidence(commodityId, stateName, meta),
    };
  }

  /**
   * Geochemical and geophysical evidence for a commodity in a state.
   * Deterministic placeholders shaped like the survey payloads that replace
   * them, so the UI does not change when real data lands.
   */
  _evidence(commodityId, stateName, meta) {
    const r = seeded(commodityId + stateName + 'ev');
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const pct = (lo, hi) => Math.round(lo + r() * (hi - lo));

    const GEOCHEM = {
      gold: ['Au in stream sediment', 'As pathfinder halo', 'Sb–Ag association'],
      lithium: ['Li in stream sediment', 'Cs–Rb–Ta indices', 'Be anomaly'],
      tin: ['Sn–Nb–Ta heavy mineral', 'Cassiterite panning counts', 'W association'],
      iron: ['Fe₂O₃ whole-rock', 'Magnetic susceptibility', 'Mn co-enrichment'],
      lead: ['Pb–Zn soil grid', 'Ag pathfinder', 'Ba halo'],
    };
    const GEOPHYS = ['Aeromagnetic residual', 'Radiometric K/Th ratio', 'Gravity Bouguer',
      'Induced polarisation', 'Airborne EM conductor'];

    return {
      geochemical: [
        { label: pick(GEOCHEM[commodityId] || ['Multi-element soil survey']),
          coverage: pct(38, 92), anomalies: pct(3, 34), strength: pct(45, 95) },
        { label: 'Regional stream sediment', coverage: pct(55, 96),
          anomalies: pct(6, 48), strength: pct(35, 88) },
      ].filter((v, i, a) => a.findIndex((x) => x.label === v.label) === i),
      geophysical: (() => {
        const pool = [...GEOPHYS];
        const take = () => pool.splice(Math.floor(r() * pool.length), 1)[0];
        return [
          { label: take(), coverage: pct(40, 95), anomalies: pct(2, 22), strength: pct(40, 92) },
          { label: take(), coverage: pct(25, 80), anomalies: pct(1, 18), strength: pct(30, 84) },
        ];
      })(),
      geological: {
        mapped: meta.coverage,
        summary: `${meta.coverage}% of ${stateName} is mapped at 1:100,000 or better. `
          + `${pct(2, 14)} structural corridors intersect the prospective horizon.`,
      },
    };
  }

  /** GET /system/health */
  getSystemHealth() {
    return this._req('/system/health', () => ({
      online: true, latencyMs: 42, nodes: 6, lastSync: '2 min ago', tiles: 'NMI-VEC v4.2',
    }));
  }
}

export const api = new Api();
