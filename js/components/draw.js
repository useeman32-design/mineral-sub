/**
 * DRAW / MEASURE ENGINE
 * =====================
 * Owns every user-created annotation on the map: measurement lines, radius
 * circles, area polygons and markers.
 *
 * Two rules make this behave like real GIS software:
 *
 *  1. While a draw tool is armed the engine takes exclusive ownership of map
 *     clicks (via NigeriaMap.interceptClicks) AND suppresses state/LGA
 *     selection, so drawing can never trigger a geographic selection or wipe
 *     one that already exists.
 *  2. Shapes are plain serialisable records. Rendering is derived from that
 *     data, so undo/redo and save/load only ever swap the array.
 */

import { measureShape, pathLength, haversine, polygonArea, centroid } from '../core/geo.js';

let SEQ = 0;
const uid = () => `shp-${Date.now().toString(36)}-${(++SEQ).toString(36)}`;

export const TOOL_META = {
  line:    { label: 'Distance', hint: 'Click points · double-click or Enter to finish', color: '#00e676' },
  polygon: { label: 'Area',     hint: 'Click vertices · double-click or Enter to close', color: '#f5b942' },
  circle:  { label: 'Radius',   hint: 'Click centre, then click to set the radius',      color: '#2dd8c3' },
  point:   { label: 'Marker',   hint: 'Click to drop a marker',                          color: '#8b7dff' },
};

export class DrawEngine {
  /**
   * @param {NigeriaMap} nmap
   * @param {object} opts
   * @param {Function} opts.onChange   (shapes, label) committed change -> history
   * @param {Function} opts.onSelect   (shape|null) selection changed
   * @param {Function} opts.onDraft    (draftInfo|null) live feedback while drawing
   * @param {Function} opts.getUnits   () => 'metric' | 'imperial'
   */
  constructor(nmap, { onChange, onSelect, onDraft, getUnits } = {}) {
    this.nmap = nmap;
    this.map = nmap.map;
    this.onChange = onChange || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onDraft = onDraft || (() => {});
    this.getUnits = getUnits || (() => 'metric');

    this.shapes = [];
    this.tool = null;
    this.draft = [];
    this.selectedId = null;

    this._layers = new Map();   // shape id -> leaflet layer group
    this._draftLayers = [];

    this.map.createPane('draw');
    this.map.getPane('draw').style.zIndex = 620;
    this.map.createPane('draw-labels');
    this.map.getPane('draw-labels').style.zIndex = 640;
    this.map.getPane('draw-labels').style.pointerEvents = 'none';

    this._bind();
  }

  /* ------------------------------------------------------------------
     Tool arming — this is what stops measurement clobbering selection
     ------------------------------------------------------------------ */

  setTool(tool) {
    this.cancelDraft();
    this.tool = tool;

    if (tool) {
      // Exclusive click ownership: state, LGA and marker handlers all defer.
      this.nmap.interceptClicks = (latlng) => this._onMapClick(latlng);
      this.nmap.suppressSelection = true;
      this.nmap.root.classList.add('is-drawing');
    } else {
      this.nmap.interceptClicks = null;
      this.nmap.suppressSelection = false;
      this.nmap.root.classList.remove('is-drawing');
    }

    this.onDraft(tool ? { tool, pts: 0, hint: TOOL_META[tool].hint } : null);
    return this.tool;
  }

  _bind() {
    this._onMove = (e) => { if (this.tool && this.draft.length) this._renderDraft(e.latlng); };
    this._onDbl = (e) => {
      if (!this.tool) return;
      L.DomEvent.stop(e);
      this.commitDraft();
    };
    this.map.on('mousemove', this._onMove);
    this.map.on('dblclick', this._onDbl);
  }

  _onMapClick(latlng) {
    if (!this.tool) return;
    const pt = [latlng.lat, latlng.lng];

    if (this.tool === 'point') {
      this.draft = [pt];
      this.commitDraft();
      return;
    }
    if (this.tool === 'circle') {
      this.draft.push(pt);
      if (this.draft.length === 2) { this.commitDraft(); return; }
    } else {
      this.draft.push(pt);
    }

    this._renderDraft();
    this.onDraft({ tool: this.tool, pts: this.draft.length, hint: TOOL_META[this.tool].hint });
  }

