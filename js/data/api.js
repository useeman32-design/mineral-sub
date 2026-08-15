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

import { STATES, DEPOSITS, COMMODITIES, ACTIVITY, RESOURCE_META } from './fixtures.js?v=5b08fd6';

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

  /** GET /system/health */
  getSystemHealth() {
    return this._req('/system/health', () => ({
      online: true, latencyMs: 42, nodes: 6, lastSync: '2 min ago', tiles: 'NMI-VEC v4.2',
    }));
  }
}

export const api = new Api();
