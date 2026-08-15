/**
 * PROJECT STORE — saved exploration work.
 *
 * Persists to localStorage today. The record shape mirrors the intended
 * Laravel resource, so switching to the API means replacing the four methods
 * below with fetch calls and nothing in the UI changes.
 *
 *   GET    /api/v1/projects
 *   POST   /api/v1/projects
 *   PUT    /api/v1/projects/:id
 *   DELETE /api/v1/projects/:id
 */

const KEY = 'nmi.projects';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  dispatchEvent(new CustomEvent('nmi:projects', { detail: list }));
}

const uid = () => `prj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const projects = {
  /** GET /projects */
  list() {
    return read().sort((a, b) => b.updated - a.updated);
  },

  get(id) {
    return read().find((p) => p.id === id) || null;
  },

  /** POST /projects */
  create({ name, shapes = [], view = null, layers = null, notes = '' }) {
    const list = read();
    const rec = {
      id: uid(),
      name: name || `Untitled study ${list.length + 1}`,
      shapes,
      view,
      layers,
      notes,
      created: Date.now(),
      updated: Date.now(),
    };
    list.push(rec);
    write(list);
    return rec;
  },

  /** PUT /projects/:id */
  update(id, patch) {
    const list = read();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], ...patch, updated: Date.now() };
    write(list);
    return list[i];
  },

  /** DELETE /projects/:id */
  remove(id) {
    write(read().filter((p) => p.id !== id));
  },

  /** Client-side export — a portable .json a colleague can re-import. */
  export(id) {
    const p = this.get(id);
    if (!p) return;
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.name.replace(/[^\w-]+/g, '-').toLowerCase()}.nmi.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  stats(p) {
    const by = { line: 0, polygon: 0, circle: 0, point: 0 };
    (p.shapes || []).forEach((s) => { by[s.type] = (by[s.type] || 0) + 1; });
    return by;
  },
};
