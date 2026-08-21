/**
 * REPORT ENGINE
 * =============
 * A cart of report sections that any module can add to, rendered to HTML for
 * the on-screen preview and serialised to PDF, CSV and Excel.
 *
 *   reports.add({ kind: 'state', id: 'Zamfara', title: 'Zamfara State Profile' });
 *   reports.count;                    // badge on the sidebar
 *   await resolveSections(api);       // resolve every section against the API
 *
 * Sections store identifiers only, never resolved rows, so a cart survives a
 * data refresh and could be persisted or shared as a URL later. Resolution
 * happens once at build time through the API layer.
 *
 * SCOPE
 * Every section carries an `id`. A null id means "everything in scope"
 * (national); a non-null id narrows the section to exactly that record — one
 * state, one LGA, one occurrence, one mining title, one licence block. This is
 * what makes "generate a report for the thing I selected" behave correctly.
 *
 * Export formats:
 *   - PDF   : generated directly by js/core/pdf.js — no print dialogue
 *   - Excel : real .xlsx (OOXML) via js/core/xlsx.js — one sheet per section
 *   - CSV   : one flat table per section, concatenated with section headers
 *   - Print : the on-screen preview, via a print stylesheet
 *
 * Sections may also carry a `chart` descriptor, which both the HTML preview and
 * the PDF renderer draw. Only sections whose data is genuinely comparative get
 * one — a two-column attribute table does not.
 */

import { fmt } from './utils.js?v=db4eb0f';
import { Pdf } from './pdf.js?v=db4eb0f';
import { buildXlsx } from './xlsx.js?v=db4eb0f';

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
  block: { label: 'Licence block', icon: 'oil' },
  titles: { label: 'Mining titles', icon: 'titles' },
  title: { label: 'Mining title', icon: 'titles' },
  datasets: { label: 'Data coverage', icon: 'data' },
};

