/**
 * EXPLORE MAP MODULE
 * ==================
 * A full-bleed GIS workspace. Where the Dashboard frames the map inside an
 * intelligence layout, Explore hands the entire viewport to the map and puts
 * analysis tooling around its edges:
 *
 *   · left dock   — layer tree, drill navigator, filters
 *   · right dock  — inspector for whatever is selected/hovered
 *   · bottom bar  — coordinate readout, scale, measurement, basemap
 *
 * It reuses the same NigeriaMap engine as the Dashboard, so behaviour and
 * design language stay identical; only the composition differs.
 */

import { api } from '../data/api.js';
import { store } from '../core/store.js';
import { icon } from '../core/icons.js';
import { $, $$, fmt, sparkline, ring } from '../core/utils.js';
import { NigeriaMap, zoomBand } from '../components/map.js';
import { RESOURCE_META } from '../data/fixtures.js';
import { toast } from './dashboard.js';

const RESOURCES = ['gold', 'lithium', 'tin', 'iron', 'lead', 'barite', 'oil', 'gas'];

const LAYER_TREE = [
  {
    group: 'Base', items: [
      { id: 'graticule', label: 'Coordinate grid', color: '#2dd8c3', on: true },
      { id: 'labels', label: 'Place labels', color: '#93a8ab', on: true },
    ],
  },
  {
    group: 'Mineral', items: [
      { id: 'deposits', label: 'Mineral occurrences', color: '#f5b942', on: true },
      { id: 'prospectivity', label: 'Prospectivity heat', color: '#ff8a3d', on: true },
      { id: 'lgas', label: 'LGA boundaries', color: '#5eead4', on: false, hint: 'Auto at zoom 8.5+' },
    ],
  },
  {
    group: 'Pending data service', items: [
      { id: 'geology', label: 'Geological units', color: '#8b7dff', soon: true },
      { id: 'titles', label: 'Mining titles', color: '#4d9dff', soon: true },
      { id: 'risk', label: 'Risk zones', color: '#ff4d5e', soon: true },
      { id: 'infra', label: 'Roads & infrastructure', color: '#9aa7b0', soon: true },
    ],
  },
];

