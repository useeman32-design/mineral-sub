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

import { api } from '../data/api.js?v=db4eb0f';
import { store } from '../core/store.js?v=db4eb0f';
import { ctx } from '../core/context.js?v=db4eb0f';
import { icon } from '../core/icons.js?v=db4eb0f';
import { $, $$, fmt, sparkline, ring } from '../core/utils.js?v=db4eb0f';
import { NigeriaMap, zoomBand } from '../components/map.js?v=db4eb0f';
import { RESOURCE_META } from '../data/fixtures.js?v=db4eb0f';
import { toast } from './dashboard.js?v=db4eb0f';
import { reports } from '../core/reports.js?v=db4eb0f';
import { DrawEngine, TOOL_META } from '../components/draw.js?v=db4eb0f';
import { History } from '../core/history.js?v=db4eb0f';
import { projects } from '../data/projects.js?v=db4eb0f';
import { measureShape } from '../core/geo.js?v=db4eb0f';
import { loadPrefs } from './settings.js?v=db4eb0f';
import { LAYER_GROUPS, LAYER_INDEX, applyLayer } from '../data/layers.js?v=db4eb0f';
import { dsToggles, DATASET_LAYER } from '../data/toggles.js?v=db4eb0f';
import { createLegend, LEGEND_RESOURCES } from '../components/legend.js?v=db4eb0f';
import { createStatusBar } from '../components/statusbar.js?v=db4eb0f';
import { makeDraggable, makeDockResizer } from '../components/draggable.js?v=db4eb0f';

const RESOURCES = LEGEND_RESOURCES;