/** Palette shared by the HTML preview and the PDF charts. */
export const CHART_COLORS = {
  green: '#00b85e', cyan: '#12a594', gold: '#c98a10',
  orange: '#d4620d', red: '#d63a4a', purple: '#5b4ddb', grey: '#8fa0a3',
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

  /** Add several at once, reporting how many were new. */
  addMany(sections) {
    let n = 0;
    sections.forEach((s) => { if (reports.add(s)) n += 1; });
    return n;
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
 * Resolve cart sections into `{ title, subtitle, columns, rows, notes, chart }`.
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
        subtitle: 'Federal Republic of Nigeria · 36 states + FCT',
        columns: ['Indicator', 'Value', 'Change', 'Context'],
        rows: sum.kpis.map((k) => [k.label, fmt.int(k.value) + (k.unit ? ` ${k.unit}` : ''),
          fmt.delta(k.delta), k.ctx || '—']),
        chart: {
          type: 'bar',
          title: 'Headline indicators',
          note: 'Absolute counts; bars are scaled to the largest indicator.',
          data: sum.kpis.map((k, i) => ({
            label: k.label, value: k.value,
            color: [CHART_COLORS.green, CHART_COLORS.cyan, CHART_COLORS.gold, CHART_COLORS.red][i % 4],
          })),
          fmt: (v) => fmt.int(v),
        },
      };
    }

    case 'state': {
      const st = await api.getStateProfile(s.id);
      if (!st) throw new Error('no state');
      const deps = (await api.getDeposits()).filter((d) => d.state === s.id);
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
          ['Catalogued sites', deps.length],
          ['Commodities recorded', (st.commodities || []).join(', ') || '—'],
          ['Centroid', fmt.coord(st.centroid[0], st.centroid[1])],
        ],
        chart: {
          type: 'bar',
          title: 'State indices',
          note: 'All indices normalised to 100.',
          max: 100,
          data: [
            { label: 'Prospectivity', value: st.prospectivity, color: CHART_COLORS.green },
            { label: 'Survey coverage', value: st.coverage, color: CHART_COLORS.cyan },
            { label: 'Risk exposure', value: Math.round(st.risk === 'High' ? 78 : st.risk === 'Medium' ? 52 : 28), color: CHART_COLORS.red },
          ],
          fmt: (v) => String(v),
        },
      };
    }

    case 'lga': {
      // ADM2 attributes are not in the fixture set, so the LGA section reports
      // its parent-state context plus the occurrences attributed to it.
      const st = s.state ? await api.getStateProfile(s.state) : null;
      const deps = await api.getDeposits();
      // Occurrences carry no LGA field; the offline point-in-polygon lookup does.
      const occLga = await api.getOccurrenceLgas().catch(() => ({}));
      const inLga = deps.filter((d) => occLga[d.id]?.lga === s.id);
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
          ['Catalogued sites in this LGA', inLga.length],
          ['Sites in parent state', inState.length],
          ['State occurrences', st ? fmt.int(st.occurrences) : '—'],
          ['State prospectivity', st ? `${st.prospectivity} / 100` : '—'],
          ['State risk band', st?.risk || '—'],
          ['LGA-level attribution', 'Per-LGA occurrence and title counts arrive with the ADM2 data service'],
        ],
        extra: inLga.length ? {
          title: `Occurrences in ${s.id}`,
          columns: ['Site', 'Commodity', 'Tier', 'Status', 'Coordinates'],
          rows: inLga.map((d) => [d.name, d.resource, d.tier, d.status, fmt.coord(d.lat, d.lng)]),
        } : null,
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
        chart: c.states.length ? {
          type: 'bar',
          title: `Leading states by prospectivity — ${c.label}`,
          note: 'Top 8 states recording this commodity.',
          max: 100,
          data: c.states.slice(0, 8).map((x) => ({
            label: x.name, value: x.prospectivity, color: CHART_COLORS.gold,
          })),
          fmt: (v) => String(v),
        } : null,
        extra: c.states.length ? {
          title: 'States recording this commodity',
          columns: ['State', 'Code', 'Prospectivity'],
          rows: c.states.map((x) => [x.name, x.code, x.prospectivity]),
        } : null,
      };
    }

    case 'occurrence': {
      const all = await api.getDeposits();
      const d = all.find((x) => x.id === s.id);
      if (!d) throw new Error('no occurrence');
      const st = await api.getStateProfile(d.state);
      const occLga = await api.getOccurrenceLgas().catch(() => ({}));
      const lga = occLga[d.id]?.lga;
      return {
        ...base,
        subtitle: `${d.name} · ${d.state} State`,
        columns: ['Attribute', 'Value'],
        rows: [
          ['Site', d.name], ['Register ID', d.id],
          ['Commodity', d.resource], ['State', d.state],
          ['Local government', lga || '—'],
          ['Tier', d.tier], ['Status', d.status],
          ['Coordinates', fmt.coord(d.lat, d.lng)],
          ['State prospectivity', st ? `${st.prospectivity} / 100` : '—'],
          ['State risk band', st?.risk || '—'],
          ['Survey coverage', st ? `${st.coverage}%` : '—'],
        ],
      };
    }

    case 'prospectivity': {
      const { runModel, defaultWeights, CRITERIA } = await import('./scoring.js?v=db4eb0f');
      const states = await api.getProspectivityInputs();
      const { targets } = runModel(states, defaultWeights(), { commodity: s.commodity || null });

      // Single state: report its criterion-by-criterion breakdown, not a ranking.
      if (s.id) {
        const t = targets.find((x) => x.name === s.id);
        if (!t) throw new Error('no target');
        return {
          ...base,
          subtitle: `${t.name} · rank ${t.rank} of ${targets.length} · composite ${t.score.toFixed(1)} · ${t.tier.label}`,
          columns: ['Criterion', 'Evidence', 'Weight', 'Contribution', 'Reading'],
          rows: t.contributions.map((c) => [c.label, `${Math.round(c.evidence)}/100`,
            c.weight, c.contribution.toFixed(1), c.hint || '—']),
          notes: `Confidence ${t.confidence.label}. Leading signal: ${t.driver?.label || '—'}.`
            + (t.drag ? ` Weakest input: ${t.drag.label}.` : ''),
          chart: {
            type: 'bar',
            title: `Criterion evidence — ${t.name}`,
            note: 'Evidence scores before weighting, out of 100.',
            max: 100,
            data: t.contributions.map((c) => ({
              label: c.label, value: Math.round(c.evidence), color: CHART_COLORS.green,
            })),
            fmt: (v) => String(v),
          },
        };
      }

      const rows = targets.slice(0, 15);
      return {
        ...base,
        subtitle: s.commodity ? `Weighted overlay · ${s.commodity}` : 'Weighted overlay · all commodities',
        columns: ['Rank', 'State', 'Composite', 'Tier', 'Confidence', 'Leading signal'],
        rows: rows.map((t) => [t.rank, t.name, t.score.toFixed(1), t.tier.label,
          t.confidence.label, t.driver?.label || '—']),
        notes: `Scores are the weighted mean of enabled criteria (${CRITERIA.map((c) => c.label).join(', ')}); weights are relative.`,
        chart: {
          type: 'bar',
          title: 'Top 10 composite scores',
          note: 'Weighted overlay result, out of 100.',
          max: 100,
          data: rows.slice(0, 10).map((t) => ({
            label: t.name, value: t.score, color: CHART_COLORS.green,
          })),
          fmt: (v) => v.toFixed(1),
        },
      };
    }

    case 'risk': {
      const { runRisk, defaultRiskWeights } = await import('./risk.js?v=db4eb0f');
      const states = await api.getProspectivityInputs();
      const { rows: scored } = runRisk(states, defaultRiskWeights());

      if (s.id) {
        const r = scored.find((x) => x.name === s.id);
        if (!r) throw new Error('no risk row');
        return {
          ...base,
          subtitle: `${r.name} · ${r.band.label} risk · composite ${r.score.toFixed(1)} · rank ${r.rank} of ${scored.length}`,
          columns: ['Factor', 'Evidence', 'Weight', 'Contribution', 'Mitigation'],
          rows: r.factors.map((f) => [f.label, `${f.evidence}/100`, f.weight,
            f.contribution.toFixed(1), f.mitigation]),
          notes: `Leading constraint: ${r.driver?.label || '—'}. Lowest exposure: ${r.lowest?.label || '—'}.`,
          chart: {
            type: 'bar',
            title: `Risk factor evidence — ${r.name}`,
            note: 'Higher bars indicate greater exposure.',
            max: 100,
            data: r.factors.map((f) => ({
              label: f.label, value: f.evidence, color: CHART_COLORS.red,
            })),
            fmt: (v) => String(v),
          },
        };
      }

      const rows = scored.slice(0, 15);
      return {
        ...base,
        subtitle: 'Composite exploration risk · all states',
        columns: ['Rank', 'State', 'Composite', 'Band', 'Leading constraint'],
        rows: rows.map((r) => [r.rank, r.name, r.score.toFixed(1), r.band.label, r.driver?.label || '—']),
        chart: {
          type: 'bar',
          title: 'Highest composite risk',
          note: 'Top 10 states by composite exploration risk.',
          max: 100,
          data: rows.slice(0, 10).map((r) => ({
            label: r.name, value: r.score, color: CHART_COLORS.red,
          })),
          fmt: (v) => v.toFixed(1),
        },
      };
    }

    case 'block': {
      const b = (await api.getPetroleumBlocks()).find((x) => x.id === s.id);
      if (!b) throw new Error('no block');
      return {
        ...base,
        subtitle: `${b.id} · ${b.operator} · ${b.state} State`,
        columns: ['Attribute', 'Value'],
        rows: [
          ['Block', b.id], ['Licence type', b.kind],
          ['Operator', b.operator], ['State', b.state],
          ['Terrain', b.terrain], ['Status', b.status],
          ['Licence area', `${fmt.int(b.areaKm2)} km²`],
          ['Wells drilled', b.wells],
          ['Oil production', `${fmt.int(b.oilBopd)} bopd`],
          ['Gas production', `${b.gasMmscfd} mmscf/d`],
          ['Reserves', `${b.reservesMmboe} mmboe`],
          ['Awarded', b.awarded], ['Expiry', b.expiry],
        ],
      };
    }

    case 'petroleum': {
      const blocks = await api.getPetroleumBlocks();
      const rows = s.id ? blocks.filter((b) => b.state === s.id) : blocks;
      const byTerrain = {};
      rows.forEach((b) => { byTerrain[b.terrain] = (byTerrain[b.terrain] || 0) + 1; });
      return {
        ...base,
        subtitle: s.id ? `${s.id} State · ${rows.length} blocks` : `All basins · ${rows.length} blocks`,
        columns: ['Block', 'Type', 'State', 'Terrain', 'Operator', 'Status', 'Oil (bopd)', 'Gas (mmscf/d)', 'Expiry'],
        rows: rows.map((b) => [b.id, b.kind, b.state, b.terrain, b.operator, b.status,
          fmt.int(b.oilBopd), b.gasMmscfd, b.expiry]),
        notes: `Gross oil ${fmt.int(rows.reduce((a, b) => a + b.oilBopd, 0))} bopd; `
          + `gas ${fmt.int(rows.reduce((a, b) => a + b.gasMmscfd, 0))} mmscf/d.`,
        chart: rows.length > 1 ? {
          type: 'bar',
          title: 'Highest producing blocks',
          note: 'Top 10 by gross oil rate (bopd).',
          data: rows.slice().sort((a, b) => b.oilBopd - a.oilBopd).slice(0, 10)
            .map((b) => ({ label: `${b.id} · ${b.state}`, value: b.oilBopd, color: CHART_COLORS.cyan })),
          fmt: (v) => fmt.int(v),
        } : null,
        stack: rows.length > 1 ? {
          title: 'Blocks by terrain',
          segments: Object.entries(byTerrain).map(([k, v], i) => ({
            label: k, value: v,
            color: [CHART_COLORS.cyan, CHART_COLORS.green, CHART_COLORS.gold, CHART_COLORS.purple][i % 4],
          })),
        } : null,
      };
    }

    case 'title': {
      const t = (await api.getMiningTitles()).find((x) => x.id === s.id);
      if (!t) throw new Error('no title');
      return {
        ...base,
        subtitle: `${t.id} · ${t.holder}`,
        columns: ['Attribute', 'Value'],
        rows: [
          ['Title ID', t.id], ['Title type', t.typeLabel],
          ['Holder', t.holder], ['State', t.state],
          ['Target commodity', t.commodity],
          ['Licensed area', `${fmt.int(t.areaHa)} ha`],
          ['Granted', t.granted], ['Expiry', t.expiry],
          ['Term', `${t.expiry - t.granted} years`],
          ['Status', t.status],
          ['Overlap check', t.overlap ? 'Flagged — refer to the cadastre office' : 'Clear'],
        ],
      };
    }

    case 'titles': {
      const titles = await api.getMiningTitles();
      const rows = s.id ? titles.filter((t) => t.state === s.id) : titles;
      const byStatus = { Active: 0, Expiring: 0, Expired: 0 };
      rows.forEach((t) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
      const byType = {};
      rows.forEach((t) => { byType[t.typeLabel] = (byType[t.typeLabel] || 0) + 1; });
      return {
        ...base,
        subtitle: s.id ? `${s.id} State · ${rows.length} titles` : `National cadastre · ${rows.length} titles`,
        columns: ['Title ID', 'Type', 'State', 'Holder', 'Commodity', 'Area (ha)', 'Granted', 'Expiry', 'Status'],
        rows: rows.map((t) => [t.id, t.typeLabel, t.state, t.holder, t.commodity,
          fmt.int(t.areaHa), t.granted, t.expiry, t.status]),
        notes: `Licensed area ${fmt.int(rows.reduce((a, t) => a + t.areaHa, 0))} ha; `
          + `${rows.filter((t) => t.overlap).length} boundary overlaps flagged.`,
        chart: Object.keys(byType).length > 1 ? {
          type: 'bar',
          title: 'Titles by instrument type',
          data: Object.entries(byType).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => ({ label: k, value: v, color: CHART_COLORS.gold })),
          fmt: (v) => String(v),
        } : null,
        stack: rows.length > 1 ? {
          title: 'Tenure status',
          segments: [
            { label: 'Active', value: byStatus.Active, color: CHART_COLORS.green },
            { label: 'Expiring', value: byStatus.Expiring, color: CHART_COLORS.gold },
            { label: 'Expired', value: byStatus.Expired, color: CHART_COLORS.red },
          ],
        } : null,
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
        chart: {
          type: 'bar',
          title: 'Dataset completeness',
          note: 'Quality score per dataset, out of 100.',
          max: 100,
          data: ds.map((d) => ({
            label: d.name, value: d.quality,
            color: d.quality >= 80 ? CHART_COLORS.green : d.quality > 0 ? CHART_COLORS.gold : CHART_COLORS.grey,
          })),
          fmt: (v) => `${v}%`,
        },
      };
    }

    default:
      return { ...base, columns: ['Status'], rows: [['Unknown section type']] };
  }
}

