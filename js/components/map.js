/**
 * NIGERIA GIS MAP ENGINE
 * ======================
 * Leaflet-based vector map of Nigeria built for progressive drill-down:
 *
 *   nation → state → LGA → local area → prospect → occurrence
 *
 * Zoom thresholds already gate what renders, so wiring ADM2 (LGA) polygons,
 * satellite tiles, geological rasters and title cadastre later is additive:
 * register another layer in LAYER_SPECS and give it a zoom band.
 */

import { store } from '../core/store.js';
import { HEAT, RESOURCE_META } from '../data/fixtures.js';
import { fmt } from '../core/utils.js';

const NG_CENTER = [9.06, 8.68];
const NG_BOUNDS = L.latLngBounds([3.6, 2.4], [14.3, 15.2]);

/** Zoom bands that will drive future data loading. */
export const ZOOM_BANDS = {
  nation:  [5, 6.9],   // ADM1 outlines + national aggregates
  state:   [7, 8.4],   // state labels, deposit labels, ADM2 hint
  lga:     [8.5, 10.4],// ADM2 polygons + roads (future)
  local:   [10.5, 12.9], // satellite auto-switch + titles + geology (future)
  prospect:[13, 18],   // occurrence detail, drill collars (future)
};

export function zoomBand(z) {
  for (const [k, [a, b]] of Object.entries(ZOOM_BANDS)) if (z >= a && z <= b) return k;
  return z < 5 ? 'nation' : 'prospect';
}

let MAP_SEQ = 0;

export class NigeriaMap {
  constructor(container, { api, onSelect, onHover } = {}) {
    this.uid = 'nmap-' + (++MAP_SEQ);
    container.dataset.nmap = this.uid;
    this.interceptClicks = null;
    this.root = container;
    this.api = api;
    this.onSelect = onSelect || (() => {});
    this.onHover = onHover || (() => {});
    this.layers = {};
    this.stateLayers = new Map();
    this.depMarkers = [];
    this.selected = null;
    this._ready = false;
  }

  async init() {
    const canvas = this.root.querySelector('#map-canvas');

    this.map = L.map(canvas, {
      center: NG_CENTER,
      zoom: 6.1,
      minZoom: 5,
      maxZoom: 16,
      zoomSnap: 0.1,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 140,
      zoomControl: false,
      attributionControl: false,
      maxBounds: NG_BOUNDS.pad(0.55),
      maxBoundsViscosity: 0.7,
      preferCanvas: false,
      fadeAnimation: true,
      zoomAnimation: true,
    });

    // Pane order: graticule < halo < states < heat < deposits < labels
    ['graticule', 'halo', 'states', 'lgas', 'heat', 'deposits', 'labels'].forEach((p, i) => {
      this.map.createPane(p);
      this.map.getPane(p).style.zIndex = 400 + i * 40;
    });
    this.map.getPane('graticule').style.pointerEvents = 'none';
    this.map.getPane('halo').style.pointerEvents = 'none';
    this.map.getPane('heat').style.pointerEvents = 'none';
    this.map.getPane('labels').style.pointerEvents = 'none';

    this._buildGraticule();

    const geo = await this.api.getStateBoundaries();
    this.geo = geo;
    this._buildHalo(geo);
    this._buildStates(geo);
    this._buildStateLabels(geo);

    this._buildHeat();
    const deposits = await this.api.getDeposits();
    this.deposits = deposits;
    this._buildDeposits(deposits);

    this.map.on('zoomend', () => this._onZoom());
    this.map.on('moveend', () => this._declutterLabels());
    this.map.on('mousemove', (e) => this._moveTip(e));
    this.map.on('click', (e) => {
      if (this.interceptClicks) { this.interceptClicks(e.latlng); return; }
      if (!e.originalEvent._stateHit) this.clearSelection();
    });

    this.map.fitBounds(NG_BOUNDS, { padding: [26, 26], animate: false });
    this._onZoom();

    // Re-fit the national extent when the stage resizes (responsive breakpoints,
    // sidebar collapse, fullscreen) so Nigeria is never cropped.
    this._ro = new ResizeObserver(() => {
      clearTimeout(this._rt);
      this._rt = setTimeout(() => {
        this.map.invalidateSize({ animate: false });
        if (!this.selected) this.map.fitBounds(NG_BOUNDS, { padding: [26, 26], animate: false });
        this._declutterLabels();
      }, 140);
    });
    this._ro.observe(this.root);

    // Restyle vectors when the colour theme flips
    this._onTheme = () => {
      this.refreshStateStyles();
      const gcol = getComputedStyle(document.documentElement).getPropertyValue('--map-grid').trim();
      this.layers.graticule?.eachLayer((l) => l.setStyle?.({ color: gcol }));
      if (this._lgaShown) { const c = this._lgaShown; this.hideLgas({ keepRequest: true }); this.showLgas(c); }
    };
    addEventListener('nmi:theme', this._onTheme);

    this._ready = true;
    requestAnimationFrame(() => this.refreshStateStyles());
    return this;
  }