  /* ------------------------------------------------------------------
     Draft rendering (live preview before commit)
     ------------------------------------------------------------------ */

  _clearDraftLayers() {
    this._draftLayers.forEach((l) => this.map.removeLayer(l));
    this._draftLayers = [];
  }

  _renderDraft(cursor) {
    this._clearDraftLayers();
    if (!this.draft.length) return;
    const color = TOOL_META[this.tool]?.color || '#00e676';
    const pts = cursor ? [...this.draft, [cursor.lat, cursor.lng]] : [...this.draft];

    if (this.tool === 'circle' && this.draft.length === 1 && cursor) {
      const r = haversine(this.draft[0], [cursor.lat, cursor.lng]);
      this._draftLayers.push(L.circle(this.draft[0], {
        pane: 'draw', radius: r, color, weight: 1.6, dashArray: '5,4',
        fillColor: color, fillOpacity: .07, interactive: false,
      }).addTo(this.map));
      this._pushDraftLabel(this.draft[0], measureShape(
        { type: 'circle', latlngs: [this.draft[0], [cursor.lat, cursor.lng]] }, this.getUnits()
      ).primary);
    } else if (this.tool === 'polygon' && pts.length >= 3) {
      this._draftLayers.push(L.polygon(pts, {
        pane: 'draw', color, weight: 1.6, dashArray: '5,4',
        fillColor: color, fillOpacity: .1, interactive: false,
      }).addTo(this.map));
      this._pushDraftLabel(centroid(pts),
        measureShape({ type: 'polygon', latlngs: pts }, this.getUnits()).primary);
    } else if (pts.length >= 2) {
      this._draftLayers.push(L.polyline(pts, {
        pane: 'draw', color, weight: 2, dashArray: '5,4', interactive: false,
      }).addTo(this.map));
      if (this.tool === 'line') {
        this._pushDraftLabel(pts.at(-1),
          measureShape({ type: 'line', latlngs: pts }, this.getUnits()).primary);
      }
    }

    // vertex handles
    this.draft.forEach((p) => {
      this._draftLayers.push(L.circleMarker(p, {
        pane: 'draw', radius: 3.5, color, fillColor: color, fillOpacity: 1,
        weight: 2, interactive: false,
      }).addTo(this.map));
    });
  }

