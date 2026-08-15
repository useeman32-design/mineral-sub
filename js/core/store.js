/**
 * Tiny observable application store.
 * Holds cross-module state (selected state, active filters, map view) so that
 * switching modules preserves context. Replace/extend freely when the Laravel
 * API is wired in — modules only ever read via store.get() and subscribe().
 */

class Store {
  constructor(initial = {}) {
    this._state = initial;
    this._subs = new Map(); // key -> Set<fn>
    this._any = new Set();
  }

  get(key) { return key ? this._state[key] : this._state; }

  set(patch) {
    const changed = [];
    for (const [k, v] of Object.entries(patch)) {
      if (this._state[k] !== v) { this._state[k] = v; changed.push(k); }
    }
    if (!changed.length) return;
    changed.forEach((k) => (this._subs.get(k) || []).forEach((fn) => fn(this._state[k], k)));
    this._any.forEach((fn) => fn(this._state, changed));
  }

  /** subscribe('selectedState', fn) or subscribe(fn) for any change */
  subscribe(key, fn) {
    if (typeof key === 'function') { this._any.add(key); return () => this._any.delete(key); }
    if (!this._subs.has(key)) this._subs.set(key, new Set());
    this._subs.get(key).add(fn);
    return () => this._subs.get(key).delete(fn);
  }
}

export const store = new Store({
  // shell
  route: 'overview',
  railCollapsed: false,

  // geographic drill context: nation -> state -> lga -> local -> prospect
  drill: { level: 'nation', nation: 'Nigeria', state: null, lga: null, prospect: null },
  selectedState: null,
  hoveredState: null,
  /** Cross-module navigation request, consumed by the receiving module. */
  pendingFocus: null,

  // map view
  basemap: 'vector',          // 'vector' | 'satellite'
  zoom: 6,
  showLabels: true,
  showGraticule: true,

  // layer + filter state (drives map rendering; API-ready shape)
  layers: { deposits: true, prospectivity: true, graticule: true, risk: false, titles: false, infrastructure: false },
  filters: {
    resources: ['gold', 'lithium', 'tin', 'oil', 'gas', 'lead', 'barite', 'iron'],
    prospectivity: 'all',     // 'all' | 'high' | 'moderate'
    risk: 'all',              // 'all' | 'high' | 'medium' | 'low'
  },

  // data status (later: populated from API health endpoint)
  dataStatus: { online: true, latencyMs: 42, lastSync: 'now' },
});
