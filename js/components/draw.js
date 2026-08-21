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

import { measureShape, pathLength, haversine, polygonArea, centroid } from '../core/geo.js?v=4f964c1';

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
    this.map.getPane('draw').style.zIndex = 700;
    this.map.createPane('draw-labels');
    this.map.getPane('draw-labels').style.zIndex = 720;
    this.map.getPane('draw-labels').style.pointerEvents = 'none';

    // Dedicated renderer, otherwise Leaflet shares one SVG root and the data
    // layers keep intercepting pointer events aimed at drawn shapes.
    this.renderer = L.svg({ pane: 'draw' });

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
        pane: 'draw', renderer: this.renderer, radius: r, color, weight: 1.6, dashArray: '5,4',
        fillColor: color, fillOpacity: .07, interactive: false,
      }).addTo(this.map));
      this._pushDraftLabel(this.draft[0], measureShape(
        { type: 'circle', latlngs: [this.draft[0], [cursor.lat, cursor.lng]] }, this.getUnits()
      ).primary);
    } else if (this.tool === 'polygon' && pts.length >= 3) {
      this._draftLayers.push(L.polygon(pts, {
        pane: 'draw', renderer: this.renderer, color, weight: 1.6, dashArray: '5,4',
        fillColor: color, fillOpacity: .1, interactive: false,
      }).addTo(this.map));
      this._pushDraftLabel(centroid(pts),
        measureShape({ type: 'polygon', latlngs: pts }, this.getUnits()).primary);
    } else if (pts.length >= 2) {
      this._draftLayers.push(L.polyline(pts, {
        pane: 'draw', renderer: this.renderer, color, weight: 2, dashArray: '5,4', interactive: false,
      }).addTo(this.map));
      if (this.tool === 'line') {
        this._pushDraftLabel(pts.at(-1),
          measureShape({ type: 'line', latlngs: pts }, this.getUnits()).primary);
      }
    }

    // vertex handles
    this.draft.forEach((p) => {
      this._draftLayers.push(L.circleMarker(p, {
        pane: 'draw', renderer: this.renderer, radius: 3.5, color, fillColor: color, fillOpacity: 1,
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
    this._layers.forEach((rec) => this.map.removeLayer(rec.group));
    this._layers.clear();

    this.shapes.forEach((s) => {
      const group = L.layerGroup([], { pane: 'draw' });
      const on = this.selectedId === s.id;
      const m = measureShape(s, this.getUnits());
      const opts = { pane: 'draw', renderer: this.renderer, color: s.color, weight: on ? 3 : 2, fillColor: s.color };
      let main;

      if (s.type === 'line') {
        main = L.polyline(s.latlngs, { ...opts, fillOpacity: 0 });
      } else if (s.type === 'polygon') {
        main = L.polygon(s.latlngs, { ...opts, fillOpacity: on ? .2 : .13 });
      } else if (s.type === 'circle') {
        main = L.circle(s.latlngs[0], { ...opts, radius: haversine(s.latlngs[0], s.latlngs[1]),
          fillOpacity: on ? .16 : .09 });
      } else {
        main = L.circleMarker(s.latlngs[0], { ...opts, radius: on ? 7 : 5.5, fillOpacity: 1 });
      }
      main.addTo(group);

      // Vertex handles are always present (not just when selected) so a shape
      // can be grabbed by its dots as well as its body.
      // A circle's second point is its radius handle; dragging the centre
      // must move the whole shape so the radius is preserved.
      const handles = s.latlngs.map((p, i) => {
        const h = L.circleMarker(p, {
          pane: 'draw', renderer: this.renderer,
          radius: on ? 4.5 : 3.5,
          color: on ? '#fff' : s.color,
          fillColor: s.color,
          fillOpacity: 1,
          weight: on ? 1.8 : 1.4,
          opacity: on ? 1 : .85,
          className: 'draw-handle',
        });
        h._vtx = i;
        h.addTo(group);
        return h;
      });

      const label = L.marker(this._labelAt(s), {
        pane: 'draw-labels', interactive: false,
        icon: L.divIcon({
          className: '', iconSize: [0, 0],
          html: `<div class="draw-label ${on ? 'is-on' : ''}" style="--dc:${s.color}">
                   <b>${s.label}</b><span>${m.primary}</span></div>`,
        }),
      }).addTo(group);

      const rec = { group, main, handles, label, shape: s };
      group.addTo(this.map);
      this._layers.set(s.id, rec);

      // Body and every handle can start a move; handles also support
      // per-vertex editing when the shape is selected.
      this._bindDrag(main, s, null);
      handles.forEach((h) => {
        // circle centre behaves as a move, every other handle edits its vertex
        const asMove = s.type === 'circle' && h._vtx === 0;
        this._bindDrag(h, s, asMove ? null : h._vtx);
      });
      main.on('click', (e) => { L.DomEvent.stopPropagation(e); this.select(s.id); });
    });
  }

  _labelAt(s) {
    return s.type === 'polygon' ? centroid(s.latlngs)
      : (s.type === 'circle' || s.type === 'point') ? s.latlngs[0]
      : s.latlngs.at(-1);
  }

  /* ------------------------------------------------------------------
     Dragging — whole shape, or a single vertex when selected
     ------------------------------------------------------------------ */

  /**
   * @param {L.Layer} layer  the grabbable layer
   * @param {object} shape
   * @param {number|null} vtx  vertex index, or null to move the whole shape
   */
  _bindDrag(layer, shape, vtx) {
    let dragging = false, origin = null, before = null, moved = false;

    const onMove = (e) => {
      if (!dragging) return;
      const s = this.shapes.find((x) => x.id === shape.id);
      if (!s) return;
      moved = true;

      if (vtx === null) {
        const dLat = e.latlng.lat - origin.lat;
        const dLng = e.latlng.lng - origin.lng;
        s.latlngs = before.map(([la, lo]) => [la + dLat, lo + dLng]);
      } else {
        // Editing one vertex; for a circle, vertex 1 is the radius handle.
        s.latlngs = before.map((p, i) => (i === vtx ? [e.latlng.lat, e.latlng.lng] : [...p]));
      }
      this._syncShape(s);
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      this.map.dragging.enable();
      this.map.off('mousemove', onMove);
      this.map.off('mouseup', onUp);
      this.nmap.root.classList.remove('is-dragging-shape');

      const s = this.shapes.find((x) => x.id === shape.id);
      if (s && moved) {
        s.latlngs = s.latlngs.map(([la, lo]) => [+la.toFixed(6), +lo.toFixed(6)]);
        this.render();
        this.onSelect(s);
        this.onChange(this.shapes, vtx === null ? `Move ${s.label}` : `Edit ${s.label}`);
      }
    };

    layer.on('mousedown', (e) => {
      // A shape stays movable even while a draw tool is armed — grabbing an
      // existing shape should never start a new one.
      if (this.selectedId !== shape.id) this.select(shape.id);
      dragging = true;
      moved = false;
      origin = e.latlng;
      before = this.shapes.find((x) => x.id === shape.id).latlngs.map((p) => [...p]);
      this.map.dragging.disable();
      this.map.on('mousemove', onMove);
      this.map.on('mouseup', onUp);
      this.nmap.root.classList.add('is-dragging-shape');
      L.DomEvent.stop(e);
    });

    // Suppress the click that follows a drag so it can't arm/commit a tool.
    layer.on('click', (e) => { if (moved) L.DomEvent.stop(e); });
  }

  /**
   * Update geometry, handles and label together in one frame, so the body and
   * its vertices never visibly lag behind each other while dragging.
   */
  _syncShape(s) {
    const rec = this._layers.get(s.id);
    if (!rec) return;

    if (s.type === 'circle') {
      rec.main.setLatLng(s.latlngs[0]);
      rec.main.setRadius(haversine(s.latlngs[0], s.latlngs[1]));
    } else if (s.type === 'point') {
      rec.main.setLatLng(s.latlngs[0]);
    } else {
      rec.main.setLatLngs(s.latlngs);
    }

    rec.handles.forEach((h, i) => { if (s.latlngs[i]) h.setLatLng(s.latlngs[i]); });
    rec.label.setLatLng(this._labelAt(s));

    // keep the readout live during the drag
    const el = rec.label.getElement?.()?.querySelector('.draw-label span');
    if (el) el.textContent = measureShape(s, this.getUnits()).primary;
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
    this._layers.forEach((rec) => this.map.removeLayer(rec.group));
    this._layers.clear();
  }
}
