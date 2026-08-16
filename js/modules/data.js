/**
 * DATA CENTER MODULE
 * ==================
 * The provenance view: which datasets are connected, where they came from,
 * how complete they are, and what is still waiting on a data service. This is
 * the honest inventory behind every number the rest of the app displays.
 */

import { $, $$, fmt } from '../core/utils.js?v=effc9f2';
import { icon } from '../core/icons.js?v=effc9f2';
import { api } from '../data/api.js?v=effc9f2';
import { reports } from '../core/reports.js?v=effc9f2';
import { toast } from './dashboard.js?v=effc9f2';

const STATUS = {
  Connected: { c: 'var(--green)', d: 'Live source, refreshed on deploy' },
  'Sample data': { c: 'var(--gold)', d: 'Deterministic placeholder pending the real feed' },
  Derived: { c: 'var(--cyan)', d: 'Computed in-browser from connected inputs' },
  'On demand': { c: 'var(--purple)', d: 'Fetched from a third-party tile service' },
  'Not connected': { c: 'var(--text-low)', d: 'No data service attached yet' },
};

export function createDataCenter() {
  let sets = [];
  let health = null;
  let view;
  let filter = '*';

  const card = (d) => {
    const st = STATUS[d.status] || STATUS['Not connected'];
    return `
      <article class="dc-card ${d.status === 'Not connected' ? 'is-off' : ''}" data-ds="${d.id}">
        <header class="dc-card-hd">
          <span class="dc-dot" style="background:${st.c};box-shadow:0 0 8px ${st.c}"></span>
          <div class="dc-card-t">
            <h3>${d.name}</h3>
            <p>${d.domain} · ${d.format}</p>
          </div>
          <span class="dc-status" style="color:${st.c}">${d.status}</span>
        </header>

        <div class="dc-quality">
          <div class="dc-q-bar"><i style="width:${d.quality}%;background:${st.c}"></i></div>
          <span class="t-mono">${d.quality}%</span>
        </div>

        <dl class="dc-meta">
          <div><dt>Source</dt><dd>${d.source}</dd></div>
          <div><dt>Records</dt><dd class="t-mono">${d.records ? fmt.int(d.records) : '—'}</dd></div>
          <div><dt>Size</dt><dd class="t-mono">${d.sizeMb ? `${d.sizeMb} MB` : '—'}</dd></div>
          <div><dt>Updated</dt><dd>${d.updated || '—'}</dd></div>
          <div><dt>Licence</dt><dd>${d.licence}</dd></div>
        </dl>
      </article>`;
  };

  function render() {
    const list = filter === '*' ? sets : sets.filter((d) => d.domain === filter);
    const domains = ['*', ...new Set(sets.map((d) => d.domain))];
    const conn = sets.filter((d) => d.status === 'Connected').length;
    const pend = sets.filter((d) => d.status === 'Not connected').length;
    const recs = sets.reduce((a, d) => a + d.records, 0);
    const avgQ = Math.round(sets.reduce((a, d) => a + d.quality, 0) / sets.length);

    view.innerHTML = `
      <div class="pr-wrap dc-wrap">
        <header class="pr-head">
          <div class="pr-head-t">
            <h1>Data Center</h1>
            <p>Provenance and completeness for every dataset behind the platform — what is live, what is placeholder, and what is still awaiting a service.</p>
          </div>
          <div class="pr-head-k">
            <div class="pr-kpi"><div class="pr-kpi-l">Datasets</div>
              <div class="pr-kpi-v">${sets.length}</div><div class="pr-kpi-s">${conn} connected</div></div>
            <div class="pr-kpi"><div class="pr-kpi-l">Records</div>
              <div class="pr-kpi-v" style="color:var(--cyan)">${fmt.compact(recs)}</div><div class="pr-kpi-s">indexed</div></div>
            <div class="pr-kpi"><div class="pr-kpi-l">Mean quality</div>
              <div class="pr-kpi-v" style="color:var(--gold)">${avgQ}%</div><div class="pr-kpi-s">${pend} not connected</div></div>
          </div>
        </header>

        <div class="rg-tools">
          <div class="dc-chips">
            ${domains.map((d) => `
              <button class="dc-chip ${filter === d ? 'is-on' : ''}" data-domain="${d}">
                ${d === '*' ? 'All domains' : d}
              </button>`).join('')}
          </div>
          <span class="spacer"></span>
          <button class="btn-ghost rg-report" data-report-all>
            ${icon('reports', { size: 13 })} Add to report
          </button>
        </div>

        <div class="dc-grid">${list.map(card).join('')}</div>

        <section class="panel dc-health">
          <header class="panel-hd">
            <span class="accent-bar accent-green"></span><h3>Service health</h3>
            <span class="spacer"></span>
            <span class="panel-x t-mono">${health?.latencyMs ?? '—'} ms</span>
          </header>
          <div class="panel-bd dc-health-bd">
            <div class="dc-h-row">
              <span>API transport</span>
              <b style="color:var(--gold)">In-browser fixtures</b>
              <em>Every call routes through the same api.js contract, so swapping in Laravel endpoints is a base-URL change.</em>
            </div>
            <div class="dc-h-row">
              <span>Geometry</span>
              <b style="color:var(--green)">geoBoundaries ADM1 + ADM2</b>
              <em>37 state polygons bundled; 774 LGA polygons loaded per state on demand.</em>
            </div>
            <div class="dc-h-row">
              <span>Basemap tiles</span>
              <b style="color:var(--purple)">ArcGIS World Imagery</b>
              <em>External request, only when satellite view is enabled; the vector basemap is fully local.</em>
            </div>
            <div class="dc-h-row">
              <span>Derived analytics</span>
              <b style="color:var(--cyan)">Prospectivity + risk engines</b>
              <em>Pure functions over connected inputs; no server round-trip, recomputed as weights change.</em>
            </div>
          </div>
        </section>
      </div>`;
  }

  return {
    async mount(v) {
      view = v;
      view.innerHTML = `<div class="pr-loading">${icon('refresh', { size: 18 })}<span>Loading data catalogue…</span></div>`;
      [sets, health] = await Promise.all([api.getDatasets(), api.getSystemHealth()]);
      render();

      view.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-domain]');
        if (chip) { filter = chip.dataset.domain; render(); return; }
        if (e.target.closest('[data-report-all]')) {
          const ok = reports.add({ kind: 'datasets', id: null, title: 'Data coverage & provenance' });
          toast(ok ? 'Added data coverage to the report' : 'Data coverage is already in the report');
        }
      });
    },
  };
}
