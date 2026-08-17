/**
 * REGISTER VIEW
 * =============
 * A filterable, sortable asset table with KPI headline and a detail drawer —
 * the shape both Oil & Gas and Mining Titles need. Factored out so the two
 * modules stay thin and behave identically.
 *
 *   createRegister(view, {
 *     title, blurb, accent,
 *     load:      async () => rows,
 *     kpis:      (rows) => [{ label, value, sub, accent }],
 *     filters:   [{ id, label, options:[{v,l}], match(row, v) }],
 *     columns:   [{ id, label, get(row), align, mono }],
 *     search:    (row, q) => bool,
 *     detail:    (row) => html,
 *     reportFor: (row) => section | null,   // adds a "Report" action
 *   });
 */

import { $, $$, fmt, debounce } from '../core/utils.js?v=a2f4c1d';
import { icon } from '../core/icons.js?v=a2f4c1d';
import { ctx } from '../core/context.js?v=a2f4c1d';

export function createRegister(view, cfg) {
  let rows = [];
  let selected = null;
  let query = '';
  let sortId = cfg.defaultSort || cfg.columns[0].id;
  let sortDir = cfg.defaultDir || 'asc';
  // The real cadastre is 10,125 rows; rendering them all produced ~102,000 DOM
  // nodes and a 12s freeze on a throttled CPU. Paginate instead.
  const PAGE = 200;
  let page = 0;
  const active = {};
  cfg.filters.forEach((f) => { active[f.id] = f.options[0].v; });

  const kpi = (k) => `
    <div class="pr-kpi">
      <div class="pr-kpi-l">${k.label}</div>
      <div class="pr-kpi-v" style="color:${k.accent || 'var(--green)'}">${k.value}</div>
      <div class="pr-kpi-s">${k.sub || ''}</div>
    </div>`;

  function visible() {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      for (const f of cfg.filters) {
        const v = active[f.id];
        if (v !== '*' && !f.match(r, v)) return false;
      }
      return !q || cfg.search(r, q);
    });

    const col = cfg.columns.find((c) => c.id === sortId);
    if (col) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = list.slice().sort((a, b) => {
        const x = col.sort ? col.sort(a) : col.get(a);
        const y = col.sort ? col.sort(b) : col.get(b);
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x).localeCompare(String(y)) * dir;
      });
    }
    return list;
  }

  function shell() {
    return `
      <div class="pr-wrap rg-wrap">
        <header class="pr-head">
          <div class="pr-head-t">
            <h1>${cfg.title}</h1>
            <p>${cfg.blurb}</p>
          </div>
          <div class="pr-head-k" id="rg-kpis"></div>
        </header>

        <div class="ctx-bar" id="rg-ctx" hidden></div>

        <div class="rg-tools">
          <div class="mn-search rg-search">
            ${icon('search', { size: 13 })}
            <input id="rg-q" type="search" placeholder="${cfg.searchHint || 'Search the register'}" autocomplete="off" />
          </div>
          ${cfg.filters.map((f) => `
            <label class="pr-sel rg-sel">
              <span>${f.label}</span>
              <select data-filter="${f.id}">
                ${f.options.map((o) => `<option value="${o.v}">${o.l}</option>`).join('')}
              </select>
            </label>`).join('')}
          <span class="spacer"></span>
          <button class="btn-ghost rg-report" data-report-all>
            ${icon('reports', { size: 13 })} Add to report
          </button>
        </div>

        <div class="rg-body">
          <div class="panel rg-panel">
            <header class="panel-hd">
              <span class="accent-bar ${cfg.accent || ''}"></span><h3>${cfg.tableTitle || 'Register'}</h3>
              <span class="spacer"></span><span class="panel-x" id="rg-count">0</span>
            </header>
            <div class="rg-scroll">
              <table class="rg-table">
                <thead><tr>
                  ${cfg.columns.map((c) => `
                    <th data-sort="${c.id}" class="${c.align === 'r' ? 'ta-r' : ''}">
                      ${c.label}<i class="rg-caret"></i>
                    </th>`).join('')}
                </tr></thead>
                <tbody id="rg-rows"></tbody>
              </table>
            </div>
            <div class="rg-pager" id="rg-pager" hidden></div>
          </div>
          <aside class="rg-detail" id="rg-detail"></aside>
        </div>
      </div>`;
  }

  function renderRows() {
    const host = $('#rg-rows', view);
    if (!host) return;
    const list = visible();

    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    const start = page * PAGE;
    const slice = list.slice(start, start + PAGE);

    host.innerHTML = slice.length
      ? slice.map((r, i) => `
        <tr data-row="${start + i}" class="${selected && cfg.rowId(r) === cfg.rowId(selected) ? 'is-on' : ''}">
          ${cfg.columns.map((c) => `
            <td class="${c.align === 'r' ? 'ta-r' : ''} ${c.mono ? 't-mono' : ''}">${c.render ? c.render(r) : c.get(r)}</td>`).join('')}
        </tr>`).join('')
      : `<tr><td colspan="${cfg.columns.length}" class="rg-none">Nothing matches the current filters.</td></tr>`;

    $('#rg-count', view).textContent = list.length === rows.length
      ? `${list.length.toLocaleString('en-US')}`
      : `${list.length.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')}`;

    renderPager(list.length, pages, start, slice.length);

    $$('#rg-rows [data-row]', view).forEach((tr) => {
      tr.addEventListener('click', () => { selected = list[+tr.dataset.row]; renderRows(); renderDetail(); });
    });
    $$('th[data-sort]', view).forEach((th) => {
      th.classList.toggle('is-sorted', th.dataset.sort === sortId);
      th.dataset.dir = th.dataset.sort === sortId ? sortDir : '';
    });
  }

  /** Page controls, hidden when everything fits on one page. */
  function renderPager(total, pages, start, shown) {
    const host = $('#rg-pager', view);
    if (!host) return;
    if (pages <= 1) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = `
      <span class="rg-pg-info">
        ${(start + 1).toLocaleString('en-US')}–${(start + shown).toLocaleString('en-US')}
        of ${total.toLocaleString('en-US')}
      </span>
      <span class="spacer"></span>
      <button class="rg-pg" data-page="first" ${page === 0 ? 'disabled' : ''}>First</button>
      <button class="rg-pg" data-page="prev" ${page === 0 ? 'disabled' : ''}>Prev</button>
      <span class="rg-pg-n">Page ${page + 1} of ${pages.toLocaleString('en-US')}</span>
      <button class="rg-pg" data-page="next" ${page >= pages - 1 ? 'disabled' : ''}>Next</button>
      <button class="rg-pg" data-page="last" ${page >= pages - 1 ? 'disabled' : ''}>Last</button>`;
  }

  function renderKpis() {
    const host = $('#rg-kpis', view);
    if (host) host.innerHTML = cfg.kpis(visible(), rows).map(kpi).join('');
  }

  function renderDetail() {
    const host = $('#rg-detail', view);
    if (!host) return;
    host.innerHTML = selected ? cfg.detail(selected) : `
      <div class="pr-empty rg-empty">
        <div class="pr-empty-g">${icon(cfg.glyph || 'layers', { size: 26, sw: 1.3 })}</div>
        <p class="pr-empty-t">Select a record</p>
        <p class="pr-empty-s">${cfg.emptyHint || 'Its full detail opens here.'}</p>
      </div>`;
  }

  /** Mirror the shared selection so the user can see and clear it. */
  function renderCtxBar() {
    const host = $('#rg-ctx', view);
    if (!host) return;
    const c = ctx.get();
    const parts = [];
    if (c.commodity) parts.push(c.commodity);
    if (c.state) parts.push(c.state);
    if (c.lga) parts.push(c.lga);
    if (!parts.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = `
      <span class="ctx-bar-l">Context</span>
      <span class="ctx-bar-v">${parts.join(' · ')}</span>
      <span class="spacer"></span>
      <button class="ctx-clear" data-ctx-clear>Clear</button>`;
  }

  function refresh() { renderRows(); renderKpis(); renderDetail(); renderCtxBar(); }

  function wire() {
    const q = $('#rg-q', view);
    q?.addEventListener('input', debounce(() => { query = q.value; page = 0; renderRows(); renderKpis(); }, 150));

    view.addEventListener('change', (e) => {
      const f = e.target.closest('[data-filter]');
      if (f) { active[f.dataset.filter] = f.value; selected = null; page = 0; refresh(); }
    });

    view.addEventListener('click', (e) => {
      const pg = e.target.closest('[data-page]');
      if (pg) {
        const pages = Math.max(1, Math.ceil(visible().length / PAGE));
        const to = pg.dataset.page;
        page = to === 'first' ? 0 : to === 'last' ? pages - 1
          : to === 'next' ? page + 1 : page - 1;
        renderRows();
        $('.rg-scroll', view)?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const th = e.target.closest('th[data-sort]');
      if (th) {
        const id = th.dataset.sort;
        if (id === sortId) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortId = id; sortDir = 'asc'; }
        page = 0;
        renderRows();
        return;
      }
      if (e.target.closest('[data-ctx-clear]')) {
        ctx.clear();
        cfg.filters.forEach((x) => { active[x.id] = x.options[0].v; });
        $$('[data-filter]', view).forEach((sel) => { sel.value = active[sel.dataset.filter]; });
        selected = null;
        refresh();
        return;
      }

      cfg.onClick?.(e, () => selected, refresh);
    });
  }

  /**
   * Adopt the shared context: narrow to its state and, when the context names
   * a specific record this register owns, select and reveal it.
   */
  function applyContext() {
    const c = ctx.get();
    let changed = false;

    // Validate against the rendered <select>, not cfg.filters: option lists for
    // state/commodity are populated from the data after load, so the static
    // config is empty at this point.
    const optionExists = (filterId, value) => {
      const sel = $(`[data-filter="${filterId}"]`, view);
      if (sel) return [...sel.options].some((o) => o.value === value);
      return cfg.filters.find((x) => x.id === filterId)?.options.some((o) => o.v === value);
    };

    if (c.state && cfg.stateFilterId && active[cfg.stateFilterId] !== c.state
      && optionExists(cfg.stateFilterId, c.state)) {
      active[cfg.stateFilterId] = c.state; changed = true;
    }
    if (c.commodity && cfg.commodityFilterId && active[cfg.commodityFilterId] !== c.commodity
      && optionExists(cfg.commodityFilterId, c.commodity)) {
      active[cfg.commodityFilterId] = c.commodity; changed = true;
    }

    const wantedId = cfg.contextId ? cfg.contextId(c) : null;
    if (wantedId) {
      const hit = rows.find((r) => cfg.rowId(r) === wantedId);
      if (hit) { selected = hit; changed = true; }
    }

    if (changed) {
      // Reflect the new filter values in the selects.
      $$('[data-filter]', view).forEach((sel) => {
        if (active[sel.dataset.filter] !== undefined) sel.value = active[sel.dataset.filter];
      });
      refresh();
      const row = $('#rg-rows tr.is-on', view);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      renderCtxBar();
    }
  }

  return {
    applyContext,
    async mount() {
      view.innerHTML = `<div class="pr-loading">${icon('refresh', { size: 18 })}<span>${cfg.loadingLabel || 'Loading register…'}</span></div>`;
      rows = await cfg.load();
      view.innerHTML = shell();
      wire();
      refresh();
      applyContext();
    },
    get selected() { return selected; },
    select(id) {
      const hit = rows.find((r) => cfg.rowId(r) === id);
      if (!hit) return false;
      selected = hit;
      refresh();
      $('#rg-rows tr.is-on', view)?.scrollIntoView({ block: 'center' });
      return true;
    },
    get rows() { return rows; },
    get visibleRows() { return visible(); },
    refresh,
  };
}
