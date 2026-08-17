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

import { STATES, DEPOSITS, COMMODITIES, ACTIVITY, RESOURCE_META } from './fixtures.js?v=ef18581';
import { seeded } from '../core/utils.js?v=ef18581';
import { liveMode, getLiveTitles, getLiveStates, getLiveNational, loadProtectedAreas, loadSettlements } from './live.js?v=ef18581';

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

  /** Drop every memoised response — called when the data mode changes. */
  clearCache() { this._cache.clear(); }

  /** True when the app is serving real government datasets. */
  get isLive() { return liveMode.enabled; }

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
  async getDashboardSummary() {
    const base = await this._dashboardSample();
    if (!liveMode.enabled) return base;

    // Live: swap the two KPIs the real cadastre can actually evidence, and
    // mark them so the UI can show where the number came from.
    try {
      const nat = await getLiveNational();
      const kpis = base.kpis.map((k) => {
        if (k.id === 'titles') {
          return { ...k, value: nat.totalTitles, delta: 0, live: true,
            ctx: `${nat.states} states · ${Math.round(nat.totalAreaKm2).toLocaleString('en-US')} km² licensed` };
        }
        return k;
      });
      return { ...base, kpis, live: true };
    } catch (err) {
      console.error('[api] live dashboard failed, using sample', err);
      return base;
    }
  }

  _dashboardSample() {
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
  async getStateProfile(name) {
    if (liveMode.enabled) {
      const key = '/geo/states:live';
      let states = this._cache.get(key);
      if (!states) {
        ({ states } = await getLiveStates(STATES));
        this._cache.set(key, states);
      }
      return states[name] || null;
    }
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
  async getProspectivityInputs() {
    // The scoring engine reads titles/occurrences per state; in live mode the
    // title counts come from the real cadastre, so the ranking shifts to match.
    if (liveMode.enabled) {
      const key = '/prospectivity/inputs:live';
      if (this._cache.has(key)) return this._cache.get(key);
      const { states } = await getLiveStates(STATES);
      const rows = Object.entries(states).map(([name, s]) => ({ name, ...s }));
      this._cache.set(key, rows);
      return rows;
    }
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

  /**
   * GET /petroleum/blocks — upstream licence blocks.
   * Deterministic placeholders shaped like the DPR cadastre payload.
   */
  getPetroleumBlocks() {
    return this._req('/petroleum/blocks', () => {
      const out = [];
      const petro = Object.entries(STATES).filter(([, v]) => v.petroleum);
      const TERRAIN = ['Onshore', 'Swamp', 'Shallow offshore', 'Deep offshore'];
      const OPERATORS = ['Shell Nigeria E&P', 'TotalEnergies Nigeria', 'Chevron Nigeria',
        'NNPC Upstream', 'Seplat Energy', 'Oando Energy Resources',
        'Aiteo Eastern E&P', 'First E&P', 'Heirs Energies', 'Waltersmith Petroman'];

      petro.forEach(([name, st], si) => {
        const r = seeded(name + 'oil');
        const n = 2 + Math.floor(r() * 4);
        for (let i = 0; i < n; i += 1) {
          const kind = r() > 0.32 ? 'OML' : 'OPL';
          const terrain = TERRAIN[Math.floor(r() * TERRAIN.length)];
          const oil = Math.round(40 + r() * 900);
          const gas = Math.round(80 + r() * 4200);
          out.push({
            id: `${kind}-${100 + si * 7 + i}`,
            kind,
            state: name,
            code: st.code,
            terrain,
            operator: OPERATORS[Math.floor(r() * OPERATORS.length)],
            status: r() > 0.28 ? 'Producing' : r() > 0.12 ? 'Development' : 'Appraisal',
            areaKm2: Math.round(180 + r() * 1900),
            wells: Math.round(3 + r() * 46),
            oilBopd: oil * 10,
            gasMmscfd: Math.round(gas / 20),
            reservesMmboe: Math.round(oil / 6 + gas / 90),
            awarded: 1993 + Math.floor(r() * 30),
            expiry: 2027 + Math.floor(r() * 18),
            centroid: st.centroid,
          });
        }
      });
      return out.sort((a, b) => b.oilBopd - a.oilBopd);
    });
  }

  /**
   * GET /titles — mining cadastre.
   * Licence polygons are not in the fixture set, so each title carries the
   * state centroid; swap for real geometry when the cadastre lands.
   */
  async getMiningTitles() {
    // Live: the real cadastre, 10,125 titles from the Mining Cadastre Office.
    if (liveMode.enabled) {
      const key = '/titles:live';
      if (this._cache.has(key)) return this._cache.get(key);
      const rows = await getLiveTitles(STATES);
      this._cache.set(key, rows);
      return rows;
    }
    return this._req('/titles', () => {
      const out = [];
      const TYPES = [
        { id: 'EL', label: 'Exploration Licence', years: 3 },
        { id: 'SSML', label: 'Small Scale Mining Lease', years: 5 },
        { id: 'ML', label: 'Mining Lease', years: 25 },
        { id: 'QL', label: 'Quarry Lease', years: 5 },
        { id: 'RP', label: 'Reconnaissance Permit', years: 1 },
      ];
      const HOLDERS = ['Segilola Resources', 'Thor Explorations', 'Kian Smith Trust',
        'Comet Minerals', 'Ratel Mining', 'Symbol Mining', 'Dangote Industries',
        'BUA Mining', 'Multiverse Mining', 'Rockshield Resources', 'Sahelian Mining',
        'Zamfara Gold Consortium', 'Jos Tin Holdings', 'Kogi Iron Nigeria'];
      const YEAR = 2026;

      Object.entries(STATES).forEach(([name, st]) => {
        const r = seeded(name + 'title');
        // Sample the state's real title count so the register stays plausible.
        const n = Math.max(3, Math.round(st.titles / 26));
        for (let i = 0; i < n; i += 1) {
          const t = TYPES[Math.floor(r() * TYPES.length)];
          // Recent-weighted grant year: squaring the draw biases toward newer
          // titles, so the register reads live rather than mostly archival.
          const granted = 2008 + Math.floor((1 - r() * r()) * 17);
          const expiry = granted + t.years + Math.floor(r() * 4);
          const commodity = (st.commodities || ['gold'])[Math.floor(r() * (st.commodities || ['gold']).length)];
          const life = expiry - YEAR;
          out.push({
            id: `${st.code}/${t.id}/${2000 + Math.floor(r() * 7999)}`,
            type: t.id,
            typeLabel: t.label,
            state: name,
            code: st.code,
            holder: HOLDERS[Math.floor(r() * HOLDERS.length)],
            commodity,
            areaHa: Math.round(12 + r() * 2400),
            granted,
            expiry,
            status: life < 0 ? 'Expired' : life <= 1 ? 'Expiring' : 'Active',
            // Overlap is the cadastre's classic data-quality problem.
            overlap: r() > 0.88,
            centroid: st.centroid,
          });
        }
      });
      return out.sort((a, b) => a.expiry - b.expiry);
    });
  }

  /** GET /datasets — catalogue backing the Data Center. */
  async getDatasets() {
    const rows = await this._datasetsSample();
    if (!liveMode.enabled) return rows;
    // Live mode: reflect what is genuinely connected now.
    const LIVE = {
      titles: { status: 'Connected', source: 'Mining Cadastre Office', format: 'XLSX → JSON',
        records: 10125, quality: 92, updated: '31 May 2026', licence: 'Nigerian Government public data' },
      infra: { status: 'Connected', source: 'OpenStreetMap (Overpass)', format: 'JSON',
        records: 911, quality: 88, updated: '17 Aug 2026', licence: 'ODbL 1.0' },
    };
    const extra = [
      { id: 'protected', name: 'Protected areas (WDPA)', domain: 'Environment',
        source: 'Protected Planet', format: 'GeoJSON', sizeMb: 0.3, records: 325,
        status: 'Connected', quality: 95, updated: 'Aug 2026', licence: 'WDPA terms' },
      { id: 'population', name: 'Gridded population', domain: 'Environment',
        source: 'WorldPop 1 km', format: 'GeoTIFF', sizeMb: 4.9, records: 0,
        status: 'Connected', quality: 90, updated: '2020', licence: 'CC BY 4.0' },
    ];
    return [...rows.map((d) => (LIVE[d.id] ? { ...d, ...LIVE[d.id] } : d)), ...extra];
  }

  _datasetsSample() {
    return this._req('/datasets', () => {
      const DEFS = [
        ['adm1', 'State boundaries (ADM1)', 'Geospatial', 'geoBoundaries', 'GeoJSON', 316, 37, 'Connected', 100],
        ['adm2', 'LGA boundaries (ADM2)', 'Geospatial', 'geoBoundaries', 'GeoJSON', 4820, 774, 'Connected', 100],
        ['occurrence', 'Mineral occurrence register', 'Geoscience', 'NMI placeholder', 'JSON', 46, 64, 'Sample data', 62],
        ['commodity', 'Commodity register', 'Geoscience', 'NMI placeholder', 'JSON', 12, 17, 'Sample data', 70],
        ['prospectivity', 'Prospectivity inputs', 'Analytics', 'Derived', 'JSON', 8, 37, 'Derived', 88],
        ['risk', 'Risk factor inputs', 'Analytics', 'Derived', 'JSON', 8, 37, 'Derived', 84],
        ['petroleum', 'Petroleum licence blocks', 'Assets', 'NMI placeholder', 'JSON', 22, 0, 'Sample data', 55],
        ['titles', 'Mining cadastre', 'Assets', 'NMI placeholder', 'JSON', 64, 0, 'Sample data', 58],
        ['geochem', 'Regional geochemistry', 'Geoscience', 'Awaiting NGSA', 'CSV', 0, 0, 'Not connected', 0],
        ['geophys', 'Airborne geophysics', 'Geoscience', 'Awaiting NGSA', 'GeoTIFF', 0, 0, 'Not connected', 0],
        ['imagery', 'Satellite imagery', 'Geospatial', 'ArcGIS World Imagery', 'XYZ tiles', 0, 0, 'On demand', 100],
        ['infra', 'Roads & infrastructure', 'Geospatial', 'Awaiting OSM import', 'GeoJSON', 0, 0, 'Not connected', 0],
      ];
      return DEFS.map(([id, name, domain, source, format, sizeMb, records, status, quality]) => {
        const r = seeded(id + 'ds');
        return {
          id, name, domain, source, format,
          sizeMb, records, status, quality,
          updated: status === 'Not connected' ? null
            : `${Math.floor(r() * 27) + 1} ${['Jan', 'Mar', 'Jun', 'Aug', 'Nov'][Math.floor(r() * 5)]} 202${4 + Math.floor(r() * 2)}`,
          licence: source.includes('geoBoundaries') ? 'CC BY 4.0'
            : source.includes('ArcGIS') ? 'Esri terms' : 'Internal',
        };
      });
    });
  }

  /** GET /system/health */
  getSystemHealth() {
    return this._req('/system/health', () => ({
      online: true, latencyMs: 42, nodes: 6, lastSync: '2 min ago', tiles: 'NMI-VEC v4.2',
    }));
  }
}

export const api = new Api();