export function createExplore() {
  let root, nmap, deposits = [], unsub = [];
  let draw, history, activeProject = null, dirty = false;
  let inspectorMode = 'geo';   // 'geo' | 'shape'
  let lastGeo = null;
  let lastCtxStamp = 0;          // remembers the geographic selection
  let legend = null, statusBar = null, setDockRef = null, lastCursor = null;

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

  const layerTree = () => {
    const st = store.get('layers');
    return LAYER_GROUPS.map((g) => `
      <div class="lt-group">
        <div class="lt-group-hd">${g.group}</div>
        ${g.items.map((it) => {
          const on = it.soon ? false : (st[it.id] ?? it.def);
          return `<button class="lt-item ${on ? 'is-on' : ''} ${it.soon ? 'is-soon' : ''}"
                  data-layer="${it.id}" role="switch" aria-checked="${on}">
            <span class="lt-eye">${icon('eye', { size: 13 })}</span>
            <i class="lt-swatch" style="background:${it.color};box-shadow:0 0 6px ${it.color}"></i>
            <span class="lt-label">${it.label}</span>
            ${it.soon ? '<span class="lt-tag">SOON</span>'
                      : it.hint ? `<span class="lt-hint" title="${it.hint}">${icon('info', { size: 11 })}</span>` : ''}
          </button>`;
        }).join('')}
      </div>`).join('');
  };

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
      { k: 'nation', label: 'Nigeria', sub: '36 states + FCT', done: true },
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
    <div class="mt-actions">
      <button class="act-btn" id="undo-btn" disabled title="Undo (Ctrl+Z)">
        ${icon('undo', { size: 13 })}<span>Undo</span></button>
      <button class="act-btn" id="redo-btn" disabled title="Redo (Ctrl+Shift+Z)">
        ${icon('redo', { size: 13 })}<span>Redo</span></button>
      <button class="act-btn act-primary" id="mt-save" title="Save study (Ctrl+S)">
        ${icon('save', { size: 13 })}<span>Save</span></button>
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
          <span class="shp-acts">
            <button class="shp-a" data-copy="${sh.id}" title="Copy (Ctrl+C)">${icon('copy', { size: 11 })}</button>
            <button class="shp-a shp-del" data-del="${sh.id}" title="Delete">${icon('trash', { size: 11 })}</button>
          </span>
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

  const inspectorLga = (p) => {
    const local = deposits.filter((d) => d.state === p.state);
    return `
      <div class="insp-head">
        <div>
          <div class="insp-kind" style="color:var(--cyan)">Local Government · ADM2</div>
          <div class="insp-title">${p.name}</div>
          <div class="insp-sub">${p.state} State · ${fmt.coord(p.centroid[0], p.centroid[1])}</div>
        </div>
        <span class="occ-badge" style="color:var(--cyan);background:rgba(45,216,195,.1);border:1px solid rgba(45,216,195,.3)">LGA</span>
      </div>
      <div class="insp-sec" style="margin-top:11px;padding-top:0;border:0">
        <div class="insp-none">
          LGA-level occurrence counts, titles and prospectivity scores arrive with
          the ADM2 data service. State context is shown below.
        </div>
      </div>
      <div class="insp-sec">
        <div class="insp-sec-hd">${p.state} occurrences <span>${local.length}</span></div>
        ${local.length ? `<div class="occ-list">
          ${local.slice(0, 6).map((d) => {
            const m = RESOURCE_META[d.resource] || {};
            return `<button class="occ-row" data-fly="${d.id}">
              <i style="background:${m.hex};box-shadow:0 0 6px ${m.hex}"></i>
              <span class="occ-n">${d.name}</span>
              <span class="occ-s">${d.status}</span>
            </button>`;
          }).join('')}
        </div>` : '<div class="insp-none">No catalogued occurrences.</div>'}
      </div>
      <div class="sel-actions">
        <button class="btn-ghost btn-primary" data-lga-zoom="1">Zoom to LGA</button>
        <button class="btn-ghost" data-act="back-state">Back to state</button>
      </div>
      <div class="ctx-acts ctx-acts-insp">
        <button class="btn-ghost" data-send="minerals" data-st="${p.state}" data-lga="${p.name}">
          ${icon('minerals', { size: 12 })} Minerals</button>
        <button class="btn-ghost" data-report-place data-st="${p.state}" data-lga="${p.name}">
          ${icon('reports', { size: 12 })} Report</button>
        <button class="btn-ghost" data-send="prospectivity" data-st="${p.state}" data-lga="${p.name}">
          ${icon('prospectivity', { size: 12 })} Prospectivity</button>
        <button class="btn-ghost" data-send="risk" data-st="${p.state}" data-lga="${p.name}">
          ${icon('risk', { size: 12 })} Risk</button>
      </div>`;
  };

  /**
   * A clicked cadastre block. The hover tooltip is a glance; this is the
   * full record, in the Inspector where every other selection already lands.
   */
  const inspectorTitle = (t) => {
    const TYPE_COLOR = {
      'Exploration License': '#8b7dff',
      'Small Scale Mining Lease': '#2dd8c3',
      'Quarry Lease': '#f5b942',
      'Mining Lease': '#ff4d5e',
      'Water Use Permit': '#4d9dff',
    };
    const c = TYPE_COLOR[t.type] || '#8b7dff';
    const minerals = (t.minerals || '').split(',').map((m) => m.trim()).filter(Boolean);
    return `
      <div class="insp-head">
        <div>
          <div class="insp-kind" style="color:${c}">${t.type || 'Mineral title'}</div>
          <div class="insp-title t-mono">${t.lic}</div>
          <div class="insp-sub">${t.lga ? t.lga + ' · ' : ''}${t.state || '—'}</div>
        </div>
      </div>

      ${t.litigation ? '<div class="insp-warn">⚠ Title recorded as in litigation</div>' : ''}

      <div class="sel-grid" style="margin-top:10px">
        <div class="sel-cell"><div class="k">Area</div>
          <div class="v" style="color:${c}">${t.areaKm2} <small>km²</small></div></div>
        <div class="sel-cell"><div class="k">Status</div>
          <div class="v" style="font-size:var(--fs-base)">${t.status || '—'}</div></div>
        <div class="sel-cell"><div class="k">Granted</div>
          <div class="v t-mono" style="font-size:var(--fs-base)">${t.granted || '—'}</div></div>
        <div class="sel-cell"><div class="k">Expires</div>
          <div class="v t-mono" style="font-size:var(--fs-base)">${t.expiry || '—'}</div></div>
      </div>

      <div class="insp-sec">
        <div class="insp-sec-hd">Holder</div>
        <p class="insp-holder">${t.holder || 'Not recorded'}</p>
      </div>

      ${minerals.length ? `
      <div class="insp-sec">
        <div class="insp-sec-hd">Minerals <span>${minerals.length}</span></div>
        <div class="st-chips">${minerals.map((m) =>
          `<span class="st-chip" style="color:${c};background:${c}1a;border:1px solid ${c}3d">${m}</span>`).join('')}</div>
      </div>` : ''}

      <div class="sel-actions">
        <button class="btn-ghost btn-primary" data-title-zoom="${t.lic}">Zoom to block</button>
        <button class="btn-ghost" data-send="titles" data-st="${t.state || ''}">Open register</button>
      </div>
      <div class="insp-src">Mining Cadastre Office · eMC+ register</div>`;
  };

  const inspectorEmpty = () => `
    <div class="empty-sel" style="padding:26px 12px">
      <span class="es-ico">${icon('target', { size: 28 })}</span>
      <p class="es-t">Hover or select a state, LGA or occurrence.<br/>Its full profile appears here.</p>
    </div>`;

  /**
   * NEITI-audited 2023 output for a state. Rendered with the same
   * insp-sec / comm-row vocabulary the rest of the inspector already uses,
   * so it reads as part of the panel rather than a bolt-on.
   */
  const productionBlock = (pr) => {
    if (!pr || !pr.tonnes) return '';
    const top = (pr.minerals || []).slice(0, 5);
    const max = top.length ? top[0].tonnes : 1;
    return `
      <div class="insp-sec">
        <div class="insp-sec-hd">
          Audited production 2023 <span>#${pr.rank} of 36</span>
        </div>
        <div class="prod-top">
          <div class="prod-fig">
            <div class="prod-v">${fmt.compact(pr.tonnes)}<i>t</i></div>
            <div class="prod-k">Tonnes produced</div>
          </div>
          <div class="prod-fig">
            <div class="prod-v">₦${fmt.compact(pr.valueNgn)}</div>
            <div class="prod-k">Declared value</div>
          </div>
          <div class="prod-fig">
            <div class="prod-v">${pr.operators}</div>
            <div class="prod-k">Operators</div>
          </div>
        </div>
        <div class="comm-list" style="margin-top:9px">
          ${top.map((m) => `
            <div class="comm-row">
              <i class="comm-dot" style="background:var(--gold);box-shadow:0 0 6px var(--gold)"></i>
              <span class="comm-name">${m.mineral}</span>
              <span class="comm-bar"><i style="width:${Math.max(3, (m.tonnes / max) * 100)}%;background:var(--gold)"></i></span>
              <span class="comm-n">${fmt.compact(m.tonnes)}t</span>
            </div>`).join('')}
        </div>
        <div class="prod-src">NEITI Solid Minerals Audit 2023 · reconciled by Haruna Yahaya &amp; Co.</div>
      </div>`;
  };

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

      ${productionBlock(p.production)}

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
      </div>
      <div class="ctx-acts ctx-acts-insp">
        <button class="btn-ghost" data-send="minerals" data-st="${p.name}">
          ${icon('minerals', { size: 12 })} Minerals</button>
        <button class="btn-ghost" data-send="prospectivity" data-st="${p.name}">
          ${icon('prospectivity', { size: 12 })} Prospectivity</button>
        <button class="btn-ghost" data-send="risk" data-st="${p.name}">
          ${icon('risk', { size: 12 })} Risk</button>
        <button class="btn-ghost" data-send="titles" data-st="${p.name}">
          ${icon('titles', { size: 12 })} Titles</button>
        ${p.petroleum ? `<button class="btn-ghost" data-send="oilgas" data-st="${p.name}">
          ${icon('oil', { size: 12 })} Oil &amp; Gas</button>` : ''}
        <button class="btn-ghost" data-report-place data-st="${p.name}">
          ${icon('reports', { size: 12 })} Report</button>
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
      </div>
      <div class="ctx-acts ctx-acts-insp">
        <button class="btn-ghost" data-send="minerals" data-res="${d.resource}" data-st="${d.state}" data-occ="${d.id}">
          ${icon('minerals', { size: 12 })} Mineral</button>
        <button class="btn-ghost" data-send="prospectivity" data-res="${d.resource}" data-st="${d.state}">
          ${icon('prospectivity', { size: 12 })} Prospectivity</button>
        <button class="btn-ghost" data-send="titles" data-res="${d.resource}" data-st="${d.state}">
          ${icon('titles', { size: 12 })} Titles</button>
        <button class="btn-ghost" data-report-place data-st="${d.state}" data-occ="${d.id}">
          ${icon('reports', { size: 12 })} Report</button>
        <button class="btn-ghost" data-send="risk" data-res="${d.resource}" data-st="${d.state}">
          ${icon('risk', { size: 12 })} Risk</button>
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
        </aside>
        <button class="dock-show dock-show-l" id="show-left" hidden title="Show tools panel">
          ${icon('chevronR', { size: 14 })}<span>Tools</span></button>

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
            <div class="risk-key" id="ex-risk-key">
                <b>Risk</b>
                <span class="rk-k"><i style="background:#ff4d5e"></i>High</span>
                <span class="rk-k"><i style="background:#ff8a3d"></i>Medium</span>
                <span class="rk-k"><i style="background:#00e676"></i>Low</span>
                <button class="rk-close" data-risk-off title="Turn off risk zones">
                  ${icon('plus', { size: 12 })}
                </button>
              </div>
              <div class="glass-bar" id="ex-quick">
              <button class="tool-btn" data-tool="reset" title="National extent">${icon('crosshair', { size: 15 })}</button>
              <button class="tool-btn" data-tool="in" title="Zoom in">${icon('plus', { size: 15 })}</button>
              <button class="tool-btn" data-tool="out" title="Zoom out">${icon('minus', { size: 15 })}</button>
              <div class="tool-sep-v"></div>
              <button class="tool-btn" data-tool="labels" title="Toggle place labels">${icon('eye', { size: 15 })}</button>
              <button class="tool-btn" data-tool="measure-toggle" title="Measure & draw tools">${icon('ruler', { size: 15 })}</button>
              <button class="tool-btn" data-tool="full" title="Fullscreen">${icon('fullscreen', { size: 15 })}</button>
            </div>
            <div class="glass-bar">
              <button class="chip" id="ex-filters-btn" title="Filters &amp; basemap">
                ${icon('filter', { size: 13 })}<span>Filters</span>
                <span class="filters-count" id="ex-filters-count">0</span>
                <span class="caret">${icon('chevron', { size: 11 })}</span>
              </button>
            </div>
          </div>

          <div class="ex-filter-menu menu" id="ex-filter-menu" hidden>
            <div class="menu-title">Basemap</div>
            <div class="seg" id="ex-basemap" style="margin:0 6px 8px">
              <button data-base="vector" class="is-on">Vector</button>
              <button data-base="satellite">Satellite</button>
            </div>
            <div class="menu-group">Prospectivity</div>
            ${[['all','All zones','#93a8ab'],['high','High (75–100)','#f5b942'],['moderate','Moderate (50–74)','#2dd8c3']]
              .map(([v,l,c]) => `<button class="menu-item ${v === 'all' ? 'is-on' : ''}" data-pros="${v}">
                <i class="swatch" style="background:${c};box-shadow:0 0 6px ${c}"></i>
                <span class="mi-label">${l}</span>
                <span class="tick">${icon('check', { size: 12, sw: 2.4 })}</span></button>`).join('')}
            <div class="menu-group">Risk</div>
            ${[['all','All states','#93a8ab'],['high','High risk','#ff4d5e'],['medium','Medium risk','#ff8a3d'],['low','Low risk','#00e676']]
              .map(([v,l,c]) => `<button class="menu-item ${v === 'all' ? 'is-on' : ''}" data-risk="${v}">
                <i class="swatch" style="background:${c};box-shadow:0 0 6px ${c}"></i>
                <span class="mi-label">${l}</span>
                <span class="tick">${icon('check', { size: 12, sw: 2.4 })}</span></button>`).join('')}
          </div>

          <div class="measure-dock glass-bar" id="measure-dock">
            <div class="md-hd">
              ${icon('ruler', { size: 12 })}<span>Measure &amp; Draw</span>
              <button class="md-x" id="md-hide" title="Hide">${icon('minus', { size: 12 })}</button>
            </div>
            <div class="md-bd" id="measure-tools">${measureTools()}</div>
          </div>

          <div class="draw-banner" id="draw-banner" hidden>
            <span class="db-dot"></span>
            <b id="db-tool">Distance</b>
            <span id="db-hint">Click points on the map</span>
            <button class="db-btn" id="db-finish">Finish</button>
            <button class="db-btn db-x" id="db-cancel">Esc</button>
          </div>

        </section>

        <aside class="ex-dock ex-right" id="ex-right">
          <div class="ex-dock-scroll">
            ${panel('inspector', 'Inspector', 'info', `
              <div class="insp-tabs" id="insp-tabs">
                <button data-itab="geo" class="is-on">Geography</button>
                <button data-itab="shape">Measurement</button>
              </div>
              <div id="inspector">${inspectorEmpty()}</div>`,
              `<button class="ex-mini" id="insp-clear" title="Clear">${icon('crosshair', { size: 12 })}</button>`)}
            ${panel('shapes', 'Measurements', 'grid', `<div id="shape-list">${shapeList()}</div>`)}
            ${panel('projects', 'Saved Work', 'data', `<div id="prj-panel">${projectPanel()}</div>`)}
          </div>
        </aside>
        <button class="dock-show dock-show-r" id="show-right" hidden title="Show inspector panel">
          ${icon('chevronL', { size: 14 })}<span>Intel</span></button>
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
      onTitleSelect: (t) => {
        lastGeo = { kind: 'title', data: t };
        setInspectorTab('geo');
        renderInspector();
      },
      onLgaSelect: (props) => {
        lastGeo = { kind: 'lga', data: props };
        setInspectorTab('geo');
        renderInspector();
        renderDrill();
      },
    });
    await nmap.init();
    $('#map-loading', view).classList.add('is-hidden');
    // Seed the labels eye from stored state so a persisted "off" is visible.
    setLabels(store.get('showLabels'));

    // Lazy layers (cadastre, conflicts, roads, footprints, sites) are drawn on
    // demand, so a fresh map instance starts without them even when the store
    // — and therefore the layer tree — still says they are on. That happens on
    // every view rebuild, e.g. after a dataset toggle. Redraw whatever the
    // tree is claiming so the switch and the map cannot disagree.
    const persisted = store.get('layers') || {};
    const LAZY = ['titles', 'conflicts', 'infra', 'footprints', 'sites'];
    LAZY.forEach((id) => {
      if (!persisted[id]) return;
      const meta = LAYER_INDEX[id];
      if (!meta || meta.soon) return;
      if (dsToggles && DATASET_LAYER) {
        const dsId = Object.keys(DATASET_LAYER).find((k) => DATASET_LAYER[k] === id);
        if (dsId && !dsToggles.isOn(dsId)) {
          // Dataset was excluded — clear the stale "on" instead of drawing it.
          store.set({ layers: { ...store.get('layers'), [id]: false } });
          const row = $(`#layer-tree [data-layer="${id}"]`, view);
          if (row) { row.classList.remove('is-on'); row.setAttribute('aria-checked', 'false'); }
          return;
        }
      }
      applyLayer(nmap, id, true, { store, toast });
    });

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

    // Shared chrome: resource legend + breadcrumb/coordinate status bar
    legend = createLegend(stage, {
      scope: 'explore',
      getActive: () => $$('#res-filter .ex-chip.is-on', view).map((c) => c.dataset.res),
      onToggle: (list) => {
        $$('#res-filter .ex-chip', view).forEach((c) => c.classList.toggle('is-on', list.includes(c.dataset.res)));
        applyResources(list);
      },
    });
    statusBar = createStatusBar(stage, nmap);
    unsub.push(() => statusBar.destroy());

    wireMap(stage);
    wireDocks(view);
    wireFilterMenu(view);
    setMeasureDock(isMeasureDockOpen());

    // The measure panel floats over the map and can be repositioned.
    makeDraggable($('#measure-dock', view), $('#measure-dock .md-hd', view), {
      key: 'nmi.measureDockPos',
      container: stage,
    });
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
    nmap.map.on('mousemove', (e) => { lastCursor = e.latlng; });


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
      if (t === 'in') nmap.zoomBy(1);
      if (t === 'out') nmap.zoomBy(-1);
      if (t === 'reset') nmap.resetView();
      if (t === 'labels') setLabels(!store.get('showLabels'));
      if (t === 'measure-toggle') setMeasureDock(!isMeasureDockOpen());
      if (t === 'full') {
        if (!document.fullscreenElement) $('#ex-map', root).requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    });

    // Risk legend dismiss — turns the layer off through the layer-tree row so
    // the row, the overlay and the legend can never disagree.
    $('#ex-risk-key', root)?.addEventListener('click', (ev) => {
      if (!ev.target.closest('[data-risk-off]')) return;
      const row = $('#layer-tree [data-layer="risk"]', root);
      if (row?.classList.contains('is-on')) row.click();
      nmap.emphasiseLga?.(null);
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
      const cp = e.target.closest('[data-copy]');
      if (cp) {
        draw.copy(cp.dataset.copy);
        toast('Copied · press Ctrl+V to paste');
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) { draw.remove(del.dataset.del); return; }
      if (e.target.closest('#clear-shapes')) {
        if (draw.shapes.length) draw.clearAll();
        return;
      }
      const row = e.target.closest('[data-shape]');
      if (row) { draw.select(row.dataset.shape); draw.zoomTo(row.dataset.shape); }
    });

    $('#md-hide', view)?.addEventListener('click', () => setMeasureDock(false));
    $('#mt-save', view)?.addEventListener('click', () => saveProject());

    const banner = $('#draw-banner', view);
    banner.addEventListener('click', (e) => {
      if (e.target.closest('#db-finish')) draw.commitDraft();
      if (e.target.closest('#db-cancel')) { draw.setTool(null); syncToolButtons(); }
    });
  }

  /**
   * Labels are reachable from two places — the quick-tool eye and the Layers
   * panel row. Route both through here so they can never disagree.
   */
  function setLabels(on) {
    nmap.setLabels(on);
    const eye = $('#ex-quick [data-tool="labels"]', root);
    if (eye) eye.classList.toggle('is-off', !on);
    const row = $('#layer-tree [data-layer="labels"]', root);
    if (row) {
      row.classList.toggle('is-on', on);
      row.setAttribute('aria-checked', String(on));
    }
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
    const keep = draw.selectedId;
    draw.setShapes(st);
    if (keep && st.some((x) => x.id === keep)) draw.select(keep);
    renderShapeList(); renderInspector(); markDirty(true);
    toast(`Undo${history.redoLabel ? ` · ${history.redoLabel}` : ''}`);
  }
  function doRedo() {
    const st = history.redo();
    if (!st) return;
    const keep = draw.selectedId;
    draw.setShapes(st);
    if (keep && st.some((x) => x.id === keep)) draw.select(keep);
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

      // clipboard
      if (mod && e.key.toLowerCase() === 'c' && draw.selectedId) {
        e.preventDefault(); draw.copy(); toast('Measurement copied'); return;
      }
      if (mod && e.key.toLowerCase() === 'x' && draw.selectedId) {
        e.preventDefault(); draw.cut(); toast('Measurement cut'); return;
      }
      if (mod && e.key.toLowerCase() === 'v' && draw.clipboard) {
        e.preventDefault();
        const sh = draw.paste(lastCursor);
        if (sh) toast(`Pasted "${sh.label}"`);
        return;
      }
      if (mod && e.key.toLowerCase() === 'd' && draw.selectedId) {
        e.preventDefault();
        const sh = draw.duplicate();
        if (sh) toast(`Duplicated as "${sh.label}"`);
        return;
      }

      // panel visibility
      if (e.key === '[') { setDockRef?.('left',  !$('#ex-left', root).classList.contains('is-collapsed')); return; }
      if (e.key === ']') { setDockRef?.('right', !$('#ex-right', root).classList.contains('is-collapsed')); return; }

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
    const DK = 'nmi.exDocks';
    const readDocks = () => { try { return JSON.parse(localStorage.getItem(DK) || '{}'); } catch { return {}; } };

    function setDock(side, collapsed) {
      $(`#ex-${side}`, view).classList.toggle('is-collapsed', collapsed);
      $(`#show-${side}`, view).hidden = !collapsed;
      const st = readDocks(); st[side] = collapsed;
      localStorage.setItem(DK, JSON.stringify(st));
      setTimeout(() => nmap.invalidate(), 270);
    }
    setDockRef = setDock;

    // Drag the rail to resize, click it to hide.
    ['left', 'right'].forEach((side) => {
      makeDockResizer($(`#ex-${side}`, view), {
        side,
        min: 210,
        max: 460,
        key: `nmi.exDockW.${side}`,
        onResize: () => nmap.invalidate(),
        onToggle: () => setDock(side, !$(`#ex-${side}`, view).classList.contains('is-collapsed')),
      });
    });

    const saved = readDocks();
    setDock('left', !!saved.left);
    setDock('right', !!saved.right);

    view.addEventListener('click', (e) => {
      if (e.target.closest('#show-left'))  setDock('left', false);
      if (e.target.closest('#show-right')) setDock('right', false);
    });
  }

  /* ---- filters + basemap menu ---- */
  function wireFilterMenu(view) {
    const btn = $('#ex-filters-btn', view);
    const menu = $('#ex-filter-menu', view);

    const close = () => { menu.hidden = true; btn.classList.remove('is-open'); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.classList.toggle('is-open', !menu.hidden);
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('#ex-filter-menu') && !e.target.closest('#ex-filters-btn')) close();
    });

    menu.addEventListener('click', (e) => {
      const base = e.target.closest('[data-base]');
      if (base) {
        $$('#ex-basemap button', menu).forEach((b) => b.classList.toggle('is-on', b === base));
        nmap.setBasemap(base.dataset.base);
        return;
      }
      const pr = e.target.closest('[data-pros]');
      if (pr) {
        $$('[data-pros]', menu).forEach((b) => b.classList.toggle('is-on', b === pr));
        nmap.filterProspectivity(pr.dataset.pros);
        updateFilterCount();
        return;
      }
      const rk = e.target.closest('[data-risk]');
      if (rk) {
        $$('[data-risk]', menu).forEach((b) => b.classList.toggle('is-on', b === rk));
        nmap.filterRisk(rk.dataset.risk);
        updateFilterCount();
      }
    });
  }

  function updateFilterCount() {
    const f = store.get('filters');
    const n = (f.prospectivity !== 'all' ? 1 : 0) + (f.risk !== 'all' ? 1 : 0);
    const badge = $('#ex-filters-count', root);
    if (!badge) return;
    badge.textContent = n;
    badge.classList.toggle('is-zero', n === 0);
    $('#ex-filters-btn', root)?.classList.toggle('has-active', n > 0);
  }

  /* ---- floating measure dock (stays available in fullscreen) ---- */
  const MD_KEY = 'nmi.measureDock';
  const isMeasureDockOpen = () => localStorage.getItem(MD_KEY) !== '0';
  function setMeasureDock(open) {
    const d = $('#measure-dock', root);
    if (d) d.hidden = !open;
    $('[data-tool="measure-toggle"]', root)?.classList.toggle('is-on', open);
    localStorage.setItem(MD_KEY, open ? '1' : '0');
    if (!open && draw?.tool) { draw.setTool(null); syncToolButtons(); }
  }

  /* ---- collapsible panels ---- */

  /* ---- draw / measure tools ---- */



  /* ---- history ---- */
  function doUndo() {
    const st = history.undo();
    if (!st) return;
    const keep = draw.selectedId;
    draw.setShapes(st);
    if (keep && st.some((x) => x.id === keep)) draw.select(keep);
    renderShapeList(); renderInspector(); markDirty(true);
    toast(`Undo${history.redoLabel ? ` · ${history.redoLabel}` : ''}`);
  }
  function doRedo() {
    const st = history.redo();
    if (!st) return;
    const keep = draw.selectedId;
    draw.setShapes(st);
    if (keep && st.some((x) => x.id === keep)) draw.select(keep);
    renderShapeList(); renderInspector(); markDirty(true);
    toast('Redo');
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




  function setInspectorTab(mode) {
    inspectorMode = mode;
    $$('#insp-tabs button', root).forEach((b) =>
      b.classList.toggle('is-on', b.dataset.itab === mode));
  }

  /* ---- docks ---- */

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

      if (id === 'labels') setLabels(next);
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
        if (id === 'labels') setLabels(on);
        else if (id === 'lgas') nmap.hideLgas();
        else nmap.toggleLayer(id, on);
      });
      toast('Layers reset');
    });
  }

  /* ---- resource filter ---- */
  function applyResources(list) {
    nmap.filterResources(list);
    legend?.sync(list);
  }

  function wireResources(view) {
    const readChips = () => $$('#res-filter .ex-chip.is-on', view).map((c) => c.dataset.res);
    $('#res-filter', view).addEventListener('click', (e) => {
      const chip = e.target.closest('[data-res]');
      if (chip) { chip.classList.toggle('is-on'); applyResources(readChips()); return; }
      if (e.target.closest('[data-res-all]')) {
        $$('#res-filter .ex-chip', view).forEach((c) => c.classList.add('is-on'));
        applyResources(readChips()); return;
      }
      if (e.target.closest('[data-res-none]')) {
        $$('#res-filter .ex-chip', view).forEach((c) => c.classList.remove('is-on'));
        applyResources(readChips());
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

      const send = e.target.closest('[data-send]');
      if (send) {
        const d = send.dataset;
        ctx.set({
          commodity: d.res || ctx.get().commodity || null,
          state: d.st || null,
          lga: d.lga || null,
          occurrence: d.occ || null,
          // A place handoff must not carry a stale asset selection, or the
          // receiving register would jump to an unrelated record.
          title: null,
          block: null,
        });
        ctx.go(d.send);
        return;
      }

      // Build a report for whatever the map has selected, then open Reports.
      const rep = e.target.closest('[data-report-place]');
      if (rep) {
        const d = rep.dataset;
        const sections = [];
        if (d.occ) {
          const dep = deposits.find((x) => x.id === d.occ);
          sections.push({ kind: 'occurrence', id: d.occ,
            title: `Occurrence — ${dep?.name || d.occ}` });
        }
        if (d.lga) sections.push({ kind: 'lga', id: d.lga, state: d.st,
          title: `Local government — ${d.lga}` });
        if (d.st) {
          sections.push({ kind: 'state', id: d.st, title: `State profile — ${d.st}` });
          sections.push({ kind: 'prospectivity', id: d.st, title: `Prospectivity — ${d.st}` });
          sections.push({ kind: 'risk', id: d.st, title: `Risk assessment — ${d.st}` });
          sections.push({ kind: 'titles', id: d.st, title: `Mining titles — ${d.st}` });
        }
        const n = reports.addMany(sections);
        toast(n ? `Added ${n} section${n === 1 ? '' : 's'} to the report` : 'Already in the report');
        ctx.go('reports', { state: d.st || null, lga: d.lga || null, occurrence: d.occ || null });
        return;
      }

      if (e.target.closest('[data-lga-zoom]') && lastGeo?.kind === 'lga') {
        const l = nmap.layers.lgas?.getLayers().find((x) => x.feature.properties.name === lastGeo.data.name);
        if (l) nmap.map.flyToBounds(l.getBounds(), { padding: [60, 60], duration: .8 });
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      const st = store.get('selectedState');
      if (act === 'back-state' && st) {
        lastGeo = { kind: 'state', data: st };
        renderInspector();
        const layer = nmap.stateLayers.get(st.name);
        if (layer) nmap.map.flyToBounds(layer.getBounds(), { padding: [40, 40], duration: .8 });
        return;
      }
      if (act === 'drill-lga' && st) {
        nmap.showLgas(st.code, { explicit: true }).then(() => {
          const n = nmap.layers.lgas?.getLayers().length || 0;
          $('[data-layer="lgas"]', view)?.classList.add('is-on');
          toast(`${st.name}: ${n} LGAs loaded`);
        });
        const layer = nmap.stateLayers.get(st.name);
        if (layer) nmap.map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 9.2, duration: .9 });
      }
      const tz = e.target.closest('[data-title-zoom]');
      if (tz && nmap.layers.titles) {
        const lic = tz.dataset.titleZoom;
        let hit = null;
        nmap.layers.titles.eachLayer((l) => { if (l.feature?.properties?.l === lic) hit = l; });
        if (hit?.getBounds) nmap.map.flyToBounds(hit.getBounds(), { padding: [90, 90], maxZoom: 13, duration: 0.9 });
        return;
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
    el.innerHTML = lastGeo.kind === 'state' ? inspectorState(lastGeo.data)
      : lastGeo.kind === 'lga' ? inspectorLga(lastGeo.data)
      : lastGeo.kind === 'title' ? inspectorTitle(lastGeo.data)
      : inspectorDeposit(lastGeo.data);
  }

  function renderDrill() {
    const el = $('#drill-nav', root);
    if (el) el.innerHTML = drillNav();
  }

  /**
   * Another module (e.g. Minerals) asked for a state or site to be opened
   * here. Consume the request once so a later revisit does not re-trigger it.
   */
  function consumeFocus() {
    if (!nmap) return;

    // Legacy single-shot request (kept for any caller still using it).
    const req = store.get('pendingFocus');
    if (req) {
      store.set({ pendingFocus: null });
      if (req.site) return flyToSite(req.site);
      if (req.state) return flyToState(req.state);
    }

    // Shared cross-module context.
    const c = ctx.get();
    if (c.stamp === lastCtxStamp) return;
    lastCtxStamp = c.stamp;

    if (c.layer) enableLayer(c.layer, { silent: c.layer === 'lgas' && !!c.lga });
    if (c.commodity) focusCommodity(c.commodity);

    if (c.occurrence) {
      const d = nmap.deposits?.find((x) => x.id === c.occurrence);
      if (d) return flyToSite(d);
    }
    if (c.lga && c.state) return flyToLga(c.state, c.lga);
    if (c.state) return flyToState(c.state);
  }

  function flyToSite(site) {
    const d = nmap.deposits?.find((x) => x.id === site.id) || site;
    nmap.lockView(true);
    nmap.map.flyTo([d.lat, d.lng], 11, { duration: 1 });
    lastGeo = { kind: 'deposit', data: d };
    setInspectorTab('geo');
    renderInspector();
  }

  function flyToState(name) {
    const layer = nmap.stateLayers.get(name);
    if (!layer) return;
    nmap.lockView(true);
    nmap.selectState(name);
    nmap.map.flyToBounds(layer.getBounds(), { padding: [40, 40], duration: 1 });
  }

  /** Zoom to an LGA polygon, loading the state's ADM2 layer if needed. */
  async function flyToLga(stateName, lgaName) {
    const st = [...nmap.stateLayers.values()]
      .map((l) => l.feature.properties).find((p) => p.name === stateName);
    if (!st) return flyToState(stateName);

    nmap.lockView(true);
    nmap.selectState(stateName);
    await nmap.loadLgas?.(st.code);
    await nmap.showLgas?.(st.code, { explicit: true });

    // The layer may already have been built by the zoom-8.5 auto-load, or a
    // load may still be settling — poll briefly rather than assume.
    let target = null;
    for (let i = 0; i < 12 && !target; i += 1) {
      target = nmap.layers.lgas?.getLayers()
        .find((l) => l.feature.properties.name === lgaName) || null;
      if (!target) await new Promise((r) => setTimeout(r, 60));
    }
    if (target) {
      nmap.map.flyToBounds(target.getBounds(), { padding: [50, 50], duration: 1 });
      nmap.selectLga?.(target.feature.properties, target);
      nmap.emphasiseLga?.(lgaName);
    } else {
      flyToState(stateName);
    }
  }

  /** Show only the requested commodity so the handoff reads clearly. */
  function focusCommodity(id) {
    const chip = $(`#res-filter [data-res="${id}"]`, root);
    if (!chip) return;
    $$('#res-filter [data-res]', root).forEach((b) =>
      b.classList.toggle('is-on', b.dataset.res === id));
    nmap.filterResources([id]);
  }

  function enableLayer(id, { silent = false } = {}) {
    const row = $(`#layer-tree [data-layer="${id}"]`, root);
    if (!row) return;
    // flyToLga owns the LGA layer; clicking the row here would re-fit the
    // state and cancel the pending zoom.
    if (silent) {
      row.classList.add('is-on');
      row.setAttribute('aria-checked', 'true');
      return;
    }
    if (row.classList.contains('is-soon')) {
      toast(`${id === 'risk' ? 'Risk zones' : id} layer arrives with the data service — showing the location instead`);
      return;
    }
    if (!row.classList.contains('is-on')) row.click();
  }

  return {
    mount,
    onShow() {
      requestAnimationFrame(() => {
        nmap?.invalidate();
        // A second frame so the invalidated size is applied before we fly;
        // otherwise Leaflet computes the target against a stale container.
        requestAnimationFrame(() => consumeFocus());
      });
    },
    onHide() { draw?.setTool(null); syncToolButtons(); },
    destroy() { unsub.forEach((f) => f()); draw?.destroy(); nmap?.destroy(); },
  };
}