  _pushDraftLabel(at, text) {
    if (!at) return;
    this._draftLayers.push(L.marker(at, {
      pane: 'draw-labels', interactive: false,
      icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="draw-label is-draft">${text}</div>` }),
    }).addTo(this.map));
  }

  /* ------------------------------------------------------------------
     Commit / cancel
     ------------------------------------------------------------------ */

  commitDraft() {
    const min = { line: 2, polygon: 3, circle: 2, point: 1 }[this.tool] || 2;
    if (this.draft.length < min) return false;

    const shape = {
      id: uid(),
      type: this.tool,
      latlngs: this.draft.map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)]),
      color: TOOL_META[this.tool].color,
      label: this._autoName(this.tool),
      created: Date.now(),
      note: '',
    };

    this.shapes.push(shape);
    this.draft = [];
    this._clearDraftLayers();
    this.render();
    this.select(shape.id);
    this.onChange(this.shapes, `Add ${TOOL_META[shape.type].label.toLowerCase()}`);
    this.onDraft(this.tool ? { tool: this.tool, pts: 0, hint: TOOL_META[this.tool].hint } : null);
    return true;
  }

  cancelDraft() {
    this.draft = [];
    this._clearDraftLayers();
    if (this.tool) this.onDraft({ tool: this.tool, pts: 0, hint: TOOL_META[this.tool].hint });
  }

  _autoName(type) {
    const n = this.shapes.filter((s) => s.type === type).length + 1;
    return `${TOOL_META[type].label} ${n}`;
  }

  /* ------------------------------------------------------------------
     Rendering committed shapes
     ------------------------------------------------------------------ */

  render() {
    this._layers.forEach((g) => this.map.removeLayer(g));
    this._layers.clear();

    this.shapes.forEach((s) => {
      const g = L.layerGroup([], { pane: 'draw' });
      const on = this.selectedId === s.id;
      const w = on ? 3 : 2;
      const opts = { pane: 'draw', color: s.color, weight: w, fillColor: s.color };
      const m = measureShape(s, this.getUnits());
      let main;

      if (s.type === 'line') {
        main = L.polyline(s.latlngs, { ...opts, fillOpacity: 0 });
      } else if (s.type === 'polygon') {
        main = L.polygon(s.latlngs, { ...opts, fillOpacity: on ? .2 : .13 });
      } else if (s.type === 'circle') {
        const r = haversine(s.latlngs[0], s.latlngs[1]);
        main = L.circle(s.latlngs[0], { ...opts, radius: r, fillOpacity: on ? .16 : .09 });
      } else {
        main = L.circleMarker(s.latlngs[0], { ...opts, radius: on ? 7 : 5.5, fillOpacity: 1 });
      }

      main.on('click', (e) => { L.DomEvent.stopPropagation(e); this.select(s.id); });
      main.addTo(g);

      if (on) {
        s.latlngs.forEach((p) => L.circleMarker(p, {
          pane: 'draw', radius: 3.5, color: '#fff', fillColor: s.color,
          fillOpacity: 1, weight: 1.6,
        }).addTo(g));
      }

      const at = s.type === 'polygon' ? centroid(s.latlngs)
        : s.type === 'circle' ? s.latlngs[0]
        : s.type === 'point' ? s.latlngs[0]
        : s.latlngs.at(-1);

      L.marker(at, {
        pane: 'draw-labels', interactive: false,
        icon: L.divIcon({
          className: '', iconSize: [0, 0],
          html: `<div class="draw-label ${on ? 'is-on' : ''}" style="--dc:${s.color}">
                   <b>${s.label}</b><span>${m.primary}</span></div>`,
        }),
      }).addTo(g);

      g.addTo(this.map);
      this._layers.set(s.id, g);
    });
  }

  /* ------------------------------------------------------------------
     Selection + mutation
     ------------------------------------------------------------------ */

  select(id) {
    this.selectedId = id;
    this.render();
    this.onSelect(this.shapes.find((s) => s.id === id) || null);
  }

  clearSelection() {
    this.selectedId = null;
    this.render();
    this.onSelect(null);
  }

  remove(id) {
    const s = this.shapes.find((x) => x.id === id);
    this.shapes = this.shapes.filter((x) => x.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.render();
    this.onSelect(null);
    this.onChange(this.shapes, `Delete ${s ? s.label : 'shape'}`);
  }

  rename(id, label) {
    const s = this.shapes.find((x) => x.id === id);
    if (!s) return;
    s.label = label;
    this.render();
    this.onChange(this.shapes, 'Rename');
  }

  setNote(id, note) {
    const s = this.shapes.find((x) => x.id === id);
    if (!s) return;
    s.note = note;
    this.onChange(this.shapes, 'Edit note');
  }

  clearAll() {
    if (!this.shapes.length) return;
    this.shapes = [];
    this.selectedId = null;
    this.render();
    this.onSelect(null);
    this.onChange(this.shapes, 'Clear all');
  }

  /** Replace the whole collection — used by undo/redo and project load. */
  setShapes(shapes, { keepSelection = false } = {}) {
    this.shapes = (shapes || []).map((s) => ({ ...s }));
    if (!keepSelection || !this.shapes.some((s) => s.id === this.selectedId)) {
      this.selectedId = null;
    }
    this.render();
    this.onSelect(this.shapes.find((s) => s.id === this.selectedId) || null);
  }

  zoomTo(id) {
    const s = this.shapes.find((x) => x.id === id);
    if (!s) return;
    if (s.type === 'point') { this.map.flyTo(s.latlngs[0], 12, { duration: .8 }); return; }
    if (s.type === 'circle') {
      const r = haversine(s.latlngs[0], s.latlngs[1]);
      this.map.flyToBounds(L.latLng(s.latlngs[0]).toBounds(r * 2.4), { duration: .8 });
      return;
    }
    this.map.flyToBounds(L.latLngBounds(s.latlngs).pad(0.25), { duration: .8 });
  }

  measure(shape) { return measureShape(shape, this.getUnits()); }

  destroy() {
    this.map.off('mousemove', this._onMove);
    this.map.off('dblclick', this._onDbl);
    this._clearDraftLayers();
    this._layers.forEach((g) => this.map.removeLayer(g));
    this._layers.clear();
  }
}
