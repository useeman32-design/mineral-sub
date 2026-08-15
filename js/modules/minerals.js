/**
 * MINERALS MODULE
 * ===============
 * Commodity-level intelligence: a filterable register of every tracked
 * commodity on the left, and a detail dossier for the selected one on the
 * right. Reads exclusively through `api`, so swapping fixtures for the
 * Laravel endpoint changes nothing here.
 *
 * Layout mirrors Explore Map: a persistent dock beside a primary work area,
 * so the two data modules feel like the same product.
 */

import { $, $$, fmt, debounce, sparkline, ring } from '../core/utils.js?v=c142985';
import { icon } from '../core/icons.js?v=c142985';
import { api } from '../data/api.js?v=c142985';
import { store } from '../core/store.js?v=c142985';

const VIEW_KEY = 'nmi.mineralsView';
const CATEGORIES = ['All', 'Metallic', 'Industrial', 'Energy'];

const TREND_META = {
  up: { glyph: '▲', cls: 'tr-up', label: 'Rising' },
  flat: { glyph: '▬', cls: 'tr-flat', label: 'Stable' },
  down: { glyph: '▼', cls: 'tr-down', label: 'Declining' },
};

const STATUS_ORDER = ['Producing', 'Appraisal', 'Exploration'];

export function createMinerals() {
  let root;
  let all = [];
  let selectedId = null;
  let category = 'All';
  let query = '';
  let sort = 'occurrences';
  let layout = localStorage.getItem(VIEW_KEY) || 'grid';

  /* ------------------------------------------------------------------ *
   * Derived data
   * ------------------------------------------------------------------ */

  function visible() {
    const q = query.trim().toLowerCase();
    let list = all.filter((c) => {
      if (category !== 'All' && c.category !== category) return false;
      if (!q) return true;
      return c.label.toLowerCase().includes(q)
        || c.category.toLowerCase().includes(q)
        || c.states.some((s) => s.name.toLowerCase().includes(q));
    });

    const by = {
      occurrences: (a, b) => b.occurrences - a.occurrences,
      label: (a, b) => a.label.localeCompare(b.label),
      sites: (a, b) => b.siteCount - a.siteCount,
      states: (a, b) => b.stateCount - a.stateCount,
    }[sort];
    return list.sort(by);
  }

  function totals() {
    const list = visible();
    return {
      commodities: list.length,
      occurrences: list.reduce((a, c) => a + c.occurrences, 0),
      sites: list.reduce((a, c) => a + c.siteCount, 0),
      producing: list.reduce((a, c) => a + c.producing, 0),
    };
  }

  /* ------------------------------------------------------------------ *
   * Templates
   * ------------------------------------------------------------------ */

  const kpi = (label, value, sub, accent) => `
    <div class="mn-kpi">
      <div class="mn-kpi-l">${label}</div>
      <div class="mn-kpi-v" style="color:${accent}">${value}</div>
      <div class="mn-kpi-s">${sub}</div>
    </div>`;

  const trendChip = (t) => {
    const m = TREND_META[t] || TREND_META.flat;
    return `<span class="mn-trend ${m.cls}" title="${m.label}">${m.glyph}</span>`;
  };

  function commodityCard(c) {
    const on = c.id === selectedId;
    return `
      <button class="mn-card ${on ? 'is-on' : ''}" data-commodity="${c.id}"
              aria-pressed="${on}" style="--cm:${c.hex}">
        <span class="mn-card-bar"></span>
        <span class="mn-card-hd">
          <i class="mn-dot"></i>
          <span class="mn-card-n">${c.label}</span>
          ${trendChip(c.trend)}
        </span>
        <span class="mn-card-v">${fmt.int(c.occurrences)}<em>occurrences</em></span>
        <span class="mn-bar" role="img" aria-label="${c.share}% of leading commodity">
          <span class="mn-bar-f" style="width:${c.share}%"></span>
        </span>
        <span class="mn-card-ft">
          <span>${c.siteCount} catalogued</span>
          <span>${c.stateCount} states</span>
        </span>
      </button>`;
  }

  function commodityRow(c) {
    const on = c.id === selectedId;
    return `
      <button class="mn-row ${on ? 'is-on' : ''}" data-commodity="${c.id}"
              aria-pressed="${on}" style="--cm:${c.hex}">
        <i class="mn-dot"></i>
        <span class="mn-row-n">${c.label}</span>
        <span class="mn-row-cat">${c.category}</span>
        <span class="mn-row-bar"><span style="width:${c.share}%"></span></span>
        <span class="mn-row-v t-mono">${fmt.int(c.occurrences)}</span>
        <span class="mn-row-s">${c.siteCount}</span>
        <span class="mn-row-st">${c.stateCount}</span>
        ${trendChip(c.trend)}
      </button>`;
  }

  function emptyDossier() {
    return `
      <div class="mn-empty">
        <div class="mn-empty-g">${icon('minerals', { size: 30, sw: 1.3 })}</div>
        <p class="mn-empty-t">Select a commodity</p>
        <p class="mn-empty-s">Its occurrence register, host geology, grade notes
        and leading states appear here.</p>
      </div>`;
  }

  function dossier(c) {
    const sites = [...c.sites].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        || a.name.localeCompare(b.name),
    );
    const top = c.states.slice(0, 8);
    const maxP = Math.max(1, ...top.map((s) => s.prospectivity));

    return `
      <header class="mn-dh" style="--cm:${c.hex}">
        <div class="mn-dh-t">
          <span class="mn-dh-dot"></span>
          <div>
            <div class="mn-dh-cat">${c.category} · ${c.maturity}</div>
            <h2>${c.label}</h2>
          </div>
        </div>
        <div class="mn-dh-k">
          ${kpi('Occurrences', fmt.int(c.occurrences), `${trendChip(c.trend)} national register`, c.hex)}
          ${kpi('Catalogued sites', c.siteCount, `${c.producing} producing`, 'var(--green)')}
          ${kpi('States', c.stateCount, 'with recorded presence', 'var(--cyan)')}
        </div>
      </header>

      <div class="mn-dgrid">
        <section class="panel mn-p">
          <header class="panel-hd">
            <span class="accent-bar accent-gold"></span><h3>Geological Profile</h3>
          </header>
          <div class="panel-bd mn-prose">
            <div class="mn-field">
              <div class="mn-field-l">Grade &amp; tonnage</div>
              <p>${c.grade}</p>
            </div>
            <div class="mn-field">
              <div class="mn-field-l">Host geology</div>
              <p>${c.hostRock}</p>
            </div>
            <div class="mn-field">
              <div class="mn-field-l">End uses</div>
              <p>${c.uses}</p>
            </div>
          </div>
        </section>

        <section class="panel mn-p">
          <header class="panel-hd">
            <span class="accent-bar accent-cyan"></span><h3>Leading States</h3>
            <span class="spacer"></span><span class="panel-x">${c.stateCount}</span>
          </header>
          <div class="panel-bd">
            ${top.length ? `<div class="mn-states">
              ${top.map((s) => `
                <button class="mn-state" data-state="${s.name}" title="Open ${s.name} on the map">
                  <span class="mn-state-c t-mono">${s.code}</span>
                  <span class="mn-state-n">${s.name}</span>
                  <span class="mn-state-b"><span style="width:${(s.prospectivity / maxP) * 100}%;background:${c.hex}"></span></span>
                  <span class="mn-state-v t-mono">${s.prospectivity}</span>
                </button>`).join('')}
            </div>` : '<p class="mn-none">No state-level records yet.</p>'}
          </div>
        </section>

        <section class="panel mn-p mn-p-wide">
          <header class="panel-hd">
            <span class="accent-bar"></span><h3>Occurrence Register</h3>
            <span class="spacer"></span><span class="panel-x">${sites.length}</span>
          </header>
          <div class="panel-bd">
            ${sites.length ? `<div class="mn-sites">
              <div class="mn-site mn-site-h">
                <span>Site</span><span>State</span><span>Tier</span><span>Status</span><span>Coordinates</span>
              </div>
              ${sites.map((s) => `
                <button class="mn-site" data-site="${s.id}" title="Show ${s.name} on the map">
                  <span class="mn-site-n"><i style="background:${c.hex}"></i>${s.name}</span>
                  <span>${s.state}</span>
                  <span class="mn-tier mn-tier-${s.tier}">${s.tier}</span>
                  <span class="mn-st mn-st-${s.status.toLowerCase()}">${s.status}</span>
                  <span class="t-mono mn-site-c">${fmt.coord(s.lat, s.lng)}</span>
                </button>`).join('')}
            </div>` : `<p class="mn-none">
              No individual sites catalogued for ${c.label} yet. Occurrence points
              arrive with the national registry import.</p>`}
          </div>
        </section>
      </div>`;
  }

  function shell() {
    const t = totals();
    return `
      <div class="mn-wrap">
        <header class="mn-head">
          <div class="mn-head-t">
            <h1>Minerals</h1>
            <p>Commodity register across ${all.length} tracked minerals — occurrence
            counts, host geology and state-level distribution.</p>
          </div>
          <div class="mn-head-k">
            ${kpi('Commodities', t.commodities, 'in current view', 'var(--green)')}
            ${kpi('Occurrences', fmt.int(t.occurrences), 'national register', 'var(--gold)')}
            ${kpi('Producing sites', t.producing, `of ${t.sites} catalogued`, 'var(--cyan)')}
          </div>
        </header>

        <div class="mn-body">
          <aside class="mn-dock" id="mn-dock">
            <div class="mn-tools">
              <div class="mn-search">
                ${icon('search', { size: 13 })}
                <input id="mn-q" type="search" placeholder="Filter commodities or states"
                       autocomplete="off" value="${query.replace(/"/g, '&quot;')}" />
              </div>
              <div class="mn-cats" role="tablist">
                ${CATEGORIES.map((c) => `
                  <button role="tab" class="mn-cat ${c === category ? 'is-on' : ''}"
                          data-cat="${c}" aria-selected="${c === category}">${c}</button>`).join('')}
              </div>
              <div class="mn-sortrow">
                <label class="mn-sort">
                  <span>Sort</span>
                  <select id="mn-sort">
                    <option value="occurrences"${sort === 'occurrences' ? ' selected' : ''}>Occurrences</option>
                    <option value="sites"${sort === 'sites' ? ' selected' : ''}>Catalogued sites</option>
                    <option value="states"${sort === 'states' ? ' selected' : ''}>State spread</option>
                    <option value="label"${sort === 'label' ? ' selected' : ''}>Name</option>
                  </select>
                </label>
                <div class="mn-layout" role="group" aria-label="Layout">
                  <button data-layout="grid" class="${layout === 'grid' ? 'is-on' : ''}"
                          title="Card view" aria-pressed="${layout === 'grid'}">${icon('grid', { size: 13 })}</button>
                  <button data-layout="list" class="${layout === 'list' ? 'is-on' : ''}"
                          title="Table view" aria-pressed="${layout === 'list'}">${icon('layers', { size: 13 })}</button>
                </div>
              </div>
            </div>
            <div class="mn-list ${layout === 'list' ? 'is-list' : 'is-grid'}" id="mn-list"></div>
          </aside>

          <section class="mn-detail" id="mn-detail"></section>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function renderList() {
    const host = $('#mn-list', root);
    if (!host) return;
    const list = visible();

    host.className = `mn-list ${layout === 'list' ? 'is-list' : 'is-grid'}`;
    if (!list.length) {
      host.innerHTML = `<p class="mn-none mn-none-pad">No commodity matches
        “${query}”${category !== 'All' ? ` in ${category}` : ''}.</p>`;
      return;
    }

    if (layout === 'list') {
      host.innerHTML = `
        <div class="mn-row mn-row-h">
          <i></i><span>Commodity</span><span>Class</span><span>Share</span>
          <span class="mn-row-v">Occ.</span><span>Sites</span><span>States</span><span></span>
        </div>
        ${list.map(commodityRow).join('')}`;
    } else {
      host.innerHTML = list.map(commodityCard).join('');
    }
  }

  function renderDetail() {
    const host = $('#mn-detail', root);
    if (!host) return;
    const c = all.find((x) => x.id === selectedId);
    host.innerHTML = c ? dossier(c) : emptyDossier();
    host.scrollTop = 0;
  }

  function renderTotals() {
    const t = totals();
    const vals = $$('.mn-head-k .mn-kpi-v', root);
    const subs = $$('.mn-head-k .mn-kpi-s', root);
    if (vals[0]) vals[0].textContent = t.commodities;
    if (vals[1]) vals[1].textContent = fmt.int(t.occurrences);
    if (vals[2]) vals[2].textContent = t.producing;
    if (subs[2]) subs[2].textContent = `of ${t.sites} catalogued`;
  }

  function select(id) {
    selectedId = id;
    renderList();
    renderDetail();
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function wire() {
    // Commodity selection (cards and rows share the data attribute)
    root.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-commodity]');
      if (pick) { select(pick.dataset.commodity); return; }

      const cat = e.target.closest('[data-cat]');
      if (cat) {
        category = cat.dataset.cat;
        $$('.mn-cat', root).forEach((b) => {
          const on = b.dataset.cat === category;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', on);
        });
        renderList();
        renderTotals();
        return;
      }

      const lay = e.target.closest('[data-layout]');
      if (lay) {
        layout = lay.dataset.layout;
        localStorage.setItem(VIEW_KEY, layout);
        $$('[data-layout]', root).forEach((b) => {
          const on = b.dataset.layout === layout;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on);
        });
        renderList();
        return;
      }

      // Cross-module navigation: open the state or site on the Explore map
      const st = e.target.closest('[data-state]');
      if (st) { openOnMap({ state: st.dataset.state }); return; }

      const site = e.target.closest('[data-site]');
      if (site) {
        const c = all.find((x) => x.id === selectedId);
        const rec = c?.sites.find((s) => s.id === site.dataset.site);
        if (rec) openOnMap({ state: rec.state, site: rec });
      }
    });

    const q = $('#mn-q', root);
    q?.addEventListener('input', debounce(() => {
      query = q.value;
      renderList();
      renderTotals();
    }, 160));

    $('#mn-sort', root)?.addEventListener('change', (e) => {
      sort = e.target.value;
      renderList();
    });
  }

  /**
   * Hand a selection to the Explore module. The map owns drill-down, so this
   * publishes intent to the store and routes — Explore picks it up on show.
   */
  function openOnMap({ state, site }) {
    store.set({ pendingFocus: { state, site: site || null, from: 'minerals' } });
    location.hash = '#/explore';
  }

  /* ------------------------------------------------------------------ *
   * Module contract
   * ------------------------------------------------------------------ */

  return {
    async mount(view) {
      root = view;
      view.innerHTML = `<div class="mn-loading">${icon('refresh', { size: 18 })}<span>Loading commodity register…</span></div>`;

      all = await api.getCommodities();
      if (!selectedId && all.length) selectedId = all[0].id;

      view.innerHTML = shell();
      wire();
      renderList();
      renderDetail();
    },

    onShow() {
      // Nothing to recompute: the register is static between API refreshes.
    },
  };
}
