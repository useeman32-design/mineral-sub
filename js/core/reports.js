/**
 * REPORT ENGINE
 * =============
 * A cart of report sections that any module can add to, rendered to HTML for
 * print/PDF, or serialised to CSV and Excel.
 *
 *   reports.add({ kind: 'state', id: 'Zamfara', title: 'Zamfara State Profile' });
 *   reports.count;                    // badge on the sidebar
 *   await reports.build();            // resolve every section against the API
 *
 * Sections store identifiers only, never resolved rows, so a cart survives a
 * data refresh and could be persisted or shared as a URL later. Resolution
 * happens once at build time through the API layer.
 *
 * Export formats:
 *   - PDF   : rendered HTML + window.print(), so it matches the on-screen design
 *   - CSV   : one flat table per section, concatenated with section headers
 *   - Excel : SpreadsheetML 2003, which Excel opens natively and needs no library
 */

import { fmt } from './utils.js?v=effc9f2';

const KEY = 'nmi.reportCart';

/** Section kinds a module can contribute. */
export const SECTION_KINDS = {
  national: { label: 'National overview', icon: 'overview' },
  state: { label: 'State profile', icon: 'pin' },
  lga: { label: 'Local government', icon: 'pin' },
  commodity: { label: 'Commodity register', icon: 'minerals' },
  occurrence: { label: 'Occurrence record', icon: 'target' },
  prospectivity: { label: 'Prospectivity ranking', icon: 'prospectivity' },
  risk: { label: 'Risk assessment', icon: 'risk' },
  petroleum: { label: 'Petroleum blocks', icon: 'oil' },
  titles: { label: 'Mining titles', icon: 'titles' },
  datasets: { label: 'Data coverage', icon: 'data' },
};

const listeners = new Set();
let cart = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* quota */ }
  listeners.forEach((fn) => { try { fn(cart); } catch (e) { console.error('[reports]', e); } });
}