  /* ------------------------------------------------------------------
     Base cartography
     ------------------------------------------------------------------ */

  /** Graticule — fine coordinate grid, a GIS workstation cue. */
  _buildGraticule() {
    const g = L.layerGroup([], { pane: 'graticule' });
    const gcol = getComputedStyle(document.documentElement).getPropertyValue('--map-grid').trim();
    const style = { color: gcol || 'rgba(45,216,195,.1)', weight: 0.5, opacity: 1, interactive: false };
    for (let lat = 4; lat <= 14; lat += 1) {
      L.polyline([[lat, 1.5], [lat, 16]], style).addTo(g);
    }
    for (let lng = 2; lng <= 16; lng += 1) {
      L.polyline([[3, lng], [15, lng]], style).addTo(g);
    }
    this.layers.graticule = g.addTo(this.map);
  }

  /** Soft neon halo tracing the national outline. */
  _buildHalo(geo) {
    const outer = L.geoJSON(geo, {
      pane: 'halo',
      interactive: false,
      style: { color: '#00e676', weight: 9, opacity: 0.05, fill: false, lineJoin: 'round' },
    });
    const mid = L.geoJSON(geo, {
      pane: 'halo',
      interactive: false,
      style: { color: '#2dd8c3', weight: 3.5, opacity: 0.1, fill: false, lineJoin: 'round' },
    });
    this.layers.halo = L.layerGroup([outer, mid]).addTo(this.map);
  }

  /** State polygons — hover + click drive the drill-down. */
  _buildStates(geo) {
    this.layers.states = L.geoJSON(geo, {
      pane: 'states',
      style: (f) => this._stateStyle(f),
      onEachFeature: (f, layer) => {
        const name = f.properties.name;
        this.stateLayers.set(name, layer);
        layer.getElement?.();

        layer.on('mouseover', (e) => {
          if (this.selected !== name) {
            layer.setStyle(this._stateStyle(f, 'hover'));
            layer.bringToFront();
          }
          const path = layer.getElement?.();
          if (path) path.classList.add('ng-state-hover');
          store.set({ hoveredState: name });
          this._showTip(f.properties, e);
          this.onHover(f.properties);
        });

        layer.on('mouseout', (e) => {
          if (this.selected !== name) layer.setStyle(this._stateStyle(f));
          const path = layer.getElement?.();
          if (path) path.classList.remove('ng-state-hover');
          store.set({ hoveredState: null });
          this._hideTip();
          this.onHover(null);
        });

        layer.on('click', (e) => {
          // A consumer (e.g. the measurement tool) can claim raw map clicks.
          if (this.interceptClicks) {
            this.interceptClicks(e.latlng);
            L.DomEvent.stopPropagation(e);
            return;
          }
          e.originalEvent._stateHit = true;
          L.DomEvent.stopPropagation(e);
          this.selectState(name, { zoom: true });
        });
      },
    }).addTo(this.map);
  }