export function createExplore() {
  let root, nmap, deposits = [], unsub = [];
  let measuring = false, measurePts = [], measureLine = null, measureMarks = [], measureHook = null;

  /* ================= templates ================= */

  const layerTree = () => LAYER_TREE.map((g) => `
    <div class="lt-group">
      <div class="lt-group-hd">${g.group}</div>
      ${g.items.map((it) => `
        <button class="lt-item ${it.on ? 'is-on' : ''} ${it.soon ? 'is-soon' : ''}"
                data-layer="${it.id}" role="switch" aria-checked="${!!it.on}">
          <span class="lt-eye">${icon('eye', { size: 13 })}</span>
          <i class="lt-swatch" style="background:${it.color};box-shadow:0 0 6px ${it.color}"></i>
          <span class="lt-label">${it.label}</span>
          ${it.soon ? '<span class="lt-tag">SOON</span>'
                    : it.hint ? `<span class="lt-hint" title="${it.hint}">${icon('info', { size: 11 })}</span>` : ''}
        </button>`).join('')}
    </div>`).join('');

  const resourceFilter = () => `
    <div class="ex-chips">
      ${RESOURCES.map((r) => {
        const m = RESOURCE_META[r];
        return `<button class="ex-chip is-on" data-res="${r}" style="--rc:${m.hex}">
          <i style="background:${m.hex}"></i>${m.label}</button>`;
      }).join('')}
    </div>
    <div class="row gap-6" style="margin-top:8px">
      <button class="btn-ghost" data-res-all="1" style="height:25px;font-size:9px">All</button>
      <button class="btn-ghost" data-res-none="1" style="height:25px;font-size:9px">None</button>
    </div>`;

  const drillNav = () => {
    const d = store.get('drill');
    const steps = [
      { k: 'nation', label: 'Nigeria', sub: '37 states', done: true },
      { k: 'state', label: d.state || 'Select a state', sub: d.state ? 'Click to zoom' : 'Click the map', done: !!d.state },
      { k: 'lga', label: d.lga || 'Local government', sub: d.state ? 'Zoom to 8.5+' : 'Awaiting state', done: !!d.lga },
      { k: 'prospect', label: d.prospect || 'Mineral prospect', sub: 'Zoom to 13+', done: !!d.prospect },
    ];
    return steps.map((s, i) => `
      <div class="drill-step ${s.done ? 'is-done' : ''} ${d.level === s.k ? 'is-current' : ''}" data-step="${s.k}">
        <span class="ds-node">${s.done ? icon('check', { size: 10, sw: 3 }) : i + 1}</span>
        <span class="ds-body">
          <span class="ds-label">${s.label}</span>
          <span class="ds-sub">${s.sub}</span>
        </span>
      </div>`).join('');
  };

  const inspectorEmpty = () => `
    <div class="empty-sel" style="padding:26px 12px">
      <span class="es-ico">${icon('target', { size: 28 })}</span>
      <p class="es-t">Hover or select a state, LGA or occurrence.<br/>Its full profile appears here.</p>
    </div>`;

  const inspectorState = (p) => {
    const riskColor = { high: 'var(--red)', medium: 'var(--orange)', low: 'var(--green)' }[p.risk];
    const chips = (p.commodities || []).map((c) => {
      const m = RESOURCE_META[c] || {};
      return `<span class="st-chip" style="color:${m.hex};background:${m.hex}1a;border:1px solid ${m.hex}3d">${m.label || c}</span>`;
    }).join('');
    const local = deposits.filter((d) => d.state === p.name);

    return `
      <div class="insp-head">
        <div>
          <div class="insp-kind">State · ADM1</div>
          <div class="insp-title">${p.name}</div>
          <div class="insp-sub">${p.region} · ${p.code} · ${fmt.coord(p.centroid[0], p.centroid[1])}</div>
        </div>
        ${ring(p.prospectivity, { size: 50, sw: 5, color: 'var(--gold)', label: p.prospectivity })}
      </div>
      <div class="st-chips" style="margin:10px 0">${chips}</div>
      <div class="sel-grid" style="margin-top:0">
        <div class="sel-cell"><div class="k">Occurrences</div><div class="v" style="color:var(--green)">${fmt.int(p.occurrences)}</div></div>
        <div class="sel-cell"><div class="k">Mining Titles</div><div class="v" style="color:var(--cyan)">${fmt.int(p.titles)}</div></div>
        <div class="sel-cell"><div class="k">Risk Class</div><div class="v" style="color:${riskColor};text-transform:capitalize;font-size:var(--fs-base)">${p.risk}</div></div>
        <div class="sel-cell"><div class="k">Coverage</div><div class="v" style="color:var(--purple)">${p.coverage}%</div></div>
      </div>

      <div class="insp-sec">
        <div class="insp-sec-hd">Known occurrences <span>${local.length}</span></div>
        ${local.length ? `<div class="occ-list">
          ${local.slice(0, 8).map((d) => {
            const m = RESOURCE_META[d.resource] || {};
            return `<button class="occ-row" data-fly="${d.id}">
              <i style="background:${m.hex};box-shadow:0 0 6px ${m.hex}"></i>
              <span class="occ-n">${d.name}</span>
              <span class="occ-s">${d.status}</span>
            </button>`;
          }).join('')}
          ${local.length > 8 ? `<div class="occ-more">+${local.length - 8} more</div>` : ''}
        </div>` : '<div class="insp-none">No catalogued occurrences in this state.</div>'}
      </div>

      <div class="sel-actions">
        <button class="btn-ghost btn-primary" data-act="drill-lga">Load LGAs</button>
        <button class="btn-ghost" data-act="zoom-state">Zoom</button>
      </div>`;
  };

  const inspectorDeposit = (d) => {
    const m = RESOURCE_META[d.resource] || {};
    return `
      <div class="insp-head">
        <div>
          <div class="insp-kind" style="color:${m.hex}">Occurrence · ${m.label}</div>
          <div class="insp-title">${d.name}</div>
          <div class="insp-sub t-mono">${fmt.coord(d.lat, d.lng)}</div>
        </div>
        <span class="occ-badge" style="color:${m.hex};background:${m.hex}1a;border:1px solid ${m.hex}44">
          ${d.tier === 'major' ? 'PRIMARY' : 'SECONDARY'}
        </span>
      </div>
      <div class="sel-grid" style="margin-top:12px">
        <div class="sel-cell"><div class="k">Status</div><div class="v" style="font-size:var(--fs-base)">${d.status}</div></div>
        <div class="sel-cell"><div class="k">State</div><div class="v" style="font-size:var(--fs-base)">${d.state}</div></div>
        <div class="sel-cell"><div class="k">Record ID</div><div class="v t-mono" style="font-size:var(--fs-sm);color:var(--cyan)">${d.id}</div></div>
        <div class="sel-cell"><div class="k">Class</div><div class="v" style="font-size:var(--fs-base)">${m.cat || '—'}</div></div>
      </div>
      <div class="insp-sec">
        <div class="insp-sec-hd">Pending detail</div>
        <div class="insp-none">Grade, tonnage, assay history and drill collars arrive with the occurrence registry API.</div>
      </div>
      <div class="sel-actions">
        <button class="btn-ghost btn-primary" data-fly="${d.id}">Fly to site</button>
      </div>`;
  };

  /* ================= mount ================= */

  async function mount(view) {
    root = view;
    view.classList.add('view-flush');
    view.innerHTML = `
      <div class="explore">
        <aside class="ex-dock ex-left" id="ex-left">
          <div class="ex-dock-scroll">
            <section class="ex-panel">
              <header class="ex-panel-hd">${icon('layers', { size: 13 })}<h3>Layers</h3>
                <button class="ex-mini" id="ex-layers-reset" title="Reset layers">${icon('refresh', { size: 12 })}</button>
              </header>
              <div class="ex-panel-bd" id="layer-tree">${layerTree()}</div>
            </section>

            <section class="ex-panel">
              <header class="ex-panel-hd">${icon('minerals', { size: 13 })}<h3>Resources</h3></header>
              <div class="ex-panel-bd" id="res-filter">${resourceFilter()}</div>
            </section>

            <section class="ex-panel">
              <header class="ex-panel-hd">${icon('target', { size: 13 })}<h3>Drill Path</h3></header>
              <div class="ex-panel-bd" id="drill-nav">${drillNav()}</div>
            </section>
          </div>
          <button class="dock-tab dock-tab-l" id="tab-left" title="Collapse panel">${icon('chevronL', { size: 13 })}</button>
        </aside>

        <section class="ex-map" id="ex-map">
          <div id="map-canvas"></div>
          <div class="map-loading" id="map-loading">
            <div class="ml-in"><div class="ml-ring"></div><div class="ml-t">Initialising workspace</div></div>
          </div>

          <div class="ex-top">
            <div class="glass-bar">
              <div class="map-search" style="width:246px">
                <span class="s-icon">${icon('search', { size: 13 })}</span>
                <input type="text" id="map-loc-search" placeholder="Find state, LGA or occurrence" autocomplete="off"/>
              </div>
            </div>
            <div class="glass-bar" id="ex-quick">
              <button class="tool-btn" data-tool="reset" title="National extent">${icon('crosshair', { size: 15 })}</button>
              <button class="tool-btn" data-tool="in" title="Zoom in">${icon('plus', { size: 15 })}</button>
              <button class="tool-btn" data-tool="out" title="Zoom out">${icon('minus', { size: 15 })}</button>
              <div class="tool-sep-v"></div>
              <button class="tool-btn" data-tool="measure" title="Measure distance">${icon('ruler', { size: 15 })}</button>
              <button class="tool-btn" data-tool="full" title="Fullscreen">${icon('fullscreen', { size: 15 })}</button>
            </div>
            <div class="spacer"></div>
            <div class="seg" id="ex-basemap">
              <button data-base="vector" class="is-on">Vector</button>
              <button data-base="satellite">Satellite</button>
            </div>
          </div>

          <div class="ex-status glass-bar">
            <span class="exs" title="Cursor position">${icon('pin', { size: 11 })}<b id="exs-coord" class="t-mono">—</b></span>
            <span class="exs-sep"></span>
            <span class="exs">ZOOM <b id="exs-zoom" class="t-mono">6.1</b></span>
            <span class="exs-sep"></span>
            <span class="exs">LEVEL <b id="exs-band" class="t-mono">nation</b></span>
            <span class="exs-sep"></span>
            <span class="exs">SCALE <b id="exs-scale" class="t-mono">200 km</b></span>
            <span class="exs-sep"></span>
            <span class="exs" id="exs-measure" hidden>${icon('ruler', { size: 11 })}<b id="exs-dist" class="t-mono">0 km</b></span>
            <span class="exs exs-count">${icon('minerals', { size: 11 })}<b id="exs-visible" class="t-mono">64</b> sites</span>
          </div>
        </section>

        <aside class="ex-dock ex-right" id="ex-right">
          <div class="ex-dock-scroll">
            <section class="ex-panel">
              <header class="ex-panel-hd">${icon('info', { size: 13 })}<h3>Inspector</h3>
                <button class="ex-mini" id="insp-clear" title="Clear">${icon('crosshair', { size: 12 })}</button>
              </header>
              <div class="ex-panel-bd" id="inspector">${inspectorEmpty()}</div>
            </section>
          </div>
          <button class="dock-tab dock-tab-r" id="tab-right" title="Collapse panel">${icon('chevronR', { size: 13 })}</button>
        </aside>
      </div>`;

    deposits = await api.getDeposits();

    const stage = $('#ex-map', view);
    nmap = new NigeriaMap(stage, {
      api,
      onSelect: (props) => { renderInspector(props ? { kind: 'state', data: props } : null); renderDrill(); },
    });
    await nmap.init();
    $('#map-loading', view).classList.add('is-hidden');

    wireMap(stage);
    wireDocks(view);
    wireLayers(view);
    wireResources(view);
    wireInspector(view);

    unsub.push(store.subscribe('drill', renderDrill));
  }

  /* ================= wiring ================= */

  function wireMap(stage) {
    // live coordinate readout
    nmap.map.on('mousemove', (e) => {
      $('#exs-coord', root).textContent = fmt.coord(e.latlng.lat, e.latlng.lng);
      if (measuring && measurePts.length) previewMeasure(e.latlng);
    });
    nmap.map.on('mouseout', () => { $('#exs-coord', root).textContent = '—'; });

    stage.addEventListener('map:scale', (e) => {
      const { zoom, km, band } = e.detail;
      $('#exs-zoom', root).textContent = zoom.toFixed(1);
      $('#exs-band', root).textContent = band;
      $('#exs-scale', root).textContent = km >= 1 ? `${km} km` : '<1 km';
    });

    // occurrence markers feed the inspector
    nmap.depMarkers.forEach((m) => {
      m.on('click', () => renderInspector({ kind: 'deposit', data: m._dep }));
    });

    // Measurement claims clicks ahead of polygons via the map's interceptor,
    // so points can be dropped anywhere including on top of a state.
    function addMeasurePoint(latlng) {
      measurePts.push(latlng);
      const mk = L.circleMarker(latlng, {
        radius: 3.5, color: '#00e676', fillColor: '#00e676', fillOpacity: 1, weight: 2,
      }).addTo(nmap.map);
      measureMarks.push(mk);
      drawMeasure();
    }
    measureHook = addMeasurePoint;

    $('#ex-quick', root).addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tool]');
      if (!b) return;
      const t = b.dataset.tool;
      if (t === 'in') nmap.zoomBy(0.6);
      if (t === 'out') nmap.zoomBy(-0.6);
      if (t === 'reset') { nmap.resetView(); clearMeasure(); }
      if (t === 'measure') toggleMeasure(b);
      if (t === 'full') {
        if (!document.fullscreenElement) $('#ex-map', root).requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    });

    const fullBtn = $('[data-tool="full"]', root);
    const syncFs = () => {
      const on = document.fullscreenElement === $('#ex-map', root);
      fullBtn.classList.toggle('is-on', on);
      setTimeout(() => nmap.invalidate(), 60);
    };
    document.addEventListener('fullscreenchange', syncFs);
    unsub.push(() => document.removeEventListener('fullscreenchange', syncFs));

    $('#ex-basemap', root).addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-base]');
      if (!b) return;
      $$('#ex-basemap button', root).forEach((n) => n.classList.toggle('is-on', n === b));
      nmap.setBasemap(b.dataset.base);
    });

    const input = $('#map-loc-search', root);
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const q = input.value.trim().toLowerCase();
      if (!q) return;
      const hit = [...nmap.stateLayers.keys()].find((n) => n.toLowerCase().includes(q));
      if (hit) { nmap.selectState(hit, { zoom: true }); input.blur(); return; }
      const dep = deposits.find((d) => d.name.toLowerCase().includes(q));
      if (dep) {
        nmap.map.flyTo([dep.lat, dep.lng], 10, { duration: 1 });
        renderInspector({ kind: 'deposit', data: dep });
        input.blur();
      } else toast(`No match for "${input.value}"`);
    });
  }

  /* ---- measurement tool ---- */
  function toggleMeasure(btn) {
    measuring = !measuring;
    nmap.interceptClicks = measuring ? measureHook : null;
    btn.classList.toggle('is-on', measuring);
    $('#ex-map', root).classList.toggle('is-measuring', measuring);
    $('#exs-measure', root).hidden = !measuring;
    if (!measuring) { clearMeasure(); nmap.interceptClicks = null; }
    else toast('Click points on the map to measure · click the tool again to finish');
  }

  function drawMeasure() {
    if (measureLine) nmap.map.removeLayer(measureLine);
    if (measurePts.length < 2) return;
    measureLine = L.polyline(measurePts, {
      color: '#00e676', weight: 2, dashArray: '5,4', opacity: .9,
    }).addTo(nmap.map);
    let total = 0;
    for (let i = 1; i < measurePts.length; i++) total += measurePts[i - 1].distanceTo(measurePts[i]);
    $('#exs-dist', root).textContent = total >= 1000
      ? `${(total / 1000).toFixed(1)} km` : `${Math.round(total)} m`;
  }

  function previewMeasure(latlng) {
    const pts = [...measurePts, latlng];
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += pts[i - 1].distanceTo(pts[i]);
    $('#exs-dist', root).textContent = total >= 1000
      ? `${(total / 1000).toFixed(1)} km` : `${Math.round(total)} m`;
  }

  function clearMeasure() {
    measurePts = [];
    if (measureLine) { nmap.map.removeLayer(measureLine); measureLine = null; }
    measureMarks.forEach((m) => nmap.map.removeLayer(m));
    measureMarks = [];
    $('#exs-dist', root).textContent = '0 km';
  }

  /* ---- docks ---- */
  function wireDocks(view) {
    $('#tab-left', view).addEventListener('click', () => {
      const d = $('#ex-left', view);
      d.classList.toggle('is-collapsed');
      setTimeout(() => nmap.invalidate(), 260);
    });
    $('#tab-right', view).addEventListener('click', () => {
      const d = $('#ex-right', view);
      d.classList.toggle('is-collapsed');
      setTimeout(() => nmap.invalidate(), 260);
    });
  }

  /* ---- layer tree ---- */
  function wireLayers(view) {
    $('#layer-tree', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-layer]');
      if (!b) return;
      const id = b.dataset.layer;

      if (b.classList.contains('is-soon')) {
        toast(`${b.querySelector('.lt-label').textContent} arrives with the GIS data service`);
        return;
      }

      // Read the DOM as the single source of truth, then flip it.
      const next = !b.classList.contains('is-on');
      b.classList.toggle('is-on', next);
      b.setAttribute('aria-checked', String(next));

      if (id === 'labels') nmap.setLabels(next);
      else if (id === 'lgas') {
        const st = store.get('selectedState');
        if (!st) { toast('Select a state first'); b.classList.remove('is-on'); return; }
        if (next) nmap.showLgas(st.code, { explicit: true });
        else nmap.hideLgas();
      } else nmap.toggleLayer(id, next);
    });

    $('#ex-layers-reset', view).addEventListener('click', () => {
      $$('#layer-tree .lt-item', view).forEach((b) => {
        if (b.classList.contains('is-soon')) return;
        const id = b.dataset.layer;
        const on = id !== 'lgas';
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
        if (id === 'labels') nmap.setLabels(on);
        else if (id === 'lgas') nmap.hideLgas();
        else nmap.toggleLayer(id, on);
      });
      toast('Layers reset');
    });
  }

  /* ---- resource filter ---- */
  function wireResources(view) {
    const apply = () => {
      const on = $$('#res-filter .ex-chip.is-on', view).map((c) => c.dataset.res);
      nmap.filterResources(on);
      const visible = deposits.filter((d) => on.includes(d.resource)).length;
      $('#exs-visible', view).textContent = visible;
    };
    $('#res-filter', view).addEventListener('click', (e) => {
      const chip = e.target.closest('[data-res]');
      if (chip) { chip.classList.toggle('is-on'); apply(); return; }
      if (e.target.closest('[data-res-all]')) {
        $$('#res-filter .ex-chip', view).forEach((c) => c.classList.add('is-on')); apply(); return;
      }
      if (e.target.closest('[data-res-none]')) {
        $$('#res-filter .ex-chip', view).forEach((c) => c.classList.remove('is-on')); apply();
      }
    });
  }

  /* ---- inspector ---- */
  function wireInspector(view) {
    $('#inspector', view).addEventListener('click', (e) => {
      const fly = e.target.closest('[data-fly]')?.dataset.fly;
      if (fly) {
        const d = deposits.find((x) => x.id === fly);
        if (d) { nmap.map.flyTo([d.lat, d.lng], 10.5, { duration: .9 }); renderInspector({ kind: 'deposit', data: d }); }
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      const st = store.get('selectedState');
      if (act === 'drill-lga' && st) {
        nmap.showLgas(st.code, { explicit: true }).then(() => {
          const n = nmap.layers.lgas?.getLayers().length || 0;
          const btn = $('[data-layer="lgas"]', view);
          btn?.classList.add('is-on');
          toast(`${st.name}: ${n} LGAs loaded`);
        });
        const layer = nmap.stateLayers.get(st.name);
        if (layer) nmap.map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 9.2, duration: .9 });
      }
      if (act === 'zoom-state' && st) {
        const layer = nmap.stateLayers.get(st.name);
        if (layer) nmap.map.flyToBounds(layer.getBounds(), { padding: [40, 40], duration: .8 });
      }
    });
    $('#insp-clear', view).addEventListener('click', () => { nmap.clearSelection(); renderInspector(null); });
  }

  /* ================= renderers ================= */

  function renderInspector(sel) {
    const el = $('#inspector', root);
    if (!el) return;
    if (!sel) { el.innerHTML = inspectorEmpty(); return; }
    el.innerHTML = sel.kind === 'state' ? inspectorState(sel.data) : inspectorDeposit(sel.data);
  }

  function renderDrill() {
    const el = $('#drill-nav', root);
    if (el) el.innerHTML = drillNav();
  }

  return {
    mount,
    onShow() { requestAnimationFrame(() => nmap?.invalidate()); },
    onHide() {
      if (measuring) {
        measuring = false;
        nmap.interceptClicks = null;
        clearMeasure();
        $('[data-tool="measure"]', root)?.classList.remove('is-on');
        $('#ex-map', root)?.classList.remove('is-measuring');
        $('#exs-measure', root).hidden = true;
      }
    },
    destroy() { unsub.forEach((f) => f()); nmap?.destroy(); },
  };
}
