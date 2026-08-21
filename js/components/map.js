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

import { store } from '../core/store.js?v=db4eb0f';
import { HEAT, RESOURCE_META } from '../data/fixtures.js?v=db4eb0f';
import { fmt } from '../core/utils.js?v=db4eb0f';

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

/** Ray-casting point-in-polygon over GeoJSON geometry. */
function pointInFeature(x, y, geom) {
  const rings = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of rings) {
    if (!inRing(x, y, poly[0])) continue;
    if (!poly.slice(1).some((h) => inRing(x, y, h))) return true;
  }
  return false;
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-15) + xi) inside = !inside;
  }
  return inside;
}

export class NigeriaMap {
  constructor(container, { api, onSelect, onHover, onLgaSelect } = {}) {
    this.uid = 'nmap-' + (++MAP_SEQ);
    container.dataset.nmap = this.uid;
    this.interceptClicks = null;
    this.suppressSelection = false;
    this.root = container;
    this.api = api;
    this.onSelect = onSelect || (() => {});
    this.onHover = onHover || (() => {});
    this.onLgaSelect = onLgaSelect || null;
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
    const PANE_Z = {
      graticule: 400, halo: 420, states: 440,
      lgas: 460,          // above states so LGA clicks win
      risk: 470,          // risk tint above fills, below heat/deposits
      heat: 500,
      titles: 505,        // licensed blocks beneath observed workings
      infra: 470,         // roads under the analytical layers
      conflicts: 512,     // flagged licences above the plain cadastre
      footprints: 520,    // observed workings under the occurrence pins
      deposits: 540, sites: 550, labels: 580,
    };
    Object.entries(PANE_Z).forEach(([p, z]) => {
      this.map.createPane(p);
      this.map.getPane(p).style.zIndex = z;
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
      // While a draw tool is armed, background clicks must not wipe the
      // current state/LGA selection.
      if (this.suppressSelection) return;
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
        // Only reclaim the national extent when nothing else owns the view:
        // no selected state and no deliberate focus from another module.
        if (!this.selected && !this._viewLocked) {
          this.map.fitBounds(NG_BOUNDS, { padding: [26, 26], animate: false });
        }
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
    this._geo = geo;
    this.layers.states = L.geoJSON(geo, {
      pane: 'states',
      style: (f) => this._stateStyle(f),
      onEachFeature: (f, layer) => {
        const name = f.properties.name;
        this.stateLayers.set(name, layer);
        layer.getElement?.();

        layer.on('mouseover', (e) => {
          if (this.suppressSelection) return;
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
          if (this.suppressSelection) { L.DomEvent.stopPropagation(e); return; }
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

    // Reveal LGA (ADM2) polygons once inside the LGA band. If no state is
    // selected we resolve whichever state is under the current view centre,
    // so zooming into any state loads its local governments.
    const inLgaBand = z >= 8.5;
    if (inLgaBand) {
      const st = store.get('selectedState');
      const code = st?.code || this._stateAtCentre()?.code;
      if (code) this.showLgas(code);
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

  /** State whose polygon contains the current view centre (for LGA autoload). */
  _stateAtCentre() {
    const c = this.map.getCenter();
    for (const [name, layer] of this.stateLayers) {
      const b = layer.getBounds();
      if (!b.contains(c)) continue;
      const f = layer.feature;
      if (pointInFeature(c.lng, c.lat, f.geometry)) return f.properties;
    }
    return null;
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
    this._viewLocked = false;
    this.emphasiseLga(null);
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
    if (id === 'risk') this.setRiskZones(on);
    if (id === 'footprints') this.setFootprints(on);
    if (id === 'sites') this.setMineralSites(on);
    if (id === 'titles') this.setTitleBlocks(on);
    if (id === 'conflicts') this.setConflicts(on);
    if (id === 'infra') this.setRoads(on);
  }

  /**
   * Dim every LGA except one, so a handoff that names a single LGA reads as
   * "this one" rather than "all of them". Passing null clears the emphasis.
   */
  emphasiseLga(name) {
    this._emphasisedLga = name || null;
    if (!this.layers.lgas) return;
    this.layers.lgas.eachLayer((l) => {
      const isTarget = !name || l.feature.properties.name === name;
      const el = l.getElement?.();
      if (el) el.classList.toggle('lga-dim', !isTarget);
      if (isTarget && name) {
        l.setStyle({ weight: 2.2, opacity: 1, fillOpacity: 0.4 });
        l.bringToFront();
      }
    });
  }

  /**
   * Risk-zone overlay — states tinted by advisory level.
   * Built lazily on first enable, then shown/hidden.
   */
  setRiskZones(on) {
    if (!on) {
      if (this.layers.risk) this.map.removeLayer(this.layers.risk);
      this.root.classList.remove('risk-active');
      return;
    }
    if (!this.layers.risk) {
      const COLORS = { high: '#ff4d5e', medium: '#ff8a3d', low: '#00e676' };
      this.layers.risk = L.geoJSON(this._geo, {
        pane: 'risk',
        interactive: false,
        style: (f) => {
          const c = COLORS[f.properties.risk] || '#64787c';
          return {
            color: c, weight: 1.2, opacity: 0.75,
            fillColor: c, fillOpacity: 0.2,
            className: `ng-risk ng-risk-${f.properties.risk}`,
          };
        },
      });
    }
    this.layers.risk.addTo(this.map);
    this.root.classList.add('risk-active');
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

  /** Serialisable camera position — stored with saved projects. */
  getView() {
    const c = this.map.getCenter();
    return { lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5), zoom: +this.map.getZoom().toFixed(2) };
  }

  setView(v) {
    if (!v) return;
    this.map.setView([v.lat, v.lng], v.zoom, { animate: false });
  }
  invalidate() { this.map?.invalidateSize({ animate: false }); }

  /**
   * Pin the current view so the responsive re-fit cannot reclaim it.
   * Cross-module handoffs use this; resetView() and clearSelection() release it.
   */
  lockView(on = true) { this._viewLocked = on; }


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
          if (this.suppressSelection) { L.DomEvent.stopPropagation(e); return; }
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

    this.layers.lgas.bringToFront();
    this._lgaShown = stateCode;
    this.root.classList.add('lga-active');
    this.root.dispatchEvent(new CustomEvent('map:lgas', {
      detail: { code: stateCode, count: geo.features.length }, bubbles: true }));
  }

  hideLgas({ keepRequest = false } = {}) {
    if (!keepRequest) this._lgaRequested = null;
    if (this.layers.lgas) { this.map.removeLayer(this.layers.lgas); this.layers.lgas = null; }
    if (this.layers.lgaLabels) { this.map.removeLayer(this.layers.lgaLabels); this.layers.lgaLabels = null; }
    this._lgaShown = null;
    this._selectedLga = null;
    this.root.classList.remove('lga-active');
  }

  selectLga(props, layer) {
    this._selectedLga = props.name;
    this.onLgaSelect?.(props);
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

  /**
   * Satellite-mapped mining footprints (Maus et al. / OSM, ODbL).
   * These are observed workings on the ground, not licence boundaries — the
   * cadastre has no geometry, so this is the closest honest thing we can draw.
   */
  async setFootprints(on) {
    if (!on) { this._setLayerVisible(this.layers.footprints, false); return; }
    if (this.layers.footprints) { this._setLayerVisible(this.layers.footprints, true); return; }

    const { loadFootprints } = await import('../data/live.js?v=db4eb0f');
    const fc = await loadFootprints();
    this.layers.footprints = L.geoJSON(fc, {
      pane: 'footprints',
      style: { color: '#ff8a3d', weight: 1, fillColor: '#ff8a3d', fillOpacity: 0.35 },
      onEachFeature: (ft, layer) => {
        const p = ft.properties;
        layer.bindTooltip(
          `<div class="dt">
            <div class="dt-hd"><span class="dt-sw" style="background:#ff8a3d"></span>
              <span class="dt-name">Mining footprint</span></div>
            <div class="dt-rows">
              <div class="dt-r"><span>Area</span><b>${p.areaKm2} km²</b></div>
              <div class="dt-r"><span>LGA</span><b>${p.lga || '—'}</b></div>
              <div class="dt-r"><span>State</span><b>${p.state}</b></div>
              <div class="dt-r"><span>Source</span><b>Satellite survey</b></div>
            </div>
          </div>`,
          { direction: 'top', className: 'dep-tip', opacity: 1 });
      },
    }).addTo(this.map);
  }

  /**
   * Licensed cadastre blocks from the MCO GeoServer — 11,706 polygons.
   *
   * Rendered on a CANVAS renderer, not SVG. At this count SVG produces tens of
   * thousands of DOM nodes and freezes the tab; canvas draws them in one pass.
   * Colour encodes licence type so the map reads without opening anything.
   */
  async setTitleBlocks(on) {
    if (!on) { this._setLayerVisible(this.layers.titles, false); return; }
    if (this.layers.titles) { this._setLayerVisible(this.layers.titles, true); return; }

    const { loadTitlePolygons, loadTitleAttributes } = await import('../data/live.js?v=db4eb0f');
    const [fc, attrs] = await Promise.all([loadTitlePolygons(), loadTitleAttributes()]);
    this._titleAttrs = attrs.titles || {};

    // Two-letter prefix of the licence type, set when the extract was built.
    const TYPE_COLOR = {
      Ex: '#8b7dff',  // Exploration Licence
      Sm: '#2dd8c3',  // Small Scale Mining Lease
      Qu: '#f5b942',  // Quarry Lease
      Mi: '#ff4d5e',  // Mining Lease
      Wa: '#4d9dff',  // Water Use Permit
    };

    if (!this._titleCanvas) this._titleCanvas = L.canvas({ pane: 'titles', padding: 0.3 });

    this.layers.titles = L.geoJSON(fc, {
      pane: 'titles',
      renderer: this._titleCanvas,
      style: (ft) => {
        const c = TYPE_COLOR[ft.properties.t] || '#8b7dff';
        return { color: c, weight: 0.7, opacity: 0.85, fillColor: c, fillOpacity: 0.18 };
      },
      onEachFeature: (ft, layer) => {
        layer.on('click', (e) => {
          if (this.interceptClicks) { this.interceptClicks(e.latlng); L.DomEvent.stopPropagation(e); return; }
          L.DomEvent.stopPropagation(e);
          e.originalEvent._stateHit = true;
          const a = this._titleAttrs[ft.properties.l];
          if (a) this.onTitleSelect?.({ lic: ft.properties.l, ...a });
        });
        layer.on('mouseover', () => {
          const a = this._titleAttrs[ft.properties.l];
          if (!a) return;
          const c = TYPE_COLOR[ft.properties.t] || '#8b7dff';
          layer.bindTooltip(
            `<div class="dt">
              <div class="dt-hd"><span class="dt-sw" style="background:${c}"></span>
                <span class="dt-name">${ft.properties.l}</span></div>
              <div class="dt-rows">
                <div class="dt-r"><span>Type</span><b>${a.type || '—'}</b></div>
                <div class="dt-r"><span>Holder</span><b>${(a.holder || '—').slice(0, 34)}</b></div>
                <div class="dt-r"><span>Minerals</span><b>${(a.minerals || '—').slice(0, 34)}</b></div>
                <div class="dt-r"><span>Area</span><b>${a.areaKm2} km²</b></div>
                <div class="dt-r"><span>Expires</span><b>${a.expiry || '—'}</b></div>
                ${a.litigation ? '<div class="dt-r"><span>Status</span><b style="color:#ff4d5e">In litigation</b></div>' : ''}
              </div>
            </div>`,
            { direction: 'top', className: 'dep-tip', opacity: 1, sticky: true }).openTooltip();
        });
      },
    }).addTo(this.map);
  }

  /**
   * Licences that intersect a protected area. Drawn from the same cadastre
   * geometry, filtered to the flagged licence numbers, in red.
   */
  async setConflicts(on) {
    if (!on) { this._setLayerVisible(this.layers.conflicts, false); return; }
    if (this.layers.conflicts) { this._setLayerVisible(this.layers.conflicts, true); return; }

    const { loadTitlePolygons, loadOverlap, loadTitleAttributes } =
      await import('../data/live.js?v=db4eb0f');
    const [fc, ov, attrs] = await Promise.all([loadTitlePolygons(), loadOverlap(), loadTitleAttributes()]);
    const flagged = new Map();
    (ov.protectedConflicts || []).forEach((c) => {
      if (!flagged.has(c.lic)) flagged.set(c.lic, []);
      flagged.get(c.lic).push(c);
    });
    const A = attrs.titles || {};

    if (!this._conflictCanvas) this._conflictCanvas = L.canvas({ pane: 'conflicts', padding: 0.3 });

    this.layers.conflicts = L.geoJSON(
      { type: 'FeatureCollection',
        features: fc.features.filter((f) => flagged.has(f.properties.l)) },
      {
        pane: 'conflicts',
        renderer: this._conflictCanvas,
        style: { color: '#ff4d5e', weight: 1.1, opacity: 0.95, fillColor: '#ff4d5e', fillOpacity: 0.3 },
        onEachFeature: (ft, layer) => {
          layer.on('mouseover', () => {
            const rows = flagged.get(ft.properties.l) || [];
            const a = A[ft.properties.l] || {};
            layer.bindTooltip(
              `<div class="dt">
                <div class="dt-hd"><span class="dt-sw" style="background:#ff4d5e"></span>
                  <span class="dt-name">${ft.properties.l}</span></div>
                <div class="dt-rows">
                  <div class="dt-r"><span>Conflict</span><b style="color:#ff4d5e">Inside protected area</b></div>
                  <div class="dt-r"><span>Area</span><b>${rows.map((r) => r.park).join(', ').slice(0, 40)}</b></div>
                  <div class="dt-r"><span>Designation</span><b>${rows[0]?.designation || '—'}</b></div>
                  <div class="dt-r"><span>Holder</span><b>${(a.holder || '—').slice(0, 32)}</b></div>
                  <div class="dt-r"><span>Type</span><b>${a.type || '—'}</b></div>
                </div>
              </div>`,
              { direction: 'top', className: 'dep-tip', opacity: 1, sticky: true }).openTooltip();
          });
        },
      }).addTo(this.map);
  }

  /** Major road network (motorway + trunk) from OpenStreetMap. */
  async setRoads(on) {
    if (!on) { this._setLayerVisible(this.layers.infra, false); return; }
    if (this.layers.infra) { this._setLayerVisible(this.layers.infra, true); return; }
    const { loadRoads } = await import('../data/live.js?v=db4eb0f');
    const fc = await loadRoads();
    if (!this._roadCanvas) this._roadCanvas = L.canvas({ pane: 'infra', padding: 0.3 });
    this.layers.infra = L.geoJSON(fc, {
      pane: 'infra',
      renderer: this._roadCanvas,
      style: (ft) => ({
        color: ft.properties.c === 'm' ? '#c8d4d8' : '#7d8f96',
        weight: ft.properties.c === 'm' ? 1.4 : 0.8,
        opacity: 0.7, fill: false,
      }),
    }).addTo(this.map);
  }

  /** Georeferenced mineral sites — USGS minfac + MRDS + OSM. */
  async setMineralSites(on) {
    if (!on) { this._setLayerVisible(this.layers.sites, false); return; }
    if (this.layers.sites) { this._setLayerVisible(this.layers.sites, true); return; }

    const { loadMineralSites } = await import('../data/live.js?v=db4eb0f');
    const data = await loadMineralSites();
    const g = L.layerGroup([], { pane: 'sites' });
    (data.sites || []).forEach((d) => {
      const m = L.circleMarker([d.lat, d.lng], {
        pane: 'sites', radius: 4, weight: 1.4,
        color: '#4d9dff', fillColor: '#4d9dff', fillOpacity: 0.55,
      });
      m.bindTooltip(
        `<div class="dt">
          <div class="dt-hd"><span class="dt-sw" style="background:#4d9dff"></span>
            <span class="dt-name">${d.name}</span></div>
          <div class="dt-rows">
            ${d.commodity ? `<div class="dt-r"><span>Commodity</span><b>${d.commodity}</b></div>` : ''}
            ${d.status ? `<div class="dt-r"><span>Status</span><b>${d.status}</b></div>` : ''}
            <div class="dt-r"><span>LGA</span><b>${d.lga || '—'}</b></div>
            <div class="dt-r"><span>State</span><b>${d.state}</b></div>
            <div class="dt-r"><span>Source</span><b>${d.source}</b></div>
          </div>
        </div>`,
        { direction: 'top', className: 'dep-tip', opacity: 1 });
      g.addLayer(m);
    });
    this.layers.sites = g.addTo(this.map);
  }
}