  /**
   * Choropleth by prospectivity — the visual spine of the map.
   * Satellite mode desaturates fills so imagery can read through later.
   */
  _stateStyle(f, mode) {
    const p = f.properties;
    const sat = store.get('basemap') === 'satellite';
    const z = this._ready ? this.map.getZoom() : 6;
    const pros = p.prospectivity ?? 40;
    const t = Math.min(1, Math.max(0, (pros - 25) / 70));

    // Fills recede as you zoom in so imagery / detail is never tinted.
    // Above the LGA band the polygon becomes outline-only.
    const detail = z >= 9.5 ? 0 : z >= 8 ? 0.45 : 1;

    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const cs = getComputedStyle(document.documentElement);
    const land = cs.getPropertyValue('--map-land').trim() || (light ? '232, 240, 240' : '11, 19, 22');
    const [lr, lg, lb] = land.split(',').map((n) => +n);
    // Light theme: prospectivity darkens the land; dark theme: it lightens it.
    const dir = light ? -1 : 1;

    const r = Math.round(lr + dir * t * 26);
    const g = Math.round(lg + dir * t * 20);
    const b = Math.round(lb + dir * t * 6);

    const stroke = getComputedStyle(document.documentElement)
      .getPropertyValue('--map-stroke').trim() || 'rgba(45,216,195,.5)';

    const base = {
      color: sat ? 'rgba(120, 220, 190, .5)' : stroke,
      weight: 0.85,
      opacity: sat ? 0.6 : 0.85,
      fillColor: `rgb(${r},${g},${b})`,
      fillOpacity: sat ? 0 : 0.9 * detail,
      lineJoin: 'round',
      className: 'ng-state',
    };

    if (mode === 'hover') {
      return { ...base,
        color: light ? '#0d9488' : '#5eead4',
        weight: 1.8, opacity: 1,
        fillColor: getComputedStyle(document.documentElement).getPropertyValue('--map-land-hi').trim() || '#16262a',
        fillOpacity: sat ? 0.18 : Math.max(0.22, 0.96 * detail) };
    }
    if (mode === 'selected') {
      // Selection reads as a glowing OUTLINE once zoomed in or over imagery —
      // the green wash never obscures satellite detail.
      const outlineOnly = sat || z >= 7.6 || detail === 0;
      return { ...base,
        color: light ? '#00964e' : '#00e676',
        weight: outlineOnly ? 2.6 : 2.3,
        opacity: 1,
        fillColor: light ? '#d8efe2' : '#0a1a16',
        fillOpacity: outlineOnly ? 0 : 0.55 * detail };
    }
    return base;
  }

