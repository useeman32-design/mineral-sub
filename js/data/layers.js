/**
 * SHARED LAYER CATALOGUE
 * ======================
 * One definition of the map's layer stack, consumed by both the Overview
 * layers menu and the Explore layer tree. Adding a layer here surfaces it in
 * every module automatically.
 */

export const LAYER_GROUPS = [
  {
    group: 'Base',
    items: [
      { id: 'graticule',     label: 'Coordinate grid',  color: '#2dd8c3', def: true },
      { id: 'labels',        label: 'Place labels',     color: '#93a8ab', def: true },
    ],
  },
  {
    group: 'Mineral',
    items: [
      { id: 'deposits',      label: 'Mineral occurrences', color: '#f5b942', def: true },
      { id: 'prospectivity', label: 'Prospectivity heat',  color: '#ff8a3d', def: true },
      { id: 'lgas',          label: 'LGA boundaries',      color: '#5eead4', def: false,
        hint: 'Needs a selected state · auto at zoom 8.5+' },
      { id: 'risk',          label: 'Risk zones',          color: '#ff4d5e', def: false,
        hint: 'States tinted by security advisory level' },
      { id: 'footprints',    label: 'Mining footprints',   color: '#ff8a3d', def: false,
        hint: 'Satellite-mapped workings · 160 polygons' },
      { id: 'sites',         label: 'Georeferenced sites', color: '#4d9dff', def: false,
        hint: 'USGS + OpenStreetMap · 165 points' },
    ],
  },
  {
    group: 'Pending data service',
    items: [
      { id: 'geology', label: 'Geological units',      color: '#8b7dff', soon: true },
      { id: 'titles',  label: 'Mining titles',         color: '#4d9dff', soon: true },
      { id: 'infra',   label: 'Roads & infrastructure', color: '#9aa7b0', soon: true },
    ],
  },
];

export const LAYER_INDEX = Object.fromEntries(
  LAYER_GROUPS.flatMap((g) => g.items.map((it) => [it.id, it]))
);

/** Default on/off map, used to seed the store and the reset action. */
export function defaultLayerState() {
  const out = {};
  LAYER_GROUPS.forEach((g) => g.items.forEach((it) => {
    if (!it.soon) out[it.id] = !!it.def;
  }));
  return out;
}

/**
 * Single implementation of "turn layer X on/off", so Overview and Explore
 * can never drift apart.
 *
 * @returns {{ok: boolean, reason?: string}}
 */
export function applyLayer(nmap, id, on, { store, toast } = {}) {
  const meta = LAYER_INDEX[id];
  if (!meta) return { ok: false, reason: 'Unknown layer' };
  if (meta.soon) {
    toast?.(`${meta.label} arrives with the GIS data service`);
    return { ok: false, reason: 'pending' };
  }

  if (id === 'labels') {
    nmap.setLabels(on);
  } else if (id === 'lgas') {
    const st = store?.get('selectedState');
    if (on) {
      if (!st) { toast?.('Select a state first to load its LGAs'); return { ok: false, reason: 'no-state' }; }
      nmap.showLgas(st.code, { explicit: true });
    } else {
      nmap.hideLgas();
    }
  } else {
    nmap.toggleLayer(id, on);
  }

  if (store) store.set({ layers: { ...store.get('layers'), [id]: on } });
  return { ok: true };
}