export const reports = {
  get items() { return cart.slice(); },
  get count() { return cart.length; },

  /** Add a section. Re-adding the same kind+id is a no-op. */
  add(section) {
    const uid = `${section.kind}:${section.id ?? '*'}`;
    if (cart.some((s) => s.uid === uid)) return false;
    cart.push({ ...section, uid, added: Date.now() });
    persist();
    return true;
  },

  remove(uid) { cart = cart.filter((s) => s.uid !== uid); persist(); },
  clear() { cart = []; persist(); },
  has(kind, id) { return cart.some((s) => s.uid === `${kind}:${id ?? '*'}`); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Move a section within the cart so the user controls document order. */
  move(uid, dir) {
    const i = cart.findIndex((s) => s.uid === uid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cart.length) return;
    [cart[i], cart[j]] = [cart[j], cart[i]];
    persist();
  },
};

/* ------------------------------------------------------------------ *
 * Resolution — turn identifiers into tables
 * ------------------------------------------------------------------ */

/**
 * Resolve every cart section into `{ title, subtitle, columns, rows, notes }`.
 * @param {object} api  the shared API instance
 * @param {Array}  [items]  defaults to the whole cart
 */
export async function resolveSections(api, items = cart) {
  const out = [];
  for (const s of items) {
    try {
      out.push(await resolveOne(api, s));
    } catch (err) {
      console.error('[reports] section failed', s, err);
      out.push({
        ...s, title: s.title || s.kind, columns: ['Status'],
        rows: [['Could not be resolved — the data service returned an error.']],
      });
    }
  }
  return out;
}

async function resolveOne(api, s) {
  const base = { uid: s.uid, kind: s.kind, title: s.title || SECTION_KINDS[s.kind]?.label || s.kind };

  switch (s.kind) {
    case 'national': {
      const sum = await api.getDashboardSummary();
      return {
        ...base,
        subtitle: 'Federal Republic of Nigeria · all 37 states',
        columns: ['Indicator', 'Value', 'Change', 'Context'],
        rows: sum.kpis.map((k) => [k.label, fmt.int(k.value) + (k.unit ? ` ${k.unit}` : ''),
          fmt.delta(k.delta), k.ctx || '—']),
      };
    }

    case 'state': {
      const st = await api.getStateProfile(s.id);
      if (!st) throw new Error('no state');
      return {
        ...base,
        subtitle: `${s.id} State · ${st.region}`,
        columns: ['Attribute', 'Value'],
        rows: [
          ['State code', st.code],
          ['Geopolitical zone', st.region],
          ['Mineral occurrences', fmt.int(st.occurrences)],
          ['Prospectivity score', `${st.prospectivity} / 100`],
          ['Risk classification', st.risk],
          ['Active mining titles', fmt.int(st.titles)],
          ['Survey coverage', `${st.coverage}%`],
          ['Petroleum acreage', st.petroleum ? 'Yes' : 'No'],
          ['Commodities recorded', (st.commodities || []).join(', ') || '—'],
          ['Centroid', fmt.coord(st.centroid[0], st.centroid[1])],
        ],
      };
    }

    case 'lga': {
      // ADM2 attributes are not in the fixture set, so the LGA section reports
      // its parent-state context plus whatever occurrences fall inside it.
      const st = s.state ? await api.getStateProfile(s.state) : null;
      const deps = await api.getDeposits();
      const inState = st ? deps.filter((d) => d.state === s.state) : [];
      return {
        ...base,
        subtitle: `${s.id} LGA · ${s.state || '—'} State`,
        columns: ['Attribute', 'Value'],
        rows: [
          ['Local government', s.id],
          ['State', s.state || '—'],
          ['State code', st?.code || '—'],
          ['Geopolitical zone', st?.region || '—'],
          ['State occurrences', st ? fmt.int(st.occurrences) : '—'],
          ['Catalogued sites in state', inState.length],
          ['State risk band', st?.risk || '—'],
          ['LGA-level attribution', 'Per-LGA occurrence and title counts arrive with the ADM2 data service'],
        ],
      };
    }

    case 'commodity': {
      const c = await api.getCommodity(s.id);
      if (!c) throw new Error('no commodity');
      return {
        ...base,
        subtitle: `${c.label} · ${c.category} · ${c.maturity}`,
        columns: ['Attribute', 'Value'],
        rows: [
          ['Commodity', c.label],
          ['Classification', c.category],
          ['National occurrences', fmt.int(c.occurrences)],
          ['Catalogued sites', c.siteCount],
          ['Producing sites', c.producing],
          ['States with presence', c.stateCount],
          ['Leading states', c.states.slice(0, 5).map((x) => x.name).join(', ') || '—'],
          ['Grade & tonnage', c.grade],
          ['Host geology', c.hostRock],
          ['End uses', c.uses],
        ],
      };
    }

    case 'occurrence': {
      const all = await api.getDeposits();
      const d = all.find((x) => x.id === s.id);
      if (!d) throw new Error('no occurrence');
      return {
        ...base,
        subtitle: `${d.name} · ${d.state} State`,
        columns: ['Attribute', 'Value'],
        rows: [
          ['Site', d.name], ['Register ID', d.id],
          ['Commodity', d.resource], ['State', d.state],
          ['Tier', d.tier], ['Status', d.status],
          ['Coordinates', fmt.coord(d.lat, d.lng)],
        ],
      };
    }

    case 'prospectivity': {
      const { runModel, defaultWeights } = await import('./scoring.js?v=effc9f2');
      const states = await api.getProspectivityInputs();
      const { targets } = runModel(states, defaultWeights(), { commodity: s.commodity || null });
      const rows = (s.id ? targets.filter((t) => t.name === s.id) : targets.slice(0, 15));
      return {
        ...base,
        subtitle: s.commodity ? `Weighted overlay · ${s.commodity}` : 'Weighted overlay · all commodities',
        columns: ['Rank', 'State', 'Composite', 'Tier', 'Confidence', 'Leading signal'],
        rows: rows.map((t) => [t.rank, t.name, t.score.toFixed(1), t.tier.label,
          t.confidence.label, t.driver?.label || '—']),
        notes: 'Scores are the weighted mean of enabled criteria; weights are relative.',
      };
    }

    case 'risk': {
      const { runRisk, defaultRiskWeights } = await import('./risk.js?v=effc9f2');
      const states = await api.getProspectivityInputs();
      const { rows: scored } = runRisk(states, defaultRiskWeights());
      const rows = s.id ? scored.filter((r) => r.name === s.id) : scored.slice(0, 15);
      if (s.id && rows[0]) {
        const r = rows[0];
        return {
          ...base,
          subtitle: `${r.name} · ${r.band.label} risk · composite ${r.score.toFixed(1)}`,
          columns: ['Factor', 'Evidence', 'Weight', 'Contribution', 'Mitigation'],
          rows: r.factors.map((f) => [f.label, `${f.evidence}/100`, f.weight,
            f.contribution.toFixed(1), f.mitigation]),
        };
      }
      return {
        ...base,
        subtitle: 'Composite exploration risk · all states',
        columns: ['Rank', 'State', 'Composite', 'Band', 'Leading constraint'],
        rows: rows.map((r) => [r.rank, r.name, r.score.toFixed(1), r.band.label, r.driver?.label || '—']),
      };
    }

    case 'petroleum': {
      const blocks = await api.getPetroleumBlocks();
      const rows = s.id ? blocks.filter((b) => b.state === s.id) : blocks;
      return {
        ...base,
        subtitle: s.id ? `${s.id} State · ${rows.length} blocks` : `All basins · ${rows.length} blocks`,
        columns: ['Block', 'Type', 'State', 'Terrain', 'Operator', 'Status', 'Oil (bopd)', 'Gas (mmscf/d)', 'Expiry'],
        rows: rows.map((b) => [b.id, b.kind, b.state, b.terrain, b.operator, b.status,
          fmt.int(b.oilBopd), b.gasMmscfd, b.expiry]),
      };
    }

    case 'titles': {
      const titles = await api.getMiningTitles();
      const rows = s.id ? titles.filter((t) => t.state === s.id) : titles;
      return {
        ...base,
        subtitle: s.id ? `${s.id} State · ${rows.length} titles` : `National cadastre · ${rows.length} titles`,
        columns: ['Title ID', 'Type', 'State', 'Holder', 'Commodity', 'Area (ha)', 'Granted', 'Expiry', 'Status'],
        rows: rows.slice(0, 400).map((t) => [t.id, t.typeLabel, t.state, t.holder, t.commodity,
          fmt.int(t.areaHa), t.granted, t.expiry, t.status]),
      };
    }

    case 'datasets': {
      const ds = await api.getDatasets();
      return {
        ...base,
        subtitle: `${ds.length} datasets · ${ds.filter((d) => d.status === 'Connected').length} connected`,
        columns: ['Dataset', 'Domain', 'Source', 'Format', 'Records', 'Quality', 'Status', 'Updated'],
        rows: ds.map((d) => [d.name, d.domain, d.source, d.format,
          d.records ? fmt.int(d.records) : '—', `${d.quality}%`, d.status, d.updated || '—']),
      };
    }

    default:
      return { ...base, columns: ['Status'], rows: [['Unknown section type']] };
  }
}

/* ------------------------------------------------------------------ *
 * Serialisation
 * ------------------------------------------------------------------ */

const esc = (v) => {
  const t = String(v ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function toCsv(sections, meta = {}) {
  const lines = [];
  lines.push(`# ${meta.title || 'Nigeria Mineral Intelligence report'}`);
  lines.push(`# Generated,${new Date().toISOString()}`);
  if (meta.author) lines.push(`# Author,${esc(meta.author)}`);
  lines.push('');

  sections.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.title}`);
    if (s.subtitle) lines.push(`# ${s.subtitle}`);
    lines.push(s.columns.map(esc).join(','));
    s.rows.forEach((r) => lines.push(r.map(esc).join(',')));
    if (s.notes) lines.push(`# ${s.notes}`);
    lines.push('');
  });
  return lines.join('\n');
}

