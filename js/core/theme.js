/**
 * Theme controller — dark (default) / light / system.
 * Applies `data-theme` on <html> so every token in tokens.css remaps.
 * Persisted to localStorage; emits `nmi:theme` so the map can restyle.
 */

const KEY = 'nmi.theme';
const media = matchMedia('(prefers-color-scheme: light)');

export const theme = {
  /** 'dark' | 'light' | 'system' */
  get preference() {
    return localStorage.getItem(KEY) || 'dark';
  },

  /** resolved value actually applied: 'dark' | 'light' */
  get resolved() {
    const p = this.preference;
    return p === 'system' ? (media.matches ? 'light' : 'dark') : p;
  },

  set(pref) {
    localStorage.setItem(KEY, pref);
    this.apply();
  },

  apply() {
    const r = this.resolved;
    document.documentElement.setAttribute('data-theme', r);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', r === 'light' ? '#eef2f3' : '#040708');
    dispatchEvent(new CustomEvent('nmi:theme', { detail: { theme: r, preference: this.preference } }));
  },

  /** Convenience for the topbar toggle: flips between explicit light/dark. */
  toggle() {
    this.set(this.resolved === 'dark' ? 'light' : 'dark');
    return this.resolved;
  },

  init() {
    this.apply();
    media.addEventListener('change', () => {
      if (this.preference === 'system') this.apply();
    });
  },
};
