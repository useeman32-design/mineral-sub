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
import { DrawEngine, TOOL_META } from '../components/draw.js';
import { History } from '../core/history.js';
import { projects } from '../data/projects.js';
import { measureShape } from '../core/geo.js';
import { loadPrefs } from './settings.js';

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
  let draw, history, activeProject = null, dirty = false;
  let inspectorMode = 'geo';   // 'geo' | 'shape'
  let lastGeo = null;          // remembers the geographic selection

  /* ================= helpers ================= */

  const units = () => loadPrefs().units;
  const escapeHtml = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeAttr = (v) => escapeHtml(v).replace(/"/g, '&quot;');

  function relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
    if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
    return new Date(ts).toLocaleDateString();
  }

  /** Collapsible dock panel. Open/closed state persists per panel. */
  const PANEL_KEY = 'nmi.exPanels';
  function panelState() {
    try { return JSON.parse(localStorage.getItem(PANEL_KEY) || '{}'); } catch { return {}; }
  }
  function setPanelState(id, open) {
    const st = panelState(); st[id] = open;
    localStorage.setItem(PANEL_KEY, JSON.stringify(st));
  }
  function panel(id, title, ico, body, actions = '') {
    const open = panelState()[id] !== false;
    return `
      <section class="ex-panel ${open ? '' : 'is-closed'}" data-panel="${id}">
        <header class="ex-panel-hd" data-panel-toggle="${id}">
          ${icon(ico, { size: 13 })}<h3>${title}</h3>
          ${actions}
          <span class="ex-caret">${icon('chevron', { size: 12 })}</span>
        </header>
        <div class="ex-panel-bd">${body}</div>
      </section>`;
  }

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

  const measureTools = () => `
    <div class="mt-grid">
      ${Object.entries(TOOL_META).map(([k, m]) => `
        <button class="mt-btn" data-tool-draw="${k}" style="--tc:${m.color}" title="${m.hint}">
          ${icon(k === 'line' ? 'ruler' : k === 'polygon' ? 'grid' : k === 'circle' ? 'target' : 'pin', { size: 15 })}
          <span>${m.label}</span>
        </button>`).join('')}
    </div>
    <div class="mt-hint" id="mt-hint">Select a tool to begin measuring</div>
    <div class="row gap-6" style="margin-top:8px">
      <button class="btn-ghost" id="undo-btn" disabled style="height:26px;font-size:9px">
        ${icon('refresh', { size: 11 })} Undo</button>
      <button class="btn-ghost" id="redo-btn" disabled style="height:26px;font-size:9px">
        Redo ${icon('refresh', { size: 11 })}</button>
    </div>`;

  const shapeList = () => {
    const list = draw?.shapes || [];
    if (!list.length) return '<div class="insp-none">No measurements yet. Pick a tool above and click the map.</div>';
    return `<div class="shp-list">
      ${list.map((sh) => {
        const m = measureShape(sh, units());
        return `<div class="shp-row ${draw.selectedId === sh.id ? 'is-on' : ''}" data-shape="${sh.id}">
          <i class="shp-dot" style="background:${sh.color};box-shadow:0 0 6px ${sh.color}"></i>
          <span class="shp-body">
            <span class="shp-n">${sh.label}</span>
            <span class="shp-m">${m.primary}</span>
          </span>
          <button class="shp-x" data-del="${sh.id}" title="Delete">${icon('minus', { size: 11 })}</button>
        </div>`;
      }).join('')}
    </div>
    <div class="row gap-6" style="margin-top:8px">
      <button class="btn-ghost" id="clear-shapes" style="height:26px;font-size:9px">Clear all</button>
    </div>`;
  };

  const projectPanel = () => {
    const list = projects.list();
    return `
      <div class="prj-active">
        <div class="prj-active-t">
          <span class="t-label">Current study</span>
          <span class="prj-dirty ${dirty ? 'is-on' : ''}" title="Unsaved changes"></span>
        </div>
        <input class="prj-name" id="prj-name" value="${activeProject ? escapeAttr(activeProject.name) : ''}"
               placeholder="Untitled study" autocomplete="off"/>
        <div class="row gap-6" style="margin-top:7px">
          <button class="btn-ghost btn-primary" id="prj-save" style="height:27px;font-size:9px">
            ${icon('download', { size: 11 })} Save</button>
          <button class="btn-ghost" id="prj-new" style="height:27px;font-size:9px">New</button>
        </div>
      </div>
      <div class="insp-sec" style="margin-top:11px">
        <div class="insp-sec-hd">Saved studies <span>${list.length}</span></div>
        ${list.length ? `<div class="prj-list">
          ${list.map((p) => {
            const st = projects.stats(p);
            const n = (p.shapes || []).length;
            return `<div class="prj-row ${activeProject?.id === p.id ? 'is-on' : ''}" data-prj="${p.id}">
              <button class="prj-open" data-open="${p.id}">
                <span class="prj-n">${escapeHtml(p.name)}</span>
                <span class="prj-meta">${n} item${n === 1 ? '' : 's'} · ${relTime(p.updated)}</span>
              </button>
              <span class="prj-acts">
                <button class="prj-a" data-export="${p.id}" title="Export JSON">${icon('download', { size: 11 })}</button>
                <button class="prj-a prj-del" data-delete="${p.id}" title="Delete">${icon('minus', { size: 11 })}</button>
              </span>
            </div>`;
          }).join('')}
        </div>` : '<div class="insp-none">No saved studies yet. Measure something, then hit Save.</div>'}
      </div>`;
  };

  const shapeInspector = (sh) => {
    const m = measureShape(sh, units());
    return `
      <div class="insp-head">
        <div>
          <div class="insp-kind" style="color:${sh.color}">${TOOL_META[sh.type].label} measurement</div>
          <input class="insp-rename" id="shape-name" value="${escapeAttr(sh.label)}" autocomplete="off"/>
        </div>
        <span class="occ-badge" style="color:${sh.color};background:${sh.color}1a;border:1px solid ${sh.color}44">
          ${sh.type.toUpperCase()}
        </span>
      </div>

      <div class="msr-hero" style="--mc:${sh.color}">
        <span class="msr-k">${m.primaryLabel}</span>
        <span class="msr-v">${m.primary}</span>
      </div>

      <div class="msr-rows">
        ${m.rows.map(([k, v]) => `<div class="msr-row"><span>${k}</span><b>${v}</b></div>`).join('')}
      </div>

      <div class="insp-sec">
        <div class="insp-sec-hd">Vertices <span>${sh.latlngs.length}</span></div>
        <div class="vtx-list">
          ${sh.latlngs.slice(0, 6).map((p, i) => `
            <div class="vtx"><span>${i + 1}</span><b class="t-mono">${fmt.coord(p[0], p[1])}</b></div>`).join('')}
          ${sh.latlngs.length > 6 ? `<div class="occ-more">+${sh.latlngs.length - 6} more</div>` : ''}
        </div>
      </div>

      <div class="insp-sec">
        <div class="insp-sec-hd">Note</div>
        <textarea class="insp-note" id="shape-note" rows="2"
          placeholder="Add context for this measurement…">${escapeHtml(sh.note || '')}</textarea>
      </div>

      <div class="sel-actions">
        <button class="btn-ghost btn-primary" data-shape-zoom="${sh.id}">Zoom to</button>
        <button class="btn-ghost" data-shape-del="${sh.id}">Delete</button>
      </div>`;
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
            ${panel('layers', 'Layers', 'layers', `<div id="layer-tree">${layerTree()}</div>`,
                    `<button class="ex-mini" id="ex-layers-reset" title="Reset layers">${icon('refresh', { size: 12 })}</button>`)}
            ${panel('resources', 'Resources', 'minerals', `<div id="res-filter">${resourceFilter()}</div>`)}
            ${panel('drill', 'Drill Path', 'target', `<div id="drill-nav">${drillNav()}</div>`)}
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
              <div class="map-search" style="width:232px">
                <span class="s-icon">${icon('search', { size: 13 })}</span>
                <input type="text" id="map-loc-search" placeholder="Find state, LGA or occurrence" autocomplete="off"/>
              </div>
            </div>
            <div class="glass-bar" id="ex-quick">
              <button class="tool-btn" data-tool="reset" title="National extent">${icon('crosshair', { size: 15 })}</button>
              <button class="tool-btn" data-tool="in" title="Zoom in">${icon('plus', { size: 15 })}</button>
              <button class="tool-btn" data-tool="out" title="Zoom out">${icon('minus', { size: 15 })}</button>
              <div class="tool-sep-v"></div>
              <button class="tool-btn" data-hist="undo" title="Undo (Ctrl+Z)" disabled>${icon('chevronL', { size: 15 })}</button>
              <button class="tool-btn" data-hist="redo" title="Redo (Ctrl+Shift+Z)" disabled>${icon('chevronR', { size: 15 })}</button>
              <div class="tool-sep-v"></div>
              <button class="tool-btn" data-tool="full" title="Fullscreen">${icon('fullscreen', { size: 15 })}</button>
            </div>
            <div class="spacer"></div>
            <div class="seg" id="ex-basemap">
              <button data-base="vector" class="is-on">Vector</button>
              <button data-base="satellite">Satellite</button>
            </div>
          </div>

          <div class="draw-banner" id="draw-banner" hidden>
            <span class="db-dot"></span>
            <b id="db-tool">Distance</b>
            <span id="db-hint">Click points on the map</span>
            <button class="db-btn" id="db-finish">Finish</button>
            <button class="db-btn db-x" id="db-cancel">Esc</button>
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
            <span class="exs exs-count">${icon('minerals', { size: 11 })}<b id="exs-visible" class="t-mono">64</b> sites</span>
          </div>
        </section>

        <aside class="ex-dock ex-right" id="ex-right">
          <div class="ex-dock-scroll">
            ${panel('measure', 'Measure & Draw', 'ruler', `<div id="measure-tools">${measureTools()}</div>`)}
            ${panel('shapes', 'Measurements', 'grid', `<div id="shape-list">${shapeList()}</div>`)}
            ${panel('inspector', 'Inspector', 'info', `
              <div class="insp-tabs" id="insp-tabs">
                <button data-itab="geo" class="is-on">Geography</button>
                <button data-itab="shape">Measurement</button>
              </div>
              <div id="inspector">${inspectorEmpty()}</div>`,
              `<button class="ex-mini" id="insp-clear" title="Clear">${icon('crosshair', { size: 12 })}</button>`)}
            ${panel('projects', 'Saved Work', 'data', `<div id="prj-panel">${projectPanel()}</div>`)}
          </div>
          <button class="dock-tab dock-tab-r" id="tab-right" title="Collapse panel">${icon('chevronR', { size: 13 })}</button>
        </aside>
      </div>`;

    deposits = await api.getDeposits();

    const stage = $('#ex-map', view);
    nmap = new NigeriaMap(stage, {
      api,
      onSelect: (props) => {
        lastGeo = props ? { kind: 'state', data: props } : null;
        if (inspectorMode === 'geo') renderInspector();
        renderDrill();
      },
    });
    await nmap.init();
    $('#map-loading', view).classList.add('is-hidden');

    // --- drawing / measurement ---
    history = new History({ onChange: renderHistoryButtons });
    draw = new DrawEngine(nmap, {
      getUnits: units,
      onChange: (shapes, label) => {
        history.push(shapes, label);
        markDirty(true);
        renderShapeList();
      },
      onSelect: (shape) => {
        if (shape) { inspectorMode = 'shape'; setInspectorTab('shape'); }
        renderInspector();
        renderShapeList();
      },
      onDraft: renderDrawBanner,
    });
    history.reset([], 'Empty');

    wireMap(stage);
    wireDocks(view);
    wirePanels(view);
    wireLayers(view);
    wireResources(view);
    wireInspector(view);
    wireDrawTools(view);
    wireProjects(view);
    wireKeyboard();

    unsub.push(store.subscribe('drill', renderDrill));
  }

  /* ================= wiring ================= */

  function wireMap(stage) {
    // live coordinate readout
    nmap.map.on('mousemove', (e) => {
      $('#exs-coord', root).textContent = fmt.coord(e.latlng.lat, e.latlng.lng);
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
      m.on('click', () => {
        if (draw?.tool) return;              // drawing owns the click
        lastGeo = { kind: 'deposit', data: m._dep };
        setInspectorTab('geo');
        renderInspector();
      });
    });

    $('#ex-quick', root).addEventListener('click', (ev) => {
      const h = ev.target.closest('[data-hist]');
      if (h) { h.dataset.hist === 'undo' ? doUndo() : doRedo(); return; }
      const b = ev.target.closest('[data-tool]');
      if (!b) return;
      const t = b.dataset.tool;
      if (t === 'in') nmap.zoomBy(0.6);
      if (t === 'out') nmap.zoomBy(-0.6);
      if (t === 'reset') nmap.resetView();
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
        lastGeo = { kind: 'deposit', data: dep };
        setInspectorTab('geo'); renderInspector();
        input.blur();
      } else toast(`No match for "${input.value}"`);
    });
  }





  /* ---- collapsible panels ---- */
  function wirePanels(view) {
    view.addEventListener('click', (e) => {
      const hd = e.target.closest('[data-panel-toggle]');
      if (!hd || e.target.closest('.ex-mini')) return;
      const sec = hd.closest('.ex-panel');
      const closed = sec.classList.toggle('is-closed');
      setPanelState(hd.dataset.panelToggle, !closed);
    });
  }

  /* ---- draw / measure tools ---- */
  function wireDrawTools(view) {
    $('#measure-tools', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-tool-draw]');
      if (b) {
        const t = b.dataset.toolDraw;
        draw.setTool(draw.tool === t ? null : t);
        syncToolButtons();
        return;
      }
      if (e.target.closest('#undo-btn')) doUndo();
      if (e.target.closest('#redo-btn')) doRedo();
    });

    $('#shape-list', view).addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { draw.remove(del.dataset.del); return; }
      if (e.target.closest('#clear-shapes')) {
        if (draw.shapes.length) draw.clearAll();
        return;
      }
      const row = e.target.closest('[data-shape]');
      if (row) { draw.select(row.dataset.shape); draw.zoomTo(row.dataset.shape); }
    });

    const banner = $('#draw-banner', view);
    banner.addEventListener('click', (e) => {
      if (e.target.closest('#db-finish')) draw.commitDraft();
      if (e.target.closest('#db-cancel')) { draw.setTool(null); syncToolButtons(); }
    });
  }

  function syncToolButtons() {
    $$('[data-tool-draw]', root).forEach((b) =>
      b.classList.toggle('is-on', draw.tool === b.dataset.toolDraw));
    const hint = $('#mt-hint', root);
    if (hint) {
      hint.textContent = draw.tool
        ? TOOL_META[draw.tool].hint
        : 'Select a tool to begin measuring';
      hint.classList.toggle('is-live', !!draw.tool);
    }
  }

  function renderDrawBanner(info) {
    const b = $('#draw-banner', root);
    if (!b) return;
    if (!info) { b.hidden = true; return; }
    b.hidden = false;
    $('#db-tool', b).textContent = TOOL_META[info.tool].label;
    $('#db-hint', b).textContent = info.pts
      ? `${info.pts} point${info.pts === 1 ? '' : 's'} · ${info.hint}`
      : info.hint;
  }

  /* ---- history ---- */
  function doUndo() {
    const st = history.undo();
    if (!st) return;
    draw.setShapes(st);
    renderShapeList(); renderInspector(); markDirty(true);
    toast(`Undo${history.redoLabel ? ` · ${history.redoLabel}` : ''}`);
  }
  function doRedo() {
    const st = history.redo();
    if (!st) return;
    draw.setShapes(st);
    renderShapeList(); renderInspector(); markDirty(true);
    toast('Redo');
  }
  function renderHistoryButtons(status) {
    [['undo', status.canUndo], ['redo', status.canRedo]].forEach(([k, on]) => {
      const a = $(`[data-hist="${k}"]`, root);
      const b = $(`#${k}-btn`, root);
      if (a) a.disabled = !on;
      if (b) b.disabled = !on;
    });
  }

  function wireKeyboard() {
    const onKey = (e) => {
      if (store.get('route') && location.hash.replace(/^#\/?/, '') !== 'explore') return;
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); doRedo(); return; }
      if (mod && e.key.toLowerCase() === 's' && !typing) { e.preventDefault(); saveProject(); return; }
      if (typing) return;

      if (e.key === 'Escape') {
        if (draw.draft.length) draw.cancelDraft();
        else if (draw.tool) { draw.setTool(null); syncToolButtons(); }
        return;
      }
      if (e.key === 'Enter' && draw.draft.length) { e.preventDefault(); draw.commitDraft(); return; }
      if (e.key === 'Delete' && draw.selectedId) { draw.remove(draw.selectedId); return; }

      const map = { m: 'line', a: 'polygon', r: 'circle', p: 'point' };
      if (map[e.key.toLowerCase()]) {
        draw.setTool(draw.tool === map[e.key.toLowerCase()] ? null : map[e.key.toLowerCase()]);
        syncToolButtons();
      }
    };
    addEventListener('keydown', onKey);
    unsub.push(() => removeEventListener('keydown', onKey));
  }

  /* ---- projects ---- */
  function markDirty(v) {
    dirty = v;
    const d = $('.prj-dirty', root);
    if (d) d.classList.toggle('is-on', v);
  }

  function saveProject() {
    const nameEl = $('#prj-name', root);
    const name = (nameEl?.value || '').trim() || `Untitled study ${projects.list().length + 1}`;
    const payload = {
      name,
      shapes: draw.shapes,
      view: nmap.getView(),
      layers: { ...store.get('layers') },
    };
    if (activeProject) {
      activeProject = projects.update(activeProject.id, payload);
      toast(`Saved "${name}"`);
    } else {
      activeProject = projects.create(payload);
      toast(`Created "${name}"`);
    }
    markDirty(false);
    renderProjects();
  }

  function openProject(id) {
    const p = projects.get(id);
    if (!p) return;
    activeProject = p;
    history.mute(() => draw.setShapes(p.shapes || []));
    history.reset(p.shapes || [], 'Opened');
    if (p.view) nmap.setView(p.view);
    renderShapeList(); renderInspector(); renderProjects();
    markDirty(false);
    toast(`Opened "${p.name}" · ${(p.shapes || []).length} items`);
  }

  function newProject() {
    activeProject = null;
    history.mute(() => draw.setShapes([]));
    history.reset([], 'New study');
    renderShapeList(); renderInspector(); renderProjects();
    markDirty(false);
    toast('Started a new study');
  }

  function wireProjects(view) {
    const panelEl = $('#prj-panel', view);
    panelEl.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (open) { openProject(open.dataset.open); return; }
      const del = e.target.closest('[data-delete]');
      if (del) {
        const p = projects.get(del.dataset.delete);
        projects.remove(del.dataset.delete);
        if (activeProject?.id === del.dataset.delete) activeProject = null;
        renderProjects();
        toast(`Deleted "${p?.name || 'study'}"`);
        return;
      }
      const exp = e.target.closest('[data-export]');
      if (exp) { projects.export(exp.dataset.export); toast('Exported JSON'); return; }
      if (e.target.closest('#prj-save')) saveProject();
      if (e.target.closest('#prj-new')) newProject();
    });
    panelEl.addEventListener('input', (e) => {
      if (e.target.id === 'prj-name') markDirty(true);
    });
  }

  function renderProjects() {
    const el = $('#prj-panel', root);
    if (el) el.innerHTML = projectPanel();
  }

  function renderShapeList() {
    const el = $('#shape-list', root);
    if (el) el.innerHTML = shapeList();
  }

  function setInspectorTab(mode) {
    inspectorMode = mode;
    $$('#insp-tabs button', root).forEach((b) =>
      b.classList.toggle('is-on', b.dataset.itab === mode));
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
    $('#insp-tabs', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-itab]');
      if (!b) return;
      setInspectorTab(b.dataset.itab);
      renderInspector();
    });

    const insp = $('#inspector', view);

    insp.addEventListener('click', (e) => {
      const fly = e.target.closest('[data-fly]')?.dataset.fly;
      if (fly) {
        const d = deposits.find((x) => x.id === fly);
        if (d) {
          nmap.map.flyTo([d.lat, d.lng], 10.5, { duration: .9 });
          lastGeo = { kind: 'deposit', data: d };
          setInspectorTab('geo'); renderInspector();
        }
        return;
      }
      const z = e.target.closest('[data-shape-zoom]');
      if (z) { draw.zoomTo(z.dataset.shapeZoom); return; }
      const del = e.target.closest('[data-shape-del]');
      if (del) { draw.remove(del.dataset.shapeDel); return; }

      const act = e.target.closest('[data-act]')?.dataset.act;
      const st = store.get('selectedState');
      if (act === 'drill-lga' && st) {
        nmap.showLgas(st.code, { explicit: true }).then(() => {
          const n = nmap.layers.lgas?.getLayers().length || 0;
          $('[data-layer="lgas"]', view)?.classList.add('is-on');
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

    // live rename + note editing on the selected measurement
    insp.addEventListener('input', (e) => {
      if (e.target.id === 'shape-name' && draw.selectedId) {
        const sh = draw.shapes.find((x) => x.id === draw.selectedId);
        if (sh) { sh.label = e.target.value; draw.render(); renderShapeList(); markDirty(true); }
      }
    });
    insp.addEventListener('change', (e) => {
      if (e.target.id === 'shape-name' && draw.selectedId) draw.rename(draw.selectedId, e.target.value);
      if (e.target.id === 'shape-note' && draw.selectedId) draw.setNote(draw.selectedId, e.target.value);
    });

    $('#insp-clear', view).addEventListener('click', () => {
      if (inspectorMode === 'shape') draw.clearSelection();
      else { nmap.clearSelection(); lastGeo = null; }
      renderInspector();
    });
  }

  /* ================= renderers ================= */

  function renderInspector() {
    const el = $('#inspector', root);
    if (!el) return;

    if (inspectorMode === 'shape') {
      const sh = draw?.shapes.find((x) => x.id === draw.selectedId);
      el.innerHTML = sh ? shapeInspector(sh) : `
        <div class="empty-sel" style="padding:22px 12px">
          <span class="es-ico">${icon('ruler', { size: 26 })}</span>
          <p class="es-t">Select a measurement to see its length, radius,<br/>area in m² and vertex list.</p>
        </div>`;
      return;
    }

    if (!lastGeo) { el.innerHTML = inspectorEmpty(); return; }
    el.innerHTML = lastGeo.kind === 'state'
      ? inspectorState(lastGeo.data)
      : inspectorDeposit(lastGeo.data);
  }

  function renderDrill() {
    const el = $('#drill-nav', root);
    if (el) el.innerHTML = drillNav();
  }

  return {
    mount,
    onShow() { requestAnimationFrame(() => nmap?.invalidate()); },
    onHide() { draw?.setTool(null); syncToolButtons(); },
    destroy() { unsub.forEach((f) => f()); draw?.destroy(); nmap?.destroy(); },
  };
}
