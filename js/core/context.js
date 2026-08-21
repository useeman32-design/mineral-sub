/**
 * CROSS-MODULE CONTEXT
 * ====================
 * One selection — commodity, state, LGA, occurrence, mining title, petroleum
 * block — shared by Minerals, Prospectivity, Risk Intelligence, Mining Titles,
 * Oil & Gas and the Map Explorer. Modules read it on
 * show and write it when the user drills, so moving between pages never asks
 * the user to re-pick what they already chose.
 *
 *   ctx.set({ commodity: 'gold', state: 'Zamfara', lga: 'Anka' });
 *   ctx.go('prospectivity');        // navigate carrying the current context
 *   ctx.go('explore', { layer: 'risk' });
 *
 * Deliberately thin: it holds identifiers only, never rendered data. Each
 * module resolves those identifiers against the API itself, so a context can
 * be restored from a URL or a saved session later without change.
 */

import { store } from './store.js?v=db4eb0f';

/** Routes that understand a context handoff. */
export const CONTEXT_ROUTES = ['minerals', 'prospectivity', 'risk', 'explore', 'titles', 'oilgas'];

const EMPTY = {
  commodity: null,   // RESOURCE_META key, e.g. 'gold'
  state: null,       // state name, e.g. 'Zamfara'
  lga: null,         // LGA name, e.g. 'Anka'
  occurrence: null,  // deposit id, e.g. 'NMI-0001'
  title: null,       // mining title id, e.g. 'ZA/EL/3251'
  block: null,       // petroleum block id, e.g. 'OML-128'
  from: null,        // route that initiated the last handoff
  layer: null,       // map layer the receiving map should enable
  stamp: 0,          // bumped on every set, so onShow can detect a new request
};

let current = { ...EMPTY };
const subs = new Set();

function emit() {
  subs.forEach((fn) => {
    try { fn(current); } catch (err) { console.error('[context]', err); }
  });
}

export const ctx = {
  /** Current context (frozen copy — mutate via set/clear). */
  get() { return { ...current }; },

  /** Shallow-merge a patch. Pass null for a field to clear just that field. */
  set(patch = {}) {
    current = { ...current, ...patch, stamp: Date.now() };
    // Keep the geographic drill state in sync so the map and status bar agree.
    if ('state' in patch || 'lga' in patch) {
      const d = store.get('drill') || {};
      store.set({
        drill: {
          ...d,
          state: current.state,
          lga: current.lga,
          level: current.lga ? 'lga' : current.state ? 'state' : 'nation',
        },
      });
    }
    emit();
    return this;
  },

  clear() {
    current = { ...EMPTY, stamp: Date.now() };
    emit();
    return this;
  },

  /** True when the context names a place. */
  hasPlace() {
    return !!(current.state || current.lga || current.occurrence
      || current.title || current.block);
  },

  /** Human-readable trail, e.g. "Gold · Zamfara · Anka". */
  label(meta = {}) {
    const parts = [];
    if (current.commodity) parts.push(meta[current.commodity]?.label || current.commodity);
    if (current.state) parts.push(current.state);
    if (current.lga) parts.push(current.lga);
    return parts.join(' · ');
  },

  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

  /**
   * Navigate to another module carrying the context.
   * The receiving module reads ctx in onShow(); explore also honours `layer`.
   */
  go(route, patch = {}) {
    if (Object.keys(patch).length) this.set(patch);
    current.from = store.get('route') || null;
    location.hash = `#/${route}`;
  },
};