  _buildStateLabels(geo) {
    const g = L.layerGroup([], { pane: 'labels' });
    geo.features.forEach((f) => {
      const c = f.properties.centroid;
      if (!c) return;
      const m = L.marker(c, {
        pane: 'labels',
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<div class="state-label">${f.properties.code}</div>`,
          iconSize: [0, 0],
        }),
      });
      m._full = f.properties.name;
      m._code = f.properties.code;
      g.addLayer(m);
    });
    this.layers.stateLabels = g.addTo(this.map);
  }

  /* ------------------------------------------------------------------
     Analytical layers
     ------------------------------------------------------------------ */

  /** Prospectivity heat blooms — layered translucent circles. */
  _buildHeat() {
    const g = L.layerGroup([], { pane: 'heat' });
    HEAT.forEach((h) => {
      const hex = RESOURCE_META[h.resource]?.hex || '#f5b942';
      const base = 46000 * h.w;
      [
        { r: base * 1.9, o: 0.05 },
        { r: base * 1.3, o: 0.08 },
        { r: base * 0.8, o: 0.12 },
        { r: base * 0.42, o: 0.16 },
      ].forEach((ringSpec) => {
        L.circle([h.lat, h.lng], {
          pane: 'heat',
          radius: ringSpec.r,
          stroke: false,
          fillColor: hex,
          fillOpacity: ringSpec.o * h.i,
          interactive: false,
        }).addTo(g);
      });
    });
    this.layers.prospectivity = g.addTo(this.map);
  }

  /** Deposit markers — divIcons so CSS drives pulse + label reveal. */
  _buildDeposits(deposits) {
    const g = L.layerGroup([], { pane: 'deposits' });
    deposits.forEach((d) => {
      const meta = RESOURCE_META[d.resource] || {};
      const hex = meta.hex || '#f5b942';
      const major = d.tier === 'major';

      const html = `
        <div class="dep-marker ${major ? 'is-major' : ''}" style="color:${hex}">
          ${major ? `<span class="dep-ring"></span><span class="dep-ring"></span>` : ''}
          <span class="dep-core" style="background:${hex}"></span>
          <span class="dep-label">${d.name}</span>
        </div>`;

      const m = L.marker([d.lat, d.lng], {
        pane: 'deposits',
        riseOnHover: true,
        icon: L.divIcon({ className: '', html, iconSize: [0, 0], iconAnchor: [0, 0] }),
      });

      m._dep = d;
      m.bindTooltip(this._depTooltip(d, meta), {
        direction: 'top', offset: [0, -10], className: 'dep-tip', opacity: 1,
      });
      m.on('click', (e) => {
        if (this.interceptClicks) { this.interceptClicks(e.latlng); L.DomEvent.stopPropagation(e); return; }
        L.DomEvent.stopPropagation(e);
        e.originalEvent._stateHit = true;
      });
      g.addLayer(m);
      this.depMarkers.push(m);
    });
    this.layers.deposits = g.addTo(this.map);
  }

  _depTooltip(d, meta) {
    return `<div class="dt">
      <div class="dt-hd"><span class="dt-sw" style="background:${meta.hex}"></span>
        <span class="dt-name">${d.name}</span></div>
      <div class="dt-rows">
        <div class="dt-r"><span>Resource</span><b>${meta.label || d.resource}</b></div>
        <div class="dt-r"><span>Status</span><b>${d.status}</b></div>
        <div class="dt-r"><span>State</span><b>${d.state}</b></div>
        <div class="dt-r"><span>Coords</span><b class="t-mono">${fmt.coord(d.lat, d.lng)}</b></div>
      </div>
      <div class="dt-ft">${d.id} · ${d.tier === 'major' ? 'Primary' : 'Secondary'} occurrence</div>
    </div>`;
  }

  /* ------------------------------------------------------------------
     Zoom-driven level of detail (the drill-down scaffold)
     ------------------------------------------------------------------ */
  _onZoom() {
    const z = this.map.getZoom();
    const band = zoomBand(z);
    store.set({ zoom: z, mapBand: band });

    // State codes → full names as you zoom in
    const showFull = z >= 7;
    this.layers.stateLabels?.eachLayer((m) => {
      const node = m.getElement?.()?.querySelector('.state-label');
      if (node) node.textContent = showFull ? m._full : m._code;
      const elx = m.getElement?.();
      if (elx) elx.style.opacity = store.get('showLabels') ? (z >= 5.6 ? 1 : 0) : 0;
    });

    // Marker scale: restrained at national extent, full size when zoomed in
    const mscale = z <= 6.2 ? 0.62 : z <= 7 ? 0.74 : z <= 8 ? 0.88 : 1;
    this.root.style.setProperty('--dep-scale', mscale.toFixed(2));
    this.root.classList.toggle('pulse-off', z <= 6.4);

    // Fills recede with zoom, so restyle states whenever the band changes
    if (this._lastDetailBand !== band) {
      this._lastDetailBand = band;
      this.refreshStateStyles();
    }

    // Reveal LGA (ADM2) polygons inside the LGA band for the active state.
    // An explicit drill request keeps them visible even if the fitted zoom
    // lands slightly outside the band.
    const st = store.get('selectedState');
    const inLgaBand = band === 'lga' || band === 'local' || band === 'prospect';
    if (st?.code && (inLgaBand || this._lgaRequested === st.code)) {
      this.showLgas(st.code);
    } else if (this._lgaShown && !this._lgaRequested) {
      this.hideLgas();
    }

    this._declutterLabels();

    // Heat blooms recede as local detail takes over — at prospect scale the
    // real prospectivity raster replaces them entirely.
    const heatOpacity = z >= 11 ? 0.08 : z >= 9.5 ? 0.18 : z >= 8 ? 0.42 : 1;
    const heatPane = this.map.getPane('heat');
    if (heatPane) heatPane.style.opacity = store.get('layers').prospectivity ? heatOpacity : 0;

    // Graticule densifies visually at depth
    const gp = this.map.getPane('graticule');
    if (gp) gp.style.opacity = z >= 8 ? 0.45 : 1;

    this._emitScale();
  }

  /**
   * Greedy label decluttering: majors claim space first, colliding or
   * off-canvas labels are suppressed. Keeps the map legible while zooming.
   */
  _declutterLabels() {
    const z = this.map.getZoom();
    const show = z >= 7.6;
    const size = this.map.getSize();
    const pad = 8;
    const claimed = [];

    const ordered = [...this.depMarkers].sort((a, b) => {
      const t = (b._dep.tier === 'major') - (a._dep.tier === 'major');
      return t !== 0 ? t : a._dep.name.length - b._dep.name.length;
    });

    ordered.forEach((m) => {
      const node = m.getElement?.()?.querySelector('.dep-marker');
      if (!node) return;

      if (!show || node.parentElement?.style.display === 'none') {
        node.classList.remove('show-label');
        return;
      }
      // Minors only label once zoomed well in
      if (m._dep.tier !== 'major' && z < 9.2) { node.classList.remove('show-label'); return; }

      const p = this.map.latLngToContainerPoint(m.getLatLng());
      const w = 13 + m._dep.name.length * 5.6;  // approx label advance
      const h = 15;
      const box = { x1: p.x + 11, y1: p.y - h / 2, x2: p.x + 11 + w, y2: p.y + h / 2 };

      const offscreen = box.x2 > size.x - pad || box.x1 < pad || box.y1 < pad || box.y2 > size.y - pad;
      const hits = claimed.some((c) => !(box.x2 < c.x1 || box.x1 > c.x2 || box.y2 < c.y1 || box.y1 > c.y2));

      if (offscreen || hits) { node.classList.remove('show-label'); return; }
      claimed.push(box);
      node.classList.add('show-label');
    });
  }

  _emitScale() {
    const z = this.map.getZoom();
    const c = this.map.getCenter();
    const mPerPx = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, z);
    const km = (mPerPx * 88) / 1000;
    const nice = km >= 100 ? Math.round(km / 50) * 50 : km >= 10 ? Math.round(km / 5) * 5 : Math.round(km);
    this.root.dispatchEvent(new CustomEvent('map:scale', {
      detail: { zoom: z, km: nice, band: zoomBand(z) }, bubbles: true,
    }));
  }

  /* ------------------------------------------------------------------
     Selection + drill-down
     ------------------------------------------------------------------ */
  selectState(name, { zoom = false } = {}) {
    // reset previous
    if (this.selected && this.stateLayers.has(this.selected)) {
      const prev = this.stateLayers.get(this.selected);
      prev.setStyle(this._stateStyle(prev.feature));
      prev.getElement?.()?.classList.remove('ng-state-selected');
    }

    if (this.selected === name) { this.clearSelection(); return; }

    this.selected = name;
    const layer = this.stateLayers.get(name);
    if (layer) {
      layer.setStyle(this._stateStyle(layer.feature, 'selected'));
      layer.bringToFront();
      layer.getElement?.()?.classList.add('ng-state-selected');
      if (zoom) {
        this.map.flyToBounds(layer.getBounds(), {
          padding: [70, 70], maxZoom: 8.2, duration: 0.85, easeLinearity: 0.22,
        });
      }
    }

    const props = layer?.feature?.properties || null;
    store.set({
      selectedState: props,
      drill: { level: 'state', nation: 'Nigeria', state: name, lga: null, prospect: null },
    });
    this.onSelect(props);
  }

  clearSelection() {
    this.hideLgas();
    if (this.selected && this.stateLayers.has(this.selected)) {
      const prev = this.stateLayers.get(this.selected);
      prev.setStyle(this._stateStyle(prev.feature));
      prev.getElement?.()?.classList.remove('ng-state-selected');
    }
    this.selected = null;
    store.set({
      selectedState: null,
      drill: { level: 'nation', nation: 'Nigeria', state: null, lga: null, prospect: null },
    });
    this.onSelect(null);
  }

  resetView() {
    this.clearSelection();
    this.map.flyToBounds(NG_BOUNDS, { padding: [26, 26], duration: 0.8 });
  }

  /* ------------------------------------------------------------------
     Layer + filter control (public API used by the toolbar)
     ------------------------------------------------------------------ */
  setBasemap(kind) {
    store.set({ basemap: kind });

    if (kind === 'satellite' && !this.layers.tiles) {
      // Real imagery when the deployment has network access.
      const tiles = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 17, opacity: 0.85, crossOrigin: true }
      );
      tiles.on('tileerror', () => {
        // Offline / blocked: fall back to the synthetic terrain treatment.
        this.root.classList.add('sat-fallback');
      });
      tiles.addTo(this.map);
      tiles.getContainer().style.filter = 'saturate(.62) brightness(.58) contrast(1.12)';
      this.layers.tiles = tiles;
    } else if (kind !== 'satellite' && this.layers.tiles) {
      this.map.removeLayer(this.layers.tiles);
      this.layers.tiles = null;
      this.root.classList.remove('sat-fallback');
    }

    this.root.classList.toggle('is-satellite', kind === 'satellite');
    this.refreshStateStyles();
    if (this._lgaShown) { const c = this._lgaShown; this.hideLgas({ keepRequest: true }); this.showLgas(c); }
  }

  toggleLayer(id, on) {
    const layers = { ...store.get('layers'), [id]: on };
    store.set({ layers });

    if (id === 'deposits') this._setLayerVisible(this.layers.deposits, on);
    if (id === 'prospectivity') {
      const pane = this.map.getPane('heat');
      if (pane) { this._onZoom(); if (!on) pane.style.opacity = 0; }
    }
    if (id === 'graticule') this._setLayerVisible(this.layers.graticule, on);
  }

  _setLayerVisible(layer, on) {
    if (!layer) return;
    if (on) layer.addTo(this.map); else this.map.removeLayer(layer);
  }

  setLabels(on) {
    store.set({ showLabels: on });
    this._onZoom();
  }

  /** Resource filter — hides markers + recolours nothing else. */
  filterResources(list) {
    const set = new Set(list);
    this.depMarkers.forEach((m) => {
      const visible = set.has(m._dep.resource);
      const node = m.getElement?.();
      if (node) { node.style.display = visible ? '' : 'none'; }
    });
    const f = { ...store.get('filters'), resources: list };
    store.set({ filters: f });
    this._declutterLabels();
  }

  /** Prospectivity filter — dims states outside the band. */
  filterProspectivity(level) {
    const f = { ...store.get('filters'), prospectivity: level };
    store.set({ filters: f });
    this.stateLayers.forEach((layer, name) => {
      const p = layer.feature.properties.prospectivity ?? 0;
      const pass = level === 'all' || (level === 'high' && p >= 75) || (level === 'moderate' && p >= 50 && p < 75);
      const base = this._stateStyle(layer.feature, this.selected === name ? 'selected' : undefined);
      layer.setStyle(pass ? base : { ...base, fillColor: '#080d0f', opacity: 0.16 });
    });
  }

  /** Risk filter — outlines states in the chosen risk class. */
  filterRisk(level) {
    const f = { ...store.get('filters'), risk: level };
    store.set({ filters: f });
    const RISK_COLOR = { high: '#ff4d5e', medium: '#ff8a3d', low: '#00e676' };
    this.stateLayers.forEach((layer, name) => {
      const risk = layer.feature.properties.risk;
      const base = this._stateStyle(layer.feature, this.selected === name ? 'selected' : undefined);
      if (level === 'all') { layer.setStyle(base); return; }
      const match = risk === level;
      layer.setStyle(match
        ? { ...base, color: RISK_COLOR[level], weight: 2, opacity: 1,
            fillColor: RISK_COLOR[level], fillOpacity: 0.16 }
        : { ...base, fillColor: '#080d0f', opacity: 0.14 });
    });
  }

  refreshStateStyles() {
    this.stateLayers.forEach((layer, name) => {
      layer.setStyle(this._stateStyle(layer.feature, this.selected === name ? 'selected' : undefined));
    });
  }

  zoomBy(d) { this.map.setZoom(this.map.getZoom() + d); }
  invalidate() { this.map?.invalidateSize({ animate: false }); }


  /* ------------------------------------------------------------------
     LGA (ADM2) layer — lazily fetched per state, cached in memory
     ------------------------------------------------------------------ */

  async loadLgas(stateCode) {
    if (!stateCode) return null;
    if (this._lgaCache?.[stateCode]) return this._lgaCache[stateCode];
    this._lgaCache = this._lgaCache || {};
    try {
      const res = await fetch(`data/lga/${stateCode}.geojson`);
      if (!res.ok) throw new Error('LGA fetch ' + res.status);
      const geo = await res.json();
      this._lgaCache[stateCode] = geo;
      return geo;
    } catch (err) {
      console.warn('[NMI] LGA layer unavailable for', stateCode, err);
      return null;
    }
  }

  async showLgas(stateCode, { explicit = false } = {}) {
    if (explicit) this._lgaRequested = stateCode;
    if (this._lgaShown === stateCode) return;
    const geo = await this.loadLgas(stateCode);
    this.hideLgas({ keepRequest: true });
    if (!geo) return;

    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const sat = store.get('basemap') === 'satellite';

    this.layers.lgas = L.geoJSON(geo, {
      pane: 'lgas',
      style: () => ({
        color: light ? 'rgba(13,148,136,.62)' : 'rgba(94,234,212,.5)',
        weight: 0.7,
        opacity: 0.85,
        dashArray: '2,3',
        fillColor: light ? '#dcebe8' : '#0e191d',
        fillOpacity: sat ? 0 : 0.34,
        className: 'ng-lga',
      }),
      onEachFeature: (f, layer) => {
        layer.on('mouseover', (e) => {
          layer.setStyle({ weight: 1.5, dashArray: null,
            color: light ? '#00964e' : '#00e676',
            fillOpacity: sat ? 0.14 : 0.5 });
          layer.bringToFront();
          this._showLgaTip(f.properties, e);
        });
        layer.on('mouseout', () => {
          this.layers.lgas.resetStyle(layer);
          this._hideTip();
        });
        layer.on('click', (e) => {
          if (this.interceptClicks) { this.interceptClicks(e.latlng); L.DomEvent.stopPropagation(e); return; }
          e.originalEvent._stateHit = true;
          L.DomEvent.stopPropagation(e);
          this.selectLga(f.properties, layer);
        });
      },
    }).addTo(this.map);

    // LGA name labels
    this.layers.lgaLabels = L.layerGroup([], { pane: 'labels' });
    geo.features.forEach((f) => {
      const c = f.properties.centroid;
      if (!c) return;
      L.marker(c, {
        pane: 'labels', interactive: false,
        icon: L.divIcon({ className: '', iconSize: [0, 0],
          html: `<div class="lga-label">${f.properties.name}</div>` }),
      }).addTo(this.layers.lgaLabels);
    });
    this.layers.lgaLabels.addTo(this.map);

    this._lgaShown = stateCode;
    this.root.dispatchEvent(new CustomEvent('map:lgas', {
      detail: { code: stateCode, count: geo.features.length }, bubbles: true }));
  }

  hideLgas({ keepRequest = false } = {}) {
    if (!keepRequest) this._lgaRequested = null;
    if (this.layers.lgas) { this.map.removeLayer(this.layers.lgas); this.layers.lgas = null; }
    if (this.layers.lgaLabels) { this.map.removeLayer(this.layers.lgaLabels); this.layers.lgaLabels = null; }
    this._lgaShown = null;
    this._selectedLga = null;
  }

  selectLga(props, layer) {
    this._selectedLga = props.name;
    if (this._lgaSelLayer) this.layers.lgas?.resetStyle(this._lgaSelLayer);
    this._lgaSelLayer = layer;
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    layer.setStyle({ weight: 2.2, dashArray: null,
      color: light ? '#00964e' : '#00e676', fillOpacity: 0 });
    layer.bringToFront();

    const d = store.get('drill');
    store.set({ drill: { ...d, level: 'lga', lga: props.name } });
    this.map.flyToBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 11, duration: .7 });
  }

  _showLgaTip(props, e) {
    if (!this.tip) {
      this.tip = document.createElement('div');
      this.tip.className = 'state-tip';
      this.root.appendChild(this.tip);
    }
    this.tip.innerHTML = `
      <div class="st-name">${props.name}<span class="st-code">LGA</span></div>
      <div class="st-rows">
        <div class="st-row"><span class="k">State</span><span class="v">${props.state}</span></div>
        <div class="st-row"><span class="k">Centroid</span><span class="v t-mono">${fmt.coord(props.centroid[0], props.centroid[1])}</span></div>
      </div>
      <div class="st-hint">Click to focus this LGA</div>`;
    this.tip.classList.add('is-on');
    this._moveTip(e);
  }

  /* ------------------------------------------------------------------
     Hover tooltip
     ------------------------------------------------------------------ */
  _showTip(props, e) {
    if (!this.tip) {
      this.tip = document.createElement('div');
      this.tip.className = 'state-tip';
      this.root.appendChild(this.tip);
    }
    const chips = (props.commodities || []).slice(0, 3).map((c) => {
      const m = RESOURCE_META[c] || {};
      return `<span class="st-chip" style="color:${m.hex};background:${m.hex}1a;border:1px solid ${m.hex}3d">${m.label || c}</span>`;
    }).join('');

    const riskColor = { high: 'var(--red)', medium: 'var(--orange)', low: 'var(--green)' }[props.risk];

    this.tip.innerHTML = `
      <div class="st-name">${props.name}<span class="st-code">${props.code}</span></div>
      <div class="st-rows">
        <div class="st-row"><span class="k">Occurrences</span><span class="v">${fmt.int(props.occurrences || 0)}</span></div>
        <div class="st-row"><span class="k">Prospectivity</span><span class="v" style="color:var(--gold)">${props.prospectivity}/100</span></div>
        <div class="st-row"><span class="k">Risk</span><span class="v" style="color:${riskColor};text-transform:capitalize">${props.risk}</span></div>
        <div class="st-row"><span class="k">Titles</span><span class="v">${fmt.int(props.titles || 0)}</span></div>
      </div>
      <div class="st-chips">${chips}</div>
      <div class="st-hint">Click to drill into LGAs</div>`;
    this.tip.classList.add('is-on');
    this._moveTip(e);
  }

  _moveTip(e) {
    if (!this.tip || !this.tip.classList.contains('is-on')) return;
    const r = this.root.getBoundingClientRect();
    const pt = e.containerPoint || this.map.mouseEventToContainerPoint(e.originalEvent);
    let x = pt.x + 16, y = pt.y + 16;
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    if (x + tw > r.width - 12) x = pt.x - tw - 16;
    if (y + th > r.height - 12) y = pt.y - th - 16;
    this.tip.style.transform = `translate(${x}px, ${y}px)`;
  }

  _hideTip() { this.tip?.classList.remove('is-on'); }

  destroy() {
    this._ro?.disconnect();
    removeEventListener('nmi:theme', this._onTheme);
    clearTimeout(this._rt);
    this.map?.remove();
  }
}
