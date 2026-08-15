/**
 * Floating map control surface: search, filters, layers, zoom, basemap,
 * legend, drill breadcrumb and scale bar. Kept separate from the map engine
 * so the Explore Map module can reuse it with a different configuration.
 */

import { icon } from '../core/icons.js';
import { store } from '../core/store.js';
import { $, $$ } from '../core/utils.js';
import { RESOURCE_META } from '../data/fixtures.js';
import { toast } from '../modules/dashboard.js';

const RESOURCES = ['gold', 'lithium', 'tin', 'iron', 'lead', 'barite', 'oil', 'gas'];

export function mapToolbar(stage, nmap) {
  /* ---------- markup ---------- */
  const bar = document.createElement('div');
  bar.className = 'map-ui map-toolbar';
  bar.innerHTML = `
    <div class="glass-bar">
      <div class="map-search">
        <span class="s-icon">${icon('search', { size: 13 })}</span>
        <input type="text" id="map-loc-search" placeholder="Search state, LGA or prospect" autocomplete="off" />
      </div>
      <button class="chip filters-btn" id="filters-btn" title="Show filters">
        ${icon('filter', { size: 13 })}<span>Filters</span>
        <span class="filters-count" id="filters-count" hidden></span>
        <span class="caret">${icon('chevron', { size: 11 })}</span>
      </button>
    </div>

    <div class="glass-bar filter-cluster" id="filter-cluster" hidden>
      <button class="chip" data-menu="resource">${icon('minerals', { size: 13 })}<span>Resource</span><span class="caret">${icon('chevron', { size: 11 })}</span></button>
      <button class="chip" data-menu="prospect">${icon('prospectivity', { size: 13 })}<span>Prospectivity</span><span class="caret">${icon('chevron', { size: 11 })}</span></button>
      <button class="chip" data-menu="risk">${icon('risk', { size: 13 })}<span>Risk</span><span class="caret">${icon('chevron', { size: 11 })}</span></button>
      <button class="chip" data-menu="layers">${icon('layers', { size: 13 })}<span>Layers</span><span class="caret">${icon('chevron', { size: 11 })}</span></button>
      <span class="fc-sep"></span>
      <div class="seg" id="basemap-seg">
        <button data-base="vector" class="is-on">Vector</button>
        <button data-base="satellite">Satellite</button>
      </div>
    </div>`;
  stage.appendChild(bar);

  const tools = document.createElement('div');
  tools.className = 'map-ui map-tools';
  tools.innerHTML = `
    <div class="glass-bar tool-stack">
      <button class="tool-btn" data-tool="in"    title="Zoom in">${icon('plus', { size: 15 })}</button>
      <button class="tool-btn" data-tool="out"   title="Zoom out">${icon('minus', { size: 15 })}</button>
      <div class="tool-sep"></div>
      <div class="zoom-readout"><span class="zl" id="zoom-lvl">6.1</span><span class="zt" id="zoom-band">nation</span></div>
    </div>
    <div class="glass-bar tool-stack">
      <button class="tool-btn" data-tool="reset"  title="Reset to national view">${icon('crosshair', { size: 15 })}</button>
      <button class="tool-btn" data-tool="labels" title="Toggle labels">${icon('eye', { size: 15 })}</button>
      <button class="tool-btn" data-tool="measure" title="Measure distance">${icon('ruler', { size: 15 })}</button>
      <button class="tool-btn" data-tool="full"   title="Fullscreen map">${icon('fullscreen', { size: 15 })}</button>
    </div>`;
  stage.appendChild(tools);

  const crumbs = document.createElement('div');
  crumbs.className = 'map-ui drill-path';
  crumbs.id = 'drill-path';
  stage.appendChild(crumbs);

  const legend = document.createElement('div');
  legend.className = 'map-ui map-legend glass-bar';
  legend.id = 'map-legend';
  legend.innerHTML = `
    <div class="lg-hd">
      <span>Resource Legend</span>
      <span class="lg-acts">
        <button class="lg-toggle" id="lg-all" title="Show / hide all resources">${icon('eye', { size: 12 })}</button>
        <button class="lg-toggle" id="lg-collapse" title="Hide legend">${icon('minus', { size: 12 })}</button>
      </span>
    </div>
    <div class="lg-list" id="lg-list">
      ${RESOURCES.map((r) => {
        const m = RESOURCE_META[r];
        return `<div class="lg-row" data-lg="${r}">
          <i class="lg-dot" style="background:${m.hex};box-shadow:0 0 6px ${m.hex}"></i>
          <span>${m.label}</span></div>`;
      }).join('')}
    </div>
    <div class="lg-scale"><span>Low</span><div class="lg-ramp"></div><span>High</span></div>`;
  stage.appendChild(legend);

  // Collapsed affordance — a small pill that restores the legend
  const legendPill = document.createElement('button');
  legendPill.className = 'map-ui legend-pill';
  legendPill.id = 'legend-pill';
  legendPill.hidden = true;
  legendPill.innerHTML = `${icon('layers', { size: 12 })}<span>Legend</span>`;
  stage.appendChild(legendPill);

  const LEGEND_KEY = 'nmi.legendHidden';
  function setLegend(hidden) {
    legend.hidden = hidden;
    legendPill.hidden = !hidden;
    localStorage.setItem(LEGEND_KEY, hidden ? '1' : '0');
  }
  setLegend(localStorage.getItem(LEGEND_KEY) === '1');
  legendPill.addEventListener('click', () => setLegend(false));

  const meta = document.createElement('div');
  meta.className = 'map-ui map-meta';
  meta.innerHTML = `
    <div class="scalebar"><span class="lbl" id="scale-lbl">200 km</span><div class="bar"></div></div>`;
  stage.appendChild(meta);

  /* ---------- deposit counts for menus ---------- */
  const counts = {};
  (nmap.deposits || []).forEach((d) => { counts[d.resource] = (counts[d.resource] || 0) + 1; });

  /* ---------- menus ---------- */
  let openMenu = null;

  const MENUS = {
    resource: () => ({
      title: 'Resource Categories',
      items: RESOURCES.map((r) => ({
        id: r, label: RESOURCE_META[r].label, swatch: RESOURCE_META[r].hex,
        count: counts[r] || 0, on: store.get('filters').resources.includes(r),
      })),
      footer: [{ id: '__all', label: 'Select all' }, { id: '__none', label: 'Clear all' }],
      onPick: (id) => {
        let list = [...store.get('filters').resources];
        if (id === '__all') list = [...RESOURCES];
        else if (id === '__none') list = [];
        else list = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
        nmap.filterResources(list);
        syncLegend(list);
        return true; // keep open
      },
    }),
    prospect: () => ({
      title: 'Prospectivity Band',
      items: [
        { id: 'all', label: 'All zones', swatch: '#93a8ab', on: store.get('filters').prospectivity === 'all' },
        { id: 'high', label: 'High (75–100)', swatch: '#f5b942', on: store.get('filters').prospectivity === 'high' },
        { id: 'moderate', label: 'Moderate (50–74)', swatch: '#2dd8c3', on: store.get('filters').prospectivity === 'moderate' },
      ],
      onPick: (id) => { nmap.filterProspectivity(id); return false; },
    }),
    risk: () => ({
      title: 'Risk Classification',
      items: [
        { id: 'all', label: 'All states', swatch: '#93a8ab', on: store.get('filters').risk === 'all' },
        { id: 'high', label: 'High risk', swatch: '#ff4d5e', on: store.get('filters').risk === 'high' },
        { id: 'medium', label: 'Medium risk', swatch: '#ff8a3d', on: store.get('filters').risk === 'medium' },
        { id: 'low', label: 'Low risk', swatch: '#00e676', on: store.get('filters').risk === 'low' },
      ],
      onPick: (id) => { nmap.filterRisk(id); return false; },
    }),
    layers: () => {
      const L = store.get('layers');
      return {
        title: 'Map Layers',
        items: [
          { id: 'deposits', label: 'Mineral occurrences', swatch: '#f5b942', on: L.deposits },
          { id: 'prospectivity', label: 'Prospectivity heat', swatch: '#ff8a3d', on: L.prospectivity },
          { id: 'graticule', label: 'Coordinate grid', swatch: '#2dd8c3', on: true },
          { id: 'risk', label: 'Risk zones', swatch: '#ff4d5e', on: L.risk, soon: true },
          { id: 'titles', label: 'Mining titles', swatch: '#8b7dff', on: L.titles, soon: true },
          { id: 'infrastructure', label: 'Roads & infrastructure', swatch: '#9aa7b0', on: L.infrastructure, soon: true },
        ],
        onPick: (id, item) => {
          if (item.soon) { toast(`${item.label} layer arrives with the GIS data service`); return true; }
          nmap.toggleLayer(id, !item.on);
          return true;
        },
      };
    },
  };

  function closeMenu() {
    if (!openMenu) return;
    openMenu.node.remove();
    openMenu.btn.classList.remove('is-open', 'is-active');
    openMenu = null;
  }

  function buildMenu(key, btn) {
    const spec = MENUS[key]();
    const node = document.createElement('div');
    node.className = 'menu';
    node.innerHTML = `
      <div class="menu-title">${spec.title}</div>
      ${spec.items.map((it) => `
        <button class="menu-item ${it.on ? 'is-on' : ''}" data-id="${it.id}">
          <i class="swatch" style="background:${it.swatch};box-shadow:0 0 6px ${it.swatch}"></i>
          <span class="mi-label">${it.label}</span>
          ${it.soon ? '<span class="mi-count" style="color:var(--gold)">SOON</span>'
                    : it.count !== undefined ? `<span class="mi-count">${it.count}</span>` : ''}
          <span class="tick">${icon('check', { size: 12, sw: 2.4 })}</span>
        </button>`).join('')}
      ${spec.footer ? `<div class="menu-sep"></div>${spec.footer.map((f) => `
        <button class="menu-item" data-id="${f.id}"><span class="mi-label">${f.label}</span></button>`).join('')}` : ''}`;

    const r = btn.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    node.style.left = Math.min(r.left - sr.left, sr.width - 224) + 'px';
    node.style.top = r.bottom - sr.top + 7 + 'px';

    node.addEventListener('click', (e) => {
      const b = e.target.closest('.menu-item');
      if (!b) return;
      const item = spec.items.find((x) => x.id === b.dataset.id) || {};
      const keep = spec.onPick(b.dataset.id, item);
      if (keep) {
        const fresh = MENUS[key]();
        fresh.items.forEach((it) => {
          const n = node.querySelector(`.menu-item[data-id="${it.id}"]`);
          if (n) n.classList.toggle('is-on', !!it.on);
        });
      } else closeMenu();
      updateChipStates();
    });

    stage.appendChild(node);
    btn.classList.add('is-open', 'is-active');
    openMenu = { node, btn, key };
  }

  const FILTERS_KEY = 'nmi.filtersOpen';
  const cluster = $('#filter-cluster', bar);
  const fBtn = $('#filters-btn', bar);

  function setFilters(open) {
    cluster.hidden = !open;
    fBtn.classList.toggle('is-open', open);
    fBtn.classList.toggle('is-active', open);
    fBtn.title = open ? 'Hide filters' : 'Show filters';
    if (!open) closeMenu();
    localStorage.setItem(FILTERS_KEY, open ? '1' : '0');
  }
  setFilters(localStorage.getItem(FILTERS_KEY) === '1');

  fBtn.addEventListener('click', () => setFilters(cluster.hidden));

  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-menu]');
    if (chip) {
      const key = chip.dataset.menu;
      const wasOpen = openMenu?.key === key;
      closeMenu();
      if (!wasOpen) buildMenu(key, chip);
      return;
    }
    const base = e.target.closest('[data-base]');
    if (base) {
      $$('#basemap-seg button', bar).forEach((b) => b.classList.toggle('is-on', b === base));
      nmap.setBasemap(base.dataset.base);
      toast(base.dataset.base === 'satellite'
        ? 'Satellite basemap · imagery streams at zoom ≥ 10'
        : 'Vector basemap active');
    }
  });

  document.addEventListener('click', (e) => {
    if (openMenu && !e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenu();
  });

  function updateChipStates() {
    const f = store.get('filters');
    const rOn = f.resources.length !== RESOURCES.length;
    const pOn = f.prospectivity !== 'all';
    const kOn = f.risk !== 'all';
    $('[data-menu="resource"]', bar).classList.toggle('is-active', rOn);
    $('[data-menu="prospect"]', bar).classList.toggle('is-active', pOn);
    $('[data-menu="risk"]', bar).classList.toggle('is-active', kOn);

    // Badge the collapsed Filters button so active filters are never hidden
    const n = (rOn ? 1 : 0) + (pOn ? 1 : 0) + (kOn ? 1 : 0);
    const badge = $('#filters-count', bar);
    badge.hidden = n === 0;
    badge.textContent = n;
    fBtn.classList.toggle('has-active', n > 0);
  }

  /* ---------- tools ---------- */
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    const t = b.dataset.tool;
    if (t === 'in') nmap.zoomBy(0.6);
    if (t === 'out') nmap.zoomBy(-0.6);
    if (t === 'reset') { nmap.resetView(); toast('Returned to national extent'); }
    if (t === 'labels') {
      const on = !store.get('showLabels');
      nmap.setLabels(on);
      b.classList.toggle('is-on', !on);
    }
    if (t === 'measure') { b.classList.toggle('is-on'); toast('Measurement tool ships with the Explore Map module'); }
    if (t === 'full') {
      const stageEl = stage;
      if (!document.fullscreenElement) stageEl.requestFullscreen?.().then(() => nmap.invalidate());
      else document.exitFullscreen?.().then(() => nmap.invalidate());
      b.classList.toggle('is-on');
    }
  });

  /* ---------- legend ---------- */
  function syncLegend(list) {
    $$('.lg-row', legend).forEach((r) => r.classList.toggle('is-off', !list.includes(r.dataset.lg)));
  }
  legend.addEventListener('click', (e) => {
    if (e.target.closest('#lg-collapse')) { setLegend(true); return; }
    if (e.target.closest('#lg-all')) {
      const all = store.get('filters').resources.length === RESOURCES.length;
      const list = all ? [] : [...RESOURCES];
      nmap.filterResources(list); syncLegend(list); updateChipStates();
      return;
    }
    const row = e.target.closest('.lg-row');
    if (!row) return;
    const id = row.dataset.lg;
    let list = [...store.get('filters').resources];
    list = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    nmap.filterResources(list); syncLegend(list); updateChipStates();
  });

  /* ---------- breadcrumb (drill path) ---------- */
  const NEXT = { nation: 'state', state: 'LGA', lga: 'local area', local: 'prospect', prospect: 'occurrence' };

  function renderCrumbs() {
    const d = store.get('drill');
    const parts = [{ id: 'nation', label: 'Nigeria' }];
    if (d.state) parts.push({ id: 'state', label: d.state });
    if (d.lga) parts.push({ id: 'lga', label: d.lga });
    if (d.prospect) parts.push({ id: 'prospect', label: d.prospect });

    crumbs.innerHTML =
      parts.map((p, i) => `
        <button class="crumb ${i === parts.length - 1 ? 'is-current' : ''}" data-crumb="${p.id}">
          ${i === 0 ? icon('pin', { size: 11 }) : ''}<span>${p.label}</span>
        </button>
        ${i < parts.length - 1 ? `<span class="crumb-sep">${icon('chevronR', { size: 10 })}</span>` : ''}`).join('') +
      `<span class="crumb-sep">${icon('chevronR', { size: 10 })}</span>
       <span class="crumb-next">${NEXT[d.level] || 'detail'}</span>`;
  }
  crumbs.addEventListener('click', (e) => {
    const c = e.target.closest('[data-crumb]');
    if (!c) return;
    if (c.dataset.crumb === 'nation') nmap.resetView();
  });
  renderCrumbs();
  store.subscribe('drill', renderCrumbs);

  /* ---------- zoom + scale readout ---------- */
  stage.addEventListener('map:scale', (e) => {
    const { zoom, km, band } = e.detail;
    $('#zoom-lvl', tools).textContent = zoom.toFixed(1);
    $('#zoom-band', tools).textContent = band;
    $('#scale-lbl', meta).textContent = km >= 1 ? `${km} km` : '<1 km';
  });

  /* ---------- location search ---------- */
  const input = $('#map-loc-search', bar);
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = input.value.trim().toLowerCase();
    if (!q) return;
    const hit = [...nmap.stateLayers.keys()].find((n) => n.toLowerCase().includes(q));
    if (hit) { nmap.selectState(hit, { zoom: true }); toast(`Located ${hit}`); input.blur(); }
    else {
      const dep = (nmap.deposits || []).find((d) => d.name.toLowerCase().includes(q));
      if (dep) { nmap.map.flyTo([dep.lat, dep.lng], 9.5, { duration: 1 }); toast(`Located ${dep.name}`); input.blur(); }
      else toast(`No match for "${input.value}"`);
    }
  });

  updateChipStates();
  return { closeMenu, renderCrumbs };
}
