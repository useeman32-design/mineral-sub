/**
 * PER-DATASET TOGGLES
 * ===================
 * The GO LIVE switch flips the whole app between sample and live sources.
 * This adds a second, finer control: each individual live dataset can be
 * switched off on its own, so a dataset can be excluded from the map and from
 * reports without leaving live mode.
 *
 * Default is ON — a dataset that is connected is used unless explicitly
 * disabled. State persists in localStorage under `nmi.dsOff` as a list of
 * disabled ids, so the stored value stays small and defaults stay implicit.
 */

const KEY = 'nmi.dsOff';

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch { return new Set(); }
}

function write(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* private mode */ }
}

const subs = new Set();
let off = read();

export const dsToggles = {
  /** True when the dataset should be used. Unknown ids default to enabled. */
  isOn(id) { return !off.has(id); },

  /** Ids currently switched off. */
  get disabled() { return [...off]; },

  set(id, on) {
    if (on) off.delete(id); else off.add(id);
    write(off);
    subs.forEach((fn) => fn(id, on));
  },

  toggle(id) { const next = !this.isOn(id); this.set(id, next); return next; },

  /** Re-enable everything. */
  reset() {
    off = new Set();
    write(off);
    subs.forEach((fn) => fn(null, true));
  },

  /** fn(id, on) — id is null when everything was reset. */
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

/**
 * Map layer ids that are backed by a live dataset. Turning the dataset off
 * hides its layer and disables the row in the layer tree.
 */
export const DATASET_LAYER = {
  titlegeom: 'titles',
  footprints: 'footprints',
  sites: 'sites',
  protected: 'protected',
};
