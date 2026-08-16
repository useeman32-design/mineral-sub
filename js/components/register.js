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

import { $, $$, fmt, debounce } from '../core/utils.js?v=effc9f2';
import { icon } from '../core/icons.js?v=effc9f2';

export function createRegister(view, cfg) {
  let rows = [];
  let selected = null;
  let query = '';
  let sortId = cfg.defaultSort || cfg.columns[0].id;
  let sortDir = cfg.defaultDir || 'asc';
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
          </div>
          <aside class="rg-detail" id="rg-detail"></aside>
        </div>
      </div>`;
  }

  function renderRows() {
    const host = $('#rg-rows', view);
    if (!host) return;
    const list = visible();
    host.innerHTML = list.length
      ? list.map((r, i) => `
        <tr data-row="${i}" class="${selected && cfg.rowId(r) === cfg.rowId(selected) ? 'is-on' : ''}">
          ${cfg.columns.map((c) => `
            <td class="${c.align === 'r' ? 'ta-r' : ''} ${c.mono ? 't-mono' : ''}">${c.render ? c.render(r) : c.get(r)}</td>`).join('')}
        </tr>`).join('')
      : `<tr><td colspan="${cfg.columns.length}" class="rg-none">Nothing matches the current filters.</td></tr>`;

    $('#rg-count', view).textContent = `${list.length} of ${rows.length}`;
    $$('#rg-rows [data-row]', view).forEach((tr) => {
      tr.addEventListener('click', () => { selected = list[+tr.dataset.row]; renderRows(); renderDetail(); });
    });
    $$('th[data-sort]', view).forEach((th) => {
      th.classList.toggle('is-sorted', th.dataset.sort === sortId);
      th.dataset.dir = th.dataset.sort === sortId ? sortDir : '';
    });
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

  function refresh() { renderRows(); renderKpis(); renderDetail(); }

  function wire() {
    const q = $('#rg-q', view);
    q?.addEventListener('input', debounce(() => { query = q.value; renderRows(); renderKpis(); }, 150));

    view.addEventListener('change', (e) => {
      const f = e.target.closest('[data-filter]');
      if (f) { active[f.dataset.filter] = f.value; selected = null; refresh(); }
    });

    view.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const id = th.dataset.sort;
        if (id === sortId) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortId = id; sortDir = 'asc'; }
        renderRows();
        return;
      }
      cfg.onClick?.(e, () => selected, refresh);
    });
  }

  return {
    async mount() {
      view.innerHTML = `<div class="pr-loading">${icon('refresh', { size: 18 })}<span>${cfg.loadingLabel || 'Loading register…'}</span></div>`;
      rows = await cfg.load();
      view.innerHTML = shell();
      wire();
      refresh();
    },
    get selected() { return selected; },
    get rows() { return rows; },
    get visibleRows() { return visible(); },
    refresh,
  };
}