const xesc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * SpreadsheetML 2003 — a plain-XML workbook Excel opens natively, so multi-sheet
 * export needs no third-party library.
 */
export function toExcel(sections, meta = {}) {
  const sheetName = (s, i) => `${i + 1}. ${s.title}`.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);

  const sheets = sections.map((s, i) => {
    const head = `<Row ss:StyleID="hdr">${s.columns.map((c) => `<Cell><Data ss:Type="String">${xesc(c)}</Data></Cell>`).join('')}</Row>`;
    const body = s.rows.map((r) => `<Row>${r.map((c) => {
      const num = typeof c === 'number' || (/^-?[\d.]+$/.test(String(c)) && String(c).trim() !== '');
      return `<Cell><Data ss:Type="${num ? 'Number' : 'String'}">${xesc(c)}</Data></Cell>`;
    }).join('')}</Row>`).join('');
    const sub = s.subtitle ? `<Row><Cell><Data ss:Type="String">${xesc(s.subtitle)}</Data></Cell></Row><Row/>` : '';
    return `<Worksheet ss:Name="${xesc(sheetName(s, i))}"><Table>${sub}${head}${body}</Table></Worksheet>`;
  }).join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${xesc(meta.title || 'NMI report')}</Title>
  <Author>${xesc(meta.author || 'Nigeria Mineral Intelligence')}</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="hdr"><Font ss:Bold="1"/>
   <Interior ss:Color="#0E1A1D" ss:Pattern="Solid"/>
   <Font ss:Color="#00E676" ss:Bold="1"/>
  </Style>
 </Styles>
 ${sheets}
</Workbook>`;
}

/** Trigger a browser download without touching the server. */
export function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
