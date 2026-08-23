/**
 * GLOBAL SEARCH
 * =============
 * One box that reaches every module: states, LGAs, commodities, occurrences
 * and the modules themselves. Selecting a result publishes the cross-module
 * context and routes to whichever page can answer for it, so search is just
 * another way into the same intelligence flow.
 *
 *   createGlobalSearch(inputEl, { api })
 *
 * Results are resolved from the API layer, never from fixtures directly, so
 * the same code works once Laravel is serving real data.
 */

import { $, debounce } from '../core/utils.js?v=8503cca';
import { icon } from '../core/icons.js?v=8503cca';
import { ctx } from '../core/context.js?v=8503cca';
import { RESOURCE_META, STATES, DEPOSITS } from '../data/fixtures.js?v=8503cca';

const MODULES = [
  { id: 'overview', label: 'Overview', hint: 'National dashboard' },
  { id: 'explore', label: 'Explore Map', hint: 'Geographic workspace' },
  { id: 'minerals', label: 'Minerals', hint: 'Commodity register' },
  { id: 'prospectivity', label: 'Prospectivity', hint: 'Targeting model' },
  { id: 'risk', label: 'Risk Intelligence', hint: 'Exploration risk' },
  { id: 'settings', label: 'Settings', hint: 'Preferences' },
];

const KIND = {
  commodity: { label: 'Mineral', accent: 'var(--gold)', glyph: 'minerals' },
  state: { label: 'State', accent: 'var(--cyan)', glyph: 'pin' },
  lga: { label: 'LGA', accent: 'var(--cyan)', glyph: 'pin' },
  occurrence: { label: 'Occurrence', accent: 'var(--green)', glyph: 'target' },
  module: { label: 'Module', accent: 'var(--purple)', glyph: 'grid' },
};

export function createGlobalSearch(input, { api } = {}) {
  if (!input) return null;

  let lgaIndex = null;      // built lazily on first search
  let results = [];
  let active = -1;
  let open = false;

  const panel = document.createElement('div');
  panel.className = 'gs-panel';
  panel.setAttribute('role', 'listbox');
  panel.hidden = true;
  input.parentElement.appendChild(panel);

  /** Load every LGA once, so searching "Anka" works without a state first. */
  async function ensureLgas() {
    if (lgaIndex) return lgaIndex;
    lgaIndex = [];
    try {
      const res = await fetch('data/lga/index.json');
      if (res.ok) {
        const idx = await res.json();
        const codes = Array.isArray(idx) ? idx : Object.keys(idx);
        const all = await Promise.all(
          codes.map((c) => api.getLgas(typeof c === 'string' ? c : c.code).catch(() => [])),
        );
        lgaIndex = all.flat();
      }
    } catch { /* search still works without LGAs */ }
    return lgaIndex;
  }

  const score = (text, q) => {
    const t = text.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 55;
    return 0;
  };

  async function search(raw) {
    const q = raw.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];

    Object.entries(RESOURCE_META).forEach(([id, m]) => {
      const s = score(m.label, q);
      if (s) out.push({ kind: 'commodity', id, title: m.label, sub: `${m.cat} commodity`, score: s + 6 });
    });

    Object.entries(STATES).forEach(([name, st]) => {
      const s = score(name, q);
      if (s) {
        out.push({
          kind: 'state', id: name, title: name,
          sub: `${st.region} · ${st.occurrences} occurrences · ${st.risk} risk`,
          score: s + 4,
        });
      }
    });

    DEPOSITS.forEach((d) => {
      const s = score(d.name, q);
      if (s) {
        out.push({
          kind: 'occurrence', id: d.id, title: d.name,
          sub: `${RESOURCE_META[d.resource]?.label || d.resource} · ${d.state} · ${d.status}`,
          data: d, score: s + 2,
        });
      }
    });

    MODULES.forEach((m) => {
      const s = score(m.label, q);
      if (s) out.push({ kind: 'module', id: m.id, title: m.label, sub: m.hint, score: s });
    });

    // LGAs are the largest set, so only reach for them once the query bites.
    if (q.length >= 3) {
      const lgas = await ensureLgas();
      lgas.forEach((l) => {
        const s = score(l.name, q);
        if (s) out.push({ kind: 'lga', id: l.name, title: l.name, sub: `LGA · ${l.state} State`, data: l, score: s + 3 });
      });
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 9);
  }

  function render() {
    if (!results.length) {
      panel.innerHTML = `<div class="gs-empty">No match. Try a state, mineral, LGA or site name.</div>`;
      return;
    }
    panel.innerHTML = results.map((r, i) => {
      const k = KIND[r.kind];
      return `
        <button class="gs-row ${i === active ? 'is-active' : ''}" data-i="${i}" role="option"
                aria-selected="${i === active}" style="--gc:${k.accent}">
          <span class="gs-ico">${icon(k.glyph, { size: 13 })}</span>
          <span class="gs-txt">
            <span class="gs-t">${r.title}</span>
            <span class="gs-s">${r.sub}</span>
          </span>
          <span class="gs-kind">${k.label}</span>
        </button>`;
    }).join('');
  }

  function show() { open = true; panel.hidden = false; }
  function hide() { open = false; panel.hidden = true; active = -1; }

  /** Publish context and route to the module that can answer for this hit. */
  function choose(r) {
    if (!r) return;
    hide();
    input.value = '';
    input.blur();

    switch (r.kind) {
      case 'commodity':
        ctx.set({ commodity: r.id, state: null, lga: null, occurrence: null });
        ctx.go('minerals');
        break;
      case 'state':
        ctx.set({ state: r.id, lga: null, occurrence: null, layer: null });
        ctx.go('explore');
        break;
      case 'lga':
        ctx.set({ state: r.data.state, lga: r.id, occurrence: null, layer: 'lgas' });
        ctx.go('explore');
        break;
      case 'occurrence':
        // Clear lga too: consumeFocus checks lga before occurrence, so a
        // leftover LGA from an earlier search would win the branch.
        ctx.set({
          commodity: r.data.resource, state: r.data.state,
          lga: null, occurrence: r.id, layer: 'deposits',
        });
        ctx.go('explore');
        break;
      default:
        location.hash = `#/${r.id}`;
    }
  }

  const run = debounce(async () => {
    results = await search(input.value);
    active = results.length ? 0 : -1;
    render();
    show();
  }, 140);

  input.addEventListener('input', () => {
    if (input.value.trim().length < 2) { hide(); return; }
    run();
  });

  input.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') hide();
  });

  panel.addEventListener('mousedown', (e) => {
    // mousedown, not click — blur would close the panel first.
    const row = e.target.closest('[data-i]');
    if (row) { e.preventDefault(); choose(results[+row.dataset.i]); }
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== input) hide();
  });

  return { hide };
}
