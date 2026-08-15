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

import { STATES, DEPOSITS, COMMODITIES, ACTIVITY, RESOURCE_META } from './fixtures.js?v=e0ff5e1';
import { seeded } from '../core/utils.js?v=e0ff5e1';

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

  /** GET /system/health */
  getSystemHealth() {
    return this._req('/system/health', () => ({
      online: true, latencyMs: 42, nodes: 6, lastSync: '2 min ago', tiles: 'NMI-VEC v4.2',
    }));
  }
}

export const api = new Api();
