/**
 * Floating map control surface: search, filters, layers, zoom, basemap,
 * legend, drill breadcrumb and scale bar. Kept separate from the map engine
 * so the Explore Map module can reuse it with a different configuration.
 */

import { icon } from '../core/icons.js?v=5814b22';
import { store } from '../core/store.js?v=5814b22';
import { $, $$ } from '../core/utils.js?v=5814b22';
import { RESOURCE_META } from '../data/fixtures.js?v=5814b22';
import { LAYER_GROUPS, applyLayer } from '../data/layers.js?v=5814b22';
import { createLegend, LEGEND_RESOURCES } from '../components/legend.js?v=5814b22';
import { createStatusBar } from '../components/statusbar.js?v=5814b22';
import { toast } from '../modules/dashboard.js?v=5814b22';

const RESOURCES = LEGEND_RESOURCES;

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
        <span class="filters-count" id="filters-count">0</span>
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
    </div>
    <div class="glass-bar tool-stack">
      <button class="tool-btn" data-tool="reset"  title="Reset to national view">${icon('crosshair', { size: 15 })}</button>
      <button class="tool-btn" data-tool="labels" title="Toggle labels">${icon('eye', { size: 15 })}</button>
      <button class="tool-btn" data-tool="measure" title="Measure distance">${icon('ruler', { size: 15 })}</button>
      <button class="tool-btn" data-tool="full"   title="Fullscreen map">${icon('fullscreen', { size: 15 })}</button>
    </div>`;
  stage.appendChild(tools);

  const legendCtl = createLegend(stage, {
    scope: 'overview',
    getActive: () => store.get('filters').resources,
    onToggle: (list) => { nmap.filterResources(list); updateChipStates(); },
  });
  const legend = legendCtl.el;

  const statusBar = createStatusBar(stage, nmap);

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
      const items = [];
      LAYER_GROUPS.forEach((g, gi) => {
        if (gi) items.push({ sep: true, id: `sep-${gi}`, label: g.group });
        g.items.forEach((it) => items.push({
          id: it.id,
          label: it.label,
          swatch: it.color,
          on: it.soon ? false : (L[it.id] ?? it.def),
          soon: it.soon,
        }));
      });
      return {
        title: 'Map Layers',
        items,
        onPick: (id, item) => {
          if (item.sep) return true;
          applyLayer(nmap, id, !item.on, { store, toast });
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
      ${spec.items.map((it) => it.sep ? `<div class="menu-group">${it.label}</div>` : `
        <button class="menu-item ${it.on ? 'is-on' : ''}" data-id="${it.id}"
          role="menuitemcheckbox" aria-checked="${!!it.on}">
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

      // Always read current state — never the snapshot taken at build time.
      const live = MENUS[key]();
      const item = live.items.find((x) => x.id === b.dataset.id) || {};
      const keep = live.onPick(b.dataset.id, item);

      if (keep) {
        const fresh = MENUS[key]();
        fresh.items.forEach((it) => {
          const n = node.querySelector(`.menu-item[data-id="${it.id}"]`);
          if (n) {
            n.classList.toggle('is-on', !!it.on);
            n.setAttribute('aria-checked', String(!!it.on));
          }
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
    badge.textContent = n;
    badge.classList.toggle('is-zero', n === 0);
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
      b.classList.toggle('is-off', !on);
    }
    if (t === 'measure') {
      // Not implemented yet — flash, don't latch into an active state.
      b.classList.add('is-pending');
      setTimeout(() => b.classList.remove('is-pending'), 600);
      toast('Measurement tool ships with the Explore Map module');
    }
    if (t === 'full') {
      // Request/exit only — the active state is driven by fullscreenchange
      // below, so ESC or an OS-level exit can't leave the button stuck on.
      if (!document.fullscreenElement) {
        (stage.requestFullscreen?.() || Promise.reject()).catch(() => {
          toast('Fullscreen was blocked by the browser');
        });
      } else {
        document.exitFullscreen?.();
      }
    }
  });

  /* ---------- fullscreen: reflect the real document state ---------- */
  const fullBtn = $('[data-tool="full"]', tools);
  function syncFullscreen() {
    const on = document.fullscreenElement === stage;
    fullBtn.classList.toggle('is-on', on);
    fullBtn.title = on ? 'Exit fullscreen' : 'Fullscreen map';
    stage.classList.toggle('is-fullscreen', on);
    // Leaflet must remeasure after the viewport changes
    setTimeout(() => nmap.invalidate(), 60);
  }
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();

  const syncLegend = (list) => legendCtl.sync(list);

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
  return { closeMenu, legend: legendCtl, statusBar };
}