/* ------------------------------------------------------------------ *
 * CSV
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
    if (s.extra) {
      lines.push('');
      lines.push(`## ${i + 1}b. ${s.extra.title}`);
      lines.push(s.extra.columns.map(esc).join(','));
      s.extra.rows.forEach((r) => lines.push(r.map(esc).join(',')));
    }
    lines.push('');
  });
  return lines.join('\n');
}

/** Excel workbook bytes — real OOXML .xlsx. */
export function toXlsx(sections, meta = {}) {
  const sheets = [];
  sections.forEach((s) => {
    sheets.push(s);
    if (s.extra) sheets.push({ ...s.extra, subtitle: `Detail for ${s.title}` });
  });
  return buildXlsx(sheets, meta);
}

/* ------------------------------------------------------------------ *
 * PDF
 * ------------------------------------------------------------------ */

const INK = '#16211f';
const MUTED = '#5d6f72';
const BRAND = '#00693b';

/**
 * Render resolved sections to a PDF document.
 * The contents list starts on the cover page rather than consuming a page of
 * its own, and each section flows continuously with repeating table headers.
 * @returns {Uint8Array}
 */
export function toPdf(sections, meta = {}) {
  const doc = new Pdf({ margin: 40, title: meta.title || 'NMI report', author: meta.author || '' });
  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // Running header/footer on every page after the first.
  doc.onNewPage = (d) => {
    if (d.pageNo > 1) {
      d.text(meta.title || 'Nigeria Mineral Intelligence report', d.m, d.size.h - 26,
        { size: 7.4, color: MUTED });
      d.line(d.m, d.size.h - 32, d.m + d.width, d.size.h - 32, '#e2e8e6', 0.5);
      d.y = d.size.h - 46;
    }
  };

  /* ---- cover ---- */
  doc.rect(doc.m, doc.size.h - 74, 22, 22, BRAND);
  doc.text('NMI', doc.m + 3.5, doc.size.h - 67, { size: 9, bold: true, color: '#ffffff' });
  doc.text('NIGERIA MINERAL INTELLIGENCE', doc.m + 30, doc.size.h - 60, { size: 10, bold: true, color: INK });
  doc.text('Federal geoscience & resource intelligence platform', doc.m + 30, doc.size.h - 71,
    { size: 7.6, color: MUTED });

  doc.y = doc.size.h - 108;
  doc.paragraph(meta.title || 'Untitled report', { size: 21, bold: true, color: INK, lead: 1.22, gap: 8 });

  doc.line(doc.m, doc.y, doc.m + doc.width, doc.y, BRAND, 1.4);
  doc.y -= 16;

  const totalRows = sections.reduce((a, s) => a + s.rows.length + (s.extra?.rows.length || 0), 0);
  const facts = [['Generated', stamp], ['Sections', String(sections.length)], ['Rows', fmt.int(totalRows)]];
  if (meta.author) facts.push(['Prepared by', meta.author]);
  let fx = doc.m;
  const colW = doc.width / facts.length;
  facts.forEach(([k, v]) => {
    doc.text(k.toUpperCase(), fx, doc.y, { size: 6.6, color: MUTED });
    doc.text(v, fx, doc.y - 11, { size: 9, bold: true, color: INK });
    fx += colW;
  });
  doc.y -= 30;

  /* ---- contents, on the cover page ---- */
  doc.text('CONTENTS', doc.m, doc.y, { size: 7.4, bold: true, color: MUTED });
  doc.y -= 13;
  sections.forEach((s, i) => {
    doc.ensure(13);
    const n = String(i + 1).padStart(2, '0');
    doc.text(n, doc.m, doc.y, { size: 8, bold: true, color: BRAND });
    doc.text(s.title, doc.m + 20, doc.y, { size: 8.6, color: INK });
    doc.text(`${s.rows.length} rows`, doc.m, doc.y, { size: 7.4, color: MUTED, align: 'r', width: doc.width });
    doc.y -= 13;
  });
  doc.y -= 8;

  /* ---- sections ---- */
  sections.forEach((s, i) => {
    doc.ensure(96);
    doc.y -= 10;
    doc.line(doc.m, doc.y, doc.m + doc.width, doc.y, '#e2e8e6', 0.7);
    doc.y -= 18;

    doc.text(String(i + 1).padStart(2, '0'), doc.m, doc.y, { size: 10, bold: true, color: BRAND });
    doc.text(s.title, doc.m + 22, doc.y, { size: 12.5, bold: true, color: INK });
    doc.y -= 12;
    if (s.subtitle) { doc.text(s.subtitle, doc.m + 22, doc.y, { size: 8, color: MUTED }); doc.y -= 12; }
    doc.y -= 4;

    if (s.chart?.data?.length) {
      doc.ensure(60);
      doc.text(s.chart.title.toUpperCase(), doc.m, doc.y, { size: 6.8, bold: true, color: MUTED });
      doc.y -= 10;
      doc.barChart(s.chart.data.slice(0, 12), { max: s.chart.max || null, valueFmt: s.chart.fmt || String });
      if (s.chart.note) { doc.text(s.chart.note, doc.m, doc.y, { size: 6.8, color: MUTED }); doc.y -= 12; }
      doc.y -= 4;
    }

    if (s.stack?.segments?.some((x) => x.value)) {
      doc.ensure(44);
      doc.text(s.stack.title.toUpperCase(), doc.m, doc.y, { size: 6.8, bold: true, color: MUTED });
      doc.y -= 10;
      doc.stackChart(s.stack.segments);
      doc.y -= 6;
    }

    doc.table(s.columns, s.rows);

    if (s.notes) {
      doc.y -= 8;
      doc.paragraph(s.notes, { size: 7.4, color: MUTED, lead: 1.35 });
    }

    if (s.extra?.rows.length) {
      doc.y -= 14;
      doc.ensure(60);
      doc.text(s.extra.title, doc.m, doc.y, { size: 9.4, bold: true, color: INK });
      doc.y -= 12;
      doc.table(s.extra.columns, s.extra.rows);
    }
  });

  /* ---- footer note ---- */
  doc.y -= 16;
  doc.ensure(26);
  doc.line(doc.m, doc.y, doc.m + doc.width, doc.y, '#e2e8e6', 0.6);
  doc.y -= 11;
  doc.text(`Nigeria Mineral Intelligence · generated ${stamp}`, doc.m, doc.y, { size: 7, color: MUTED });
  doc.y -= 10;
  doc.text('Figures include deterministic placeholder data pending live service connection — see Data Center for provenance.',
    doc.m, doc.y, { size: 7, color: MUTED });

  return doc.build();
}

/* ------------------------------------------------------------------ *
 * Download
 * ------------------------------------------------------------------ */

/** Trigger a browser download without touching the server. */
export function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
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
