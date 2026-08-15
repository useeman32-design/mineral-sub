/**
 * DASHBOARD MODULE
 * ================
 * Composition only — every value comes from api.getDashboardSummary().
 * The map owns the majority of the viewport; intel cards flank it.
 */

import { api } from '../data/api.js';
import { store } from '../core/store.js';
import { icon } from '../core/icons.js';
import { $, $$, fmt, sparkline, bars, ring, donut, countUp } from '../core/utils.js';
import { NigeriaMap } from '../components/map.js';
import { RESOURCE_META } from '../data/fixtures.js';
import { mapToolbar } from '../components/map-toolbar.js';
import { initRail } from '../components/rail.js';
import { loadPrefs } from './settings.js';

export function createDashboard() {
  let root, nmap, data, rail, lastLga = null, unsub = [];

  /* ---------------- templates ---------------- */

  const kpiCard = (k) => `
    <article class="panel kpi" data-kpi="${k.id}" style="--kpi-c:${k.color}">
      <div class="kpi-top">
        <span class="kpi-ico">
          ${icon(k.id === 'occurrences' ? 'minerals' : k.id === 'blocks' ? 'oil' : k.id === 'titles' ? 'titles' : 'risk', { size: 15 })}
        </span>
        <span class="kpi-label">${k.label}</span>
        <span class="delta ${k.delta > 0 ? 'up' : k.delta < 0 ? 'down' : 'flat'}">
          ${icon(k.delta >= 0 ? 'chevron' : 'chevron', { size: 9, cls: k.delta >= 0 ? 'd-up' : 'd-down', sw: 3 })}${Math.abs(k.delta).toFixed(1)}%
        </span>
      </div>
      <div class="kpi-mid">
        <span class="kpi-n" data-count="${k.value}">0</span>
        <span class="kpi-u">${k.unit}</span>
        <span class="kpi-spark">${sparkline(k.series, { color: k.color, w: 66, h: 26 })}</span>
      </div>
      <div class="kpi-foot"><span class="ctx">${k.ctx}</span></div>
    </article>`;

  const mineralCard = (m) => `
    <article class="panel">
      <header class="panel-hd">
        <span class="accent-bar"></span><h3>Mineral Intelligence</h3><span class="spacer"></span>
        <span class="t-label">National</span>
      </header>
      <div class="panel-bd">
        <div class="stat-trio">
          <div class="st3">
            <span class="st3-n" style="color:var(--green)" data-count="${m.occurrences}">0</span>
            <span class="st3-k">Occurrences</span>
          </div>
          <div class="st3">
            <span class="st3-n" style="color:var(--cyan)" data-count="${m.commodities}">0</span>
            <span class="st3-k">Commodities</span>
          </div>
          <div class="st3">
            <span class="st3-n" style="color:var(--gold)" data-count="${m.highProspectivity}">0</span>
            <span class="st3-k">High Zones</span>
          </div>
        </div>
        <details class="more">
          <summary>Breakdown by class ${icon('chevron', { size: 11 })}</summary>
          <div class="row gap-12" style="align-items:center;margin-top:9px">
            ${donut(m.split, { size: 58, sw: 7 })}
            <div class="col gap-4" style="flex:1">
              ${m.split.map((x) => `
                <span class="row gap-6" style="font-size:var(--fs-xs);color:var(--text-mid)">
                  <i style="width:6px;height:6px;border-radius:50%;background:${x.color};display:block;flex:none"></i>
                  <span style="flex:1">${x.label}</span>
                  <b class="t-mono" style="color:var(--text-hi)">${x.value}</b>
                </span>`).join('')}
            </div>
          </div>
        </details>
      </div>
    </article>`;

  const petroCard = (p) => `
    <article class="panel">
      <header class="panel-hd">
        <span class="accent-bar accent-cyan"></span><h3>Petroleum Intelligence</h3><span class="spacer"></span>
        <span class="t-label">Upstream</span>
      </header>
      <div class="panel-bd">
        <div class="stat-trio">
          <div class="st3"><span class="st3-n" style="color:var(--green)" data-count="${p.oilFields}">0</span><span class="st3-k">Oil Fields</span></div>
          <div class="st3"><span class="st3-n" style="color:#37d6ff" data-count="${p.gasFields}">0</span><span class="st3-k">Gas Fields</span></div>
          <div class="st3"><span class="st3-n" style="color:var(--cyan)" data-count="${p.activeBlocks}">0</span><span class="st3-k">Blocks</span></div>
        </div>
        <div class="row gap-10" style="margin-top:9px;padding-top:8px;border-top:1px solid var(--line-faint)">
          <div style="flex:1">
            <div class="t-label" style="margin-bottom:3px">Production</div>
            <div class="row gap-6">
              <b class="t-mono" style="font-size:var(--fs-md);color:var(--green-300)">${p.production.at(-1)}</b>
              <span style="font-size:9px;color:var(--text-faint)">mbpd</span>
              <span class="delta up">+2.1%</span>
            </div>
          </div>
          ${sparkline(p.production, { color: 'var(--green)', w: 76, h: 28 })}
        </div>
        <details class="more">
          <summary>Reserves ${icon('chevron', { size: 11 })}</summary>
          <div class="col gap-8" style="margin-top:8px">
            <div class="row gap-6">
              <span class="t-label" style="flex:none;width:60px">Oil</span>
              <div class="meter" style="flex:1"><i style="width:64%;background:linear-gradient(90deg,var(--gold-600),var(--gold))"></i></div>
              <span class="t-mono" style="font-size:var(--fs-xs);color:var(--gold)">${p.reservesOil} Bbbl</span>
            </div>
            <div class="row gap-6">
              <span class="t-label" style="flex:none;width:60px">Gas</span>
              <div class="meter" style="flex:1"><i style="width:78%;background:linear-gradient(90deg,var(--cyan-600),#37d6ff)"></i></div>
              <span class="t-mono" style="font-size:var(--fs-xs);color:#37d6ff">${p.reservesGas} TCF</span>
            </div>
          </div>
        </details>
      </div>
    </article>`;

  const riskCard = (rows) => `
    <article class="panel">
      <header class="panel-hd">
        <span class="accent-bar accent-red"></span><h3>Risk Intelligence</h3><span class="spacer"></span>
        <span class="pill" style="height:19px;font-size:8.5px;padding:0 7px;border-color:rgba(255,77,94,.28);color:var(--red);background:rgba(255,77,94,.08)">4 CLASSES</span>
      </header>
      <div class="panel-bd">
        ${rows.slice(0, 2).map((r) => `
          <div class="risk-row">
            <div class="risk-top">
              <span class="risk-name">${r.label}</span>
              <span class="risk-val">
                <span class="n" style="color:${r.sev === 'high' ? 'var(--red)' : r.sev === 'med' ? 'var(--orange)' : 'var(--green)'}" data-count="${r.value}">0</span>
                <span class="sev sev-${r.sev}">${r.sev}</span>
              </span>
            </div>
            <div class="meter"><i style="width:${r.pct}%;background:${r.sev === 'high' ? 'linear-gradient(90deg,#ff8a3d,#ff4d5e)' : r.sev === 'med' ? 'linear-gradient(90deg,#f5b942,#ff8a3d)' : 'linear-gradient(90deg,#2dd8c3,#00e676)'};box-shadow:0 0 8px ${r.sev === 'high' ? '#ff4d5e' : r.sev === 'med' ? '#ff8a3d' : '#00e676'}"></i></div>
            <div class="cov-sub"><span>${r.note}</span></div>
          </div>`).join('')}
        <details class="more">
          <summary>${rows.length - 2} more risk classes ${icon('chevron', { size: 11 })}</summary>
          ${rows.slice(2).map((r) => `
            <div class="risk-row">
              <div class="risk-top">
                <span class="risk-name">${r.label}</span>
                <span class="risk-val">
                  <span class="n" style="color:${r.sev === 'high' ? 'var(--red)' : r.sev === 'med' ? 'var(--orange)' : 'var(--green)'}">${r.value}</span>
                  <span class="sev sev-${r.sev}">${r.sev}</span>
                </span>
              </div>
              <div class="meter"><i style="width:${r.pct}%;background:${r.sev === 'high' ? 'linear-gradient(90deg,#ff8a3d,#ff4d5e)' : r.sev === 'med' ? 'linear-gradient(90deg,#f5b942,#ff8a3d)' : 'linear-gradient(90deg,#2dd8c3,#00e676)'}"></i></div>
              <div class="cov-sub"><span>${r.note}</span></div>
            </div>`).join('')}
        </details>
      </div>
    </article>`;

  const coverageCard = (rows) => `
    <article class="panel">
      <header class="panel-hd">
        <span class="accent-bar accent-purple"></span><h3>Data Coverage</h3><span class="spacer"></span>
        <span class="t-label">37 states</span>
      </header>
      <div class="panel-bd">
        ${rows.map((c) => `
          <div class="cov-row">
            <div class="cov-top">
              <span class="cov-name"><i class="cd" style="background:${c.color};box-shadow:0 0 6px ${c.color}"></i>${c.label}</span>
              <span class="cov-pct" style="color:${c.color}">${c.pct}%</span>
            </div>
            <div class="meter"><i data-meter="${c.pct}" style="width:0;background:${c.color};box-shadow:0 0 8px ${c.color}"></i></div>
            <div class="cov-sub"><span>${c.scale}</span><span>${c.updated}</span></div>
          </div>`).join('')}
      </div>
    </article>`;

  const commodityCard = (list) => `
    <article class="panel">
      <header class="panel-hd">
        <span class="accent-bar accent-gold"></span><h3>Top Commodities</h3><span class="spacer"></span>
        <span class="t-label">by occurrence</span>
      </header>
      <div class="panel-bd">
        <div class="comm-list">
          ${list.slice(0, 5).map((c) => {
            const m = RESOURCE_META[c.id] || {};
            return `<div class="comm-row" data-resource="${c.id}">
              <i class="comm-dot" style="background:${m.hex};box-shadow:0 0 6px ${m.hex}"></i>
              <span class="comm-name">${c.label}</span>
              <span class="comm-bar"><i data-meter="${c.pct}" style="width:0;background:${m.hex}"></i></span>
              <span class="comm-n">${c.n}</span>
            </div>`;
          }).join('')}
        </div>
        <details class="more">
          <summary>${list.length - 5} more commodities ${icon('chevron', { size: 11 })}</summary>
          <div class="comm-list" style="margin-top:7px">
            ${list.slice(5).map((c) => {
              const m = RESOURCE_META[c.id] || {};
              return `<div class="comm-row" data-resource="${c.id}">
                <i class="comm-dot" style="background:${m.hex};box-shadow:0 0 6px ${m.hex}"></i>
                <span class="comm-name">${c.label}</span>
                <span class="comm-bar"><i style="width:${c.pct}%;background:${m.hex}"></i></span>
                <span class="comm-n">${c.n}</span>
              </div>`;
            }).join('')}
          </div>
        </details>
      </div>
    </article>`;

  const feedCard = (items) => `
    <article class="panel">
      <header class="panel-hd">
        <span class="accent-bar"></span><h3>Intelligence Feed</h3><span class="spacer"></span>
        <span class="live-dot"></span><span class="t-label" style="color:var(--green)">Live</span>
      </header>
      <div class="panel-bd">
        <div class="feed">
          ${items.slice(0, 3).map((a) => `
            <div class="feed-item">
              <i class="feed-mark" style="background:${a.color};box-shadow:0 0 6px ${a.color}"></i>
              <div class="feed-body">
                <div class="feed-title">${a.t}</div>
                <div class="feed-meta"><span class="fm-src">${a.src}</span><span>${a.time}</span></div>
              </div>
            </div>`).join('')}
        </div>
        <details class="more">
          <summary>${items.length - 3} earlier events ${icon('chevron', { size: 11 })}</summary>
          <div class="feed" style="margin-top:4px">
            ${items.slice(3).map((a) => `
              <div class="feed-item">
                <i class="feed-mark" style="background:${a.color};box-shadow:0 0 6px ${a.color}"></i>
                <div class="feed-body">
                  <div class="feed-title">${a.t}</div>
                  <div class="feed-meta"><span class="fm-src">${a.src}</span><span>${a.time}</span></div>
                </div>
              </div>`).join('')}
          </div>
        </details>
      </div>
    </article>`;

  const lgaCard = (p) => `
    <article class="panel sel-card" id="sel-card">
      <header class="panel-hd">
        <span class="accent-bar accent-cyan"></span><h3>Geographic Selection</h3><span class="spacer"></span>
        <button class="icon-btn" data-act="clear-sel" title="Clear selection" style="width:22px;height:22px">${icon('crosshair', { size: 13 })}</button>
      </header>
      <div class="panel-bd">
        <div class="sel-head">
          <div>
            <div class="sel-name">${p.name}</div>
            <div class="sel-sub">Local Government · ${p.state} · ${fmt.coord(p.centroid[0], p.centroid[1])}</div>
          </div>
          <span class="st-chip" style="color:var(--cyan);background:rgba(45,216,195,.12);border:1px solid rgba(45,216,195,.3)">LGA</span>
        </div>
        <div class="empty-sel" style="padding:12px 4px 4px;text-align:left;align-items:flex-start">
          <p class="es-t" style="text-align:left">LGA-level occurrence counts, mining titles and prospectivity scores arrive with the ADM2 data service.</p>
        </div>
        <div class="sel-actions">
          <button class="btn-ghost btn-primary" data-act="zoom-lga">Zoom to LGA</button>
          <button class="btn-ghost" data-act="back-state">Back</button>
        </div>
      </div>
    </article>`;

  const selectionCard = (p) => {
    if (!p) return `
      <article class="panel sel-card" id="sel-card">
        <header class="panel-hd">
          <span class="accent-bar accent-cyan"></span><h3>Geographic Selection</h3>
        </header>
        <div class="panel-bd">
          <div class="empty-sel">
            <span class="es-ico">${icon('target', { size: 26 })}</span>
            <p class="es-t">Select a state on the map to open its resource profile and begin drilling into LGAs.</p>
          </div>
        </div>
      </article>`;

    const riskColor = { high: 'var(--red)', medium: 'var(--orange)', low: 'var(--green)' }[p.risk];
    const chips = (p.commodities || []).map((c) => {
      const m = RESOURCE_META[c] || {};
      return `<span class="st-chip" style="color:${m.hex};background:${m.hex}1a;border:1px solid ${m.hex}3d">${m.label || c}</span>`;
    }).join('');

    return `
      <article class="panel sel-card" id="sel-card">
        <header class="panel-hd">
          <span class="accent-bar accent-cyan"></span><h3>Geographic Selection</h3><span class="spacer"></span>
          <button class="icon-btn" data-act="clear-sel" title="Clear selection" style="width:22px;height:22px">${icon('crosshair', { size: 13 })}</button>
        </header>
        <div class="panel-bd">
          <div class="sel-head">
            <div>
              <div class="sel-name">${p.name}</div>
              <div class="sel-sub">${p.region} · ${p.code} · ${fmt.coord(p.centroid[0], p.centroid[1])}</div>
            </div>
            ${ring(p.prospectivity, { size: 46, sw: 4.5, color: 'var(--gold)', label: p.prospectivity })}
          </div>
          <div class="st-chips" style="margin-top:9px">${chips}</div>
          <div class="sel-grid">
            <div class="sel-cell"><div class="k">Occurrences</div><div class="v" style="color:var(--green)">${fmt.int(p.occurrences)}</div></div>
            <div class="sel-cell"><div class="k">Mining Titles</div><div class="v" style="color:var(--cyan)">${fmt.int(p.titles)}</div></div>
            <div class="sel-cell"><div class="k">Risk Class</div><div class="v" style="color:${riskColor};text-transform:capitalize;font-size:var(--fs-base)">${p.risk}</div></div>
            <div class="sel-cell"><div class="k">Data Coverage</div><div class="v" style="color:var(--purple)">${p.coverage}%</div></div>
          </div>
          <div class="sel-actions">
            <button class="btn-ghost btn-primary" data-act="drill">Drill to LGAs</button>
            <button class="btn-ghost" data-act="report">Report</button>
          </div>
        </div>
      </article>`;
  };

  /* ---------------- lifecycle ---------------- */

  async function mount(view) {
    root = view;
    view.innerHTML = `
      <div class="dash">
        <div class="kpi-strip" id="kpi-strip"></div>

        <section class="map-stage" id="map-stage" aria-label="National mineral intelligence map">
          <span class="reticle tl"></span><span class="reticle tr"></span>
          <span class="reticle bl"></span><span class="reticle br"></span>
          <div id="map-canvas"></div>
          <div class="map-loading" id="map-loading">
            <div class="ml-in"><div class="ml-ring"></div><div class="ml-t">Loading national vector layers</div></div>
          </div>
        </section>

        <aside class="intel-rail" id="intel-rail"></aside>
        <div class="rail-below" id="rail-below"></div>
      </div>`;

    data = await api.getDashboardSummary();

    // KPI strip
    $('#kpi-strip', view).innerHTML = data.kpis.map(kpiCard).join('');

    // Intel rail
    $('#intel-rail', view).innerHTML = [
      selectionCard(null),
      mineralCard(data.mineral),
      petroCard(data.petroleum),
      riskCard(data.risk),
      coverageCard(data.coverage),
      commodityCard(data.commodities),
      feedCard(data.activity),
    ].join('');

    animateNumbers(view);

    // Map
    const stage = $('#map-stage', view);
    nmap = new NigeriaMap(stage, {
      api,
      onSelect: (props) => { lastLga = null; renderSelection(props); },
      onLgaSelect: (props) => { lastLga = props; renderSelection(props, 'lga'); },
    });
    await nmap.init();
    mapToolbar(stage, nmap);
    $('#map-loading', view).classList.add('is-hidden');

    // Resizable / collapsible intel rail (cards reflow below the map when hidden)
    rail = initRail($('.dash', view), { onResize: () => nmap.invalidate() });

    // Honour saved preferences from Settings
    const prefs = loadPrefs();
    if (!prefs.mapLabels) nmap.setLabels(false);
    stage.classList.toggle('pulse-off', !prefs.pulseMarkers);
    addEventListener('nmi:prefs', (e) => {
      nmap.setLabels(e.detail.mapLabels);
      stage.classList.toggle('pulse-off', !e.detail.pulseMarkers);
      nmap.invalidate();
    });

    // Rail interactions
    $('#intel-rail', view).addEventListener('click', (e) => {
      const row = e.target.closest('.comm-row');
      if (row) { nmap.filterResources([row.dataset.resource]); flashToolbarResource(stage, row.dataset.resource); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'clear-sel') { lastLga = null; nmap.clearSelection(); }
      if (act === 'zoom-lga' && lastLga) {
        const l = nmap.layers.lgas?.getLayers().find((x) => x.feature.properties.name === lastLga.name);
        if (l) nmap.map.flyToBounds(l.getBounds(), { padding: [60, 60], duration: .8 });
      }
      if (act === 'back-state') {
        lastLga = null;
        const st = store.get('selectedState');
        renderSelection(st);
        const layer = st && nmap.stateLayers.get(st.name);
        if (layer) nmap.map.flyToBounds(layer.getBounds(), { padding: [40, 40], duration: .8 });
      }
      if (act === 'drill') {
        const st = store.get('selectedState');
        if (!st) return;
        const layer = nmap.stateLayers.get(st.name);
        nmap.map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 9.2, duration: .9 });
        nmap.showLgas(st.code, { explicit: true }).then(() => {
          const n = nmap.layers.lgas?.getLayers().length || 0;
          toast(`${st.name}: ${n} local government areas loaded`);
        });
      }
      if (act === 'report') toast('Report generation moves in with the Reports module');
    });

    unsub.push(store.subscribe('selectedState', (p) => { if (!lastLga) renderSelection(p); }));
  }

  function renderSelection(props, kind) {
    const card = $('#sel-card', root);
    if (!card) return;
    card.outerHTML = kind === 'lga' ? lgaCard(props) : selectionCard(props);
  }

  function animateNumbers(scope) {
    $$('[data-count]', scope).forEach((n) => countUp(n, +n.dataset.count, { dur: 1000 }));
    requestAnimationFrame(() => {
      $$('[data-meter]', scope).forEach((m) => { m.style.width = m.dataset.meter + '%'; });
    });
  }

  function flashToolbarResource(stage, id) {
    const meta = RESOURCE_META[id];
    toast(`Filtered map to ${meta?.label || id}`);
  }

  return {
    mount,
    onShow() { requestAnimationFrame(() => nmap?.invalidate()); },
    onHide() {},
    destroy() { unsub.forEach((f) => f()); nmap?.destroy(); },
  };
}

/* ---------------- lightweight toast ---------------- */
let toastTimer;
export function toast(msg) {
  let t = document.getElementById('nmi-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'nmi-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
}
