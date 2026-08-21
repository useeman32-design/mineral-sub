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

import { $, $$, fmt, debounce, sparkline, ring } from '../core/utils.js?v=4f964c1';
import { icon } from '../core/icons.js?v=4f964c1';
import { api } from '../data/api.js?v=4f964c1';
import { ctx } from '../core/context.js?v=4f964c1';
import { reports } from '../core/reports.js?v=4f964c1';
import { toast } from './dashboard.js?v=4f964c1';
import { RESOURCE_META as RMETA } from '../data/fixtures.js?v=4f964c1';

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
  let stateDetail = null;   // resolved commodity-in-state payload
  let loadingState = null;

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
              aria-pressed="${on}" aria-expanded="${on}" style="--cm:${c.hex}">
        <span class="mn-shot">
          <img src="${c.image}" alt="${c.label} specimen" loading="lazy" decoding="async" />
          <span class="mn-shot-v"></span>
          <span class="mn-cat-tag">${c.category}</span>
          ${trendChip(c.trend)}
        </span>
        <span class="mn-card-b">
          <span class="mn-card-hd">
            <i class="mn-dot"></i>
            <span class="mn-card-n">${c.label}</span>
          </span>
          <span class="mn-card-v">${fmt.int(c.occurrences)}<em>occurrences</em></span>
          <span class="mn-bar" role="img" aria-label="${c.share}% of leading commodity">
            <span class="mn-bar-f" style="width:${c.share}%"></span>
          </span>
        </span>
      </button>`;
  }

  /**
   * Plain-language summary of how this commodity presents in this state.
   * Assembled from the same records the panels below show, so it can never
   * contradict them.
   */
  function stateSummary(d) {
    const c = d.commodity;
    const n = d.sites.length;
    const producing = d.sites.filter((s) => s.status === 'Producing').length;
    const lgaNames = d.byLga.map((l) => l.name);
    const rank = c.states.findIndex((s) => s.name === d.state.name) + 1;

    const where = lgaNames.length === 0
      ? `No occurrence has been resolved to an LGA yet`
      : lgaNames.length === 1
        ? `All recorded occurrences sit in ${lgaNames[0]} LGA`
        : `Occurrences are spread across ${lgaNames.length} LGAs — ${lgaNames.slice(0, 3).join(', ')}${lgaNames.length > 3 ? ` and ${lgaNames.length - 3} more` : ''}`;

    const activity = producing
      ? `${producing} of ${n} ${n === 1 ? 'site is' : 'sites are'} in production`
      : n
        ? `None of the ${n} catalogued ${n === 1 ? 'site is' : 'sites are'} in production yet`
        : 'No site is catalogued here yet';

    const open = d.unoperated.filter((u) => u.hasOccurrence).length;

    return `${c.label} is ${rank > 0 ? `the ${ordinal(rank)} strongest ${c.label.toLowerCase()} state by prospectivity` : 'recorded'} in ${d.state.name}. `
      + `${where}. ${activity}. `
      + (open ? `${open} ${open === 1 ? 'LGA has' : 'LGAs have'} a recorded occurrence but no titled operator. ` : '')
      + `${c.hostRock}`;
  }

  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  /** Commodity-within-a-state: LGA spread, operators, open ground, evidence. */
  function stateDrill(d) {
    const c = d.commodity;
    const ev = d.evidence;
    const bar = (v, col) => `<span class="mn-ev-t"><span style="width:${v}%;background:${col}"></span></span>`;

    return `
      <section class="panel mn-p mn-p-wide mn-drill" style="--cm:${c.hex}">
        <header class="panel-hd">
          <span class="accent-bar accent-cyan"></span>
          <h3>${c.label} in ${d.state.name}</h3>
          <span class="spacer"></span>
          <span class="panel-x">${d.sites.length} occurrence${d.sites.length === 1 ? '' : 's'} · ${d.lgas.length} LGAs</span>
          <button class="mn-close" data-drill-close title="Close">${icon('plus', { size: 14 })}</button>
        </header>
        <div class="panel-bd">
          <p class="mn-desc">${stateSummary(d)}</p>
          <div class="ctx-acts">
            <button class="btn-ghost btn-primary" data-go="explore">${icon('map', { size: 13 })} View on map</button>
            <button class="btn-ghost" data-go="prospectivity">${icon('prospectivity', { size: 13 })} Prospectivity</button>
            <button class="btn-ghost" data-go="risk">${icon('risk', { size: 13 })} Risk</button>
            <button class="btn-ghost" data-report-item>${icon('reports', { size: 13 })} Generate report</button>
          </div>

          <div class="mn-dgrid2">
            <div class="mn-blk">
              <div class="mn-blk-h">Geographical distribution</div>
              ${d.byLga.length ? `<div class="mn-lgas">
                ${d.byLga.map((l) => `
                  <button class="mn-lga" data-lga="${l.name}">
                    <span class="mn-lga-n">${l.name}</span>
                    <span class="mn-lga-c t-mono">${l.sites.length}</span>
                    <span class="mn-lga-s">${l.sites.map((x) => x.name).join(', ')}</span>
                  </button>`).join('')}
              </div>` : `<p class="mn-none">No occurrence resolves to an LGA in ${d.state.name} yet.</p>`}
              <p class="mn-note">${d.state.name} has ${d.lgas.length} local government areas;
              ${d.byLga.length} record ${c.label.toLowerCase()}.</p>
            </div>

            <div class="mn-blk">
              <div class="mn-blk-h">Operators on record <em>${d.operators.length}</em></div>
              ${d.operators.length ? `<div class="mn-ops">
                ${d.operators.map((o) => `
                  <div class="mn-op">
                    <span class="mn-op-n">${o.name}</span>
                    <span class="mn-op-m">${o.site}${o.lga ? ` · ${o.lga}` : ''}</span>
                    <span class="mn-op-r">
                      <span class="mn-st mn-st-${o.status.toLowerCase().replace(/[^a-z]/g, '')}">${o.status}</span>
                      <span class="t-mono mn-op-l">${o.licence}</span>
                    </span>
                  </div>`).join('')}
              </div>` : '<p class="mn-none">No titled operator on record.</p>'}
            </div>

            <div class="mn-blk">
              <div class="mn-blk-h">Open ground <em>${d.unoperated.length}</em></div>
              <div class="mn-open">
                ${d.unoperated.slice(0, 10).map((u) => `
                  <button class="mn-open-r ${u.hasOccurrence ? 'has-occ' : ''}" data-lga="${u.name}">
                    <span class="mn-open-n">${u.name}</span>
                    <span class="mn-open-s">${u.note}</span>
                  </button>`).join('')}
              </div>
              ${d.unoperated.length > 10 ? `<p class="mn-note">+ ${d.unoperated.length - 10} more LGAs with no titled operator.</p>` : ''}
            </div>

            <div class="mn-blk">
              <div class="mn-blk-h">Geochemical evidence</div>
              ${ev.geochemical.map((g) => `
                <div class="mn-ev">
                  <div class="mn-ev-h"><span>${g.label}</span><b class="t-mono">${g.anomalies} anomalies</b></div>
                  ${bar(g.strength, 'var(--gold)')}
                  <div class="mn-ev-f">${g.coverage}% coverage · signal ${g.strength}/100</div>
                </div>`).join('')}
            </div>

            <div class="mn-blk">
              <div class="mn-blk-h">Geophysical evidence</div>
              ${ev.geophysical.map((g) => `
                <div class="mn-ev">
                  <div class="mn-ev-h"><span>${g.label}</span><b class="t-mono">${g.anomalies} targets</b></div>
                  ${bar(g.strength, 'var(--purple)')}
                  <div class="mn-ev-f">${g.coverage}% coverage · signal ${g.strength}/100</div>
                </div>`).join('')}
            </div>

            <div class="mn-blk">
              <div class="mn-blk-h">Geological mapping</div>
              <div class="mn-ev">
                ${bar(ev.geological.mapped, 'var(--cyan)')}
                <div class="mn-ev-f">${ev.geological.summary}</div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function emptyDossier() {
    return `
      <div class="mn-empty">
        <div class="mn-empty-g">${icon('minerals', { size: 30, sw: 1.3 })}</div>
        <p class="mn-empty-t">Select a specimen above</p>
        <p class="mn-empty-s">Its occurrence register, host geology, grade notes
        and leading states open here.</p>
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
          <span class="mn-dh-shot"><img src="${c.image}" alt="${c.label} specimen" decoding="async" /></span>
          <div>
            <div class="mn-dh-cat">${c.category} · ${c.maturity}</div>
            <h2>${c.label}</h2>
          </div>
        </div>
        <div class="mn-dh-k">
          ${kpi('Occurrences', fmt.int(c.occurrences), `${trendChip(c.trend)} national register`, c.hex)}
          ${kpi('Catalogued sites', c.siteCount, `${c.producing} producing`, 'var(--green)')}
          ${kpi('States', c.stateCount, 'with recorded presence', 'var(--cyan)')}
          <button class="btn-ghost mn-dh-report" data-report-item>${icon('reports', { size: 13 })} Generate report</button>
          <button class="mn-close" data-close title="Close profile">${icon('plus', { size: 15 })}</button>
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
                <button class="mn-state ${stateDetail?.state?.name === s.name ? 'is-on' : ''}"
                        data-state="${s.name}" title="Drill into ${s.name}">
                  <span class="mn-state-c t-mono">${s.code}</span>
                  <span class="mn-state-n">${s.name}</span>
                  <span class="mn-state-b"><span style="width:${(s.prospectivity / maxP) * 100}%;background:${c.hex}"></span></span>
                  <span class="mn-state-v t-mono">${s.prospectivity}</span>
                </button>`).join('')}
            </div>` : '<p class="mn-none">No state-level records yet.</p>'}
          </div>
        </section>

        ${stateDetail && stateDetail.commodity.id === c.id ? stateDrill(stateDetail) : ''}

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
            <p>Commodity register across ${all.length} tracked minerals — select a
            specimen to open its full profile.</p>
          </div>
          <div class="mn-head-k">
            ${kpi('Commodities', t.commodities, 'in current view', 'var(--green)')}
            ${kpi('Occurrences', fmt.int(t.occurrences), 'national register', 'var(--gold)')}
            ${kpi('Producing sites', t.producing, `of ${t.sites} catalogued`, 'var(--cyan)')}
          </div>
        </header>

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
          <label class="mn-sort">
            <span>Sort</span>
            <select id="mn-sort">
              <option value="occurrences"${sort === 'occurrences' ? ' selected' : ''}>Occurrences</option>
              <option value="sites"${sort === 'sites' ? ' selected' : ''}>Catalogued sites</option>
              <option value="states"${sort === 'states' ? ' selected' : ''}>State spread</option>
              <option value="label"${sort === 'label' ? ' selected' : ''}>Name</option>
            </select>
          </label>
        </div>

        <div class="mn-gallery" id="mn-list"></div>
        <section class="mn-detail" id="mn-detail"></section>
      </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function renderList() {
    const host = $('#mn-list', root);
    if (!host) return;
    const list = visible();

    if (!list.length) {
      host.innerHTML = `<p class="mn-none mn-none-pad">No commodity matches
        \u201c${query}\u201d${category !== 'All' ? ` in ${category}` : ''}.</p>`;
      return;
    }
    host.innerHTML = list.map(commodityCard).join('');
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

  /** Load and show the commodity-in-state breakdown. */
  async function drillState(name) {
    if (loadingState === name) return;
    loadingState = name;
    ctx.set({ commodity: selectedId, state: name, lga: null });
    try {
      stateDetail = await api.getCommodityInState(selectedId, name);
    } catch (err) {
      console.error('[minerals] state drill failed', err);
      stateDetail = null;
    }
    loadingState = null;
    renderDetail();
    requestAnimationFrame(() => {
      $('.mn-drill', root)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function select(id) {
    // Clicking the open commodity again collapses the detail panel.
    selectedId = selectedId === id ? null : id;
    stateDetail = null;
    ctx.set({ commodity: selectedId });
    renderList();
    renderDetail();

    if (!selectedId) return;
    const card = $(`[data-commodity="${selectedId}"]`, root);
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Let the panel paint before scrolling to it.
    requestAnimationFrame(() => {
      $('#mn-detail', root)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function wire() {
    // Commodity selection (cards and rows share the data attribute)
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        selectedId = null;
        renderList();
        renderDetail();
        return;
      }

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

      if (e.target.closest('[data-drill-close]')) {
        stateDetail = null;
        ctx.set({ state: null, lga: null });
        renderDetail();
        return;
      }

      // Drill into a state rather than leaving the page.
      const st = e.target.closest('[data-state]');
      if (st) { drillState(st.dataset.state); return; }

      // An LGA row focuses that LGA in the shared context.
      const lga = e.target.closest('[data-lga]');
      if (lga) {
        const name = lga.dataset.lga;
        const already = lga.classList.contains('is-on');
        ctx.set({
          commodity: selectedId,
          state: stateDetail?.state?.name || ctx.get().state,
          lga: name,
          occurrence: null,
          layer: 'lgas',
        });
        $$('[data-lga]', root).forEach((n) => n.classList.toggle('is-on', n === lga));
        // Second click on an already-selected LGA opens it on the map.
        if (already) ctx.go('explore');
        return;
      }

      // Report the selected commodity, scoped to a state when one is chosen.
      if (e.target.closest('[data-report-item]')) {
        // Report what is actually on screen: the commodity, plus the state
        // profile only when the user has drilled into one.
        const st = stateDetail?.state?.name;
        const added = reports.addMany([
          { kind: 'commodity', id: selectedId, title: `Commodity register — ${selectedId}` },
          ...(st ? [{ kind: 'state', id: st, title: `State profile — ${st}` }] : []),
        ]);
        toast(added
          ? `Added ${selectedId}${st ? ` and ${st}` : ''} to the report`
          : 'Already in the report');
        return;
      }

      // Context handoff buttons.
      const go = e.target.closest('[data-go]')?.dataset.go;
      if (go) {
        ctx.set({
          commodity: selectedId,
          state: stateDetail?.state?.name || ctx.get().state,
          occurrence: null,   // state-level intent, not a single point
          layer: go === 'explore' ? 'deposits' : null,
        });
        ctx.go(go);
        return;
      }

      // An occurrence row jumps to that point on the map.
      const site = e.target.closest('[data-site], [data-fly]');
      if (site) {
        const id = site.dataset.site || site.dataset.fly;
        const c = all.find((x) => x.id === selectedId);
        const rec = c?.sites.find((x) => x.id === id);
        if (rec) {
          ctx.set({
            commodity: selectedId, state: rec.state,
            lga: stateDetail?.sites.find((x) => x.id === id)?.lga || null,
            occurrence: rec.id, layer: 'deposits',
          });
          ctx.go('explore');
        }
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

  /* ------------------------------------------------------------------ *
   * Module contract
   * ------------------------------------------------------------------ */

  return {
    async mount(view) {
      root = view;
      view.innerHTML = `<div class="mn-loading">${icon('refresh', { size: 18 })}<span>Loading commodity register…</span></div>`;

      all = await api.getCommodities();

      view.innerHTML = shell();
      wire();
      renderList();
      renderDetail();
    },

    async onShow() {
      const c = ctx.get();
      if (c.commodity && c.commodity !== selectedId) {
        selectedId = c.commodity;
        stateDetail = null;
        renderList();
        renderDetail();
      }
      if (c.state && selectedId && stateDetail?.state?.name !== c.state) {
        await drillState(c.state);
      }
    },
  };
}
