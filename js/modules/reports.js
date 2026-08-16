/**
 * REPORTS MODULE
 * ==============
 * The report builder. Sections accumulated from anywhere in the app are
 * ordered, previewed in the platform's own visual language, and exported as
 * PDF (via print), CSV or Excel.
 *
 * The preview is the PDF: printing renders exactly what is on screen, so there
 * is one layout to maintain rather than a separate document template.
 */

import { $, $$, fmt, debounce } from '../core/utils.js?v=eb3c4a3';
import { icon } from '../core/icons.js?v=eb3c4a3';
import { api } from '../data/api.js?v=eb3c4a3';
import { store } from '../core/store.js?v=eb3c4a3';
import {
  reports, resolveSections, toCsv, toExcel, download, slug, SECTION_KINDS,
} from '../core/reports.js?v=eb3c4a3';
import { toast } from './dashboard.js?v=eb3c4a3';

/** One-click starting points so the module is useful with an empty cart. */
const PRESETS = [
  { id: 'national', label: 'National briefing', hint: 'Headline indicators, top targets and risk',
    sections: [
      { kind: 'national', id: null, title: 'National indicators' },
      { kind: 'prospectivity', id: null, title: 'Prospectivity ranking' },
      { kind: 'risk', id: null, title: 'Risk assessment' },
      { kind: 'datasets', id: null, title: 'Data coverage & provenance' },
    ] },
  { id: 'assets', label: 'Asset register', hint: 'Petroleum blocks and the mining cadastre',
    sections: [
      { kind: 'petroleum', id: null, title: 'Petroleum licence blocks — national' },
      { kind: 'titles', id: null, title: 'Mining cadastre — national' },
    ] },
  { id: 'everything', label: 'Full country dossier', hint: 'Every section, all scopes',
    sections: [
      { kind: 'national', id: null, title: 'National indicators' },
      { kind: 'prospectivity', id: null, title: 'Prospectivity ranking' },
      { kind: 'risk', id: null, title: 'Risk assessment' },
      { kind: 'petroleum', id: null, title: 'Petroleum licence blocks — national' },
      { kind: 'titles', id: null, title: 'Mining cadastre — national' },
      { kind: 'datasets', id: null, title: 'Data coverage & provenance' },
    ] },
];

export function createReports() {
  let view;
  let resolved = [];
  let building = false;
  let unsub = null;
  let meta = load();

  function load() {
    try {
      return {
        title: 'Nigeria Mineral Intelligence Report',
        author: '',
        ...JSON.parse(localStorage.getItem('nmi.reportMeta') || '{}'),
      };
    } catch { return { title: 'Nigeria Mineral Intelligence Report', author: '' }; }
  }
  const saveMeta = () => {
    try { localStorage.setItem('nmi.reportMeta', JSON.stringify(meta)); } catch { /* quota */ }
  };

  const stamp = () => new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  /* ---------------- templates ---------------- */

  const cartRow = (s, i, n) => `
    <li class="rp-item" data-uid="${s.uid}">
      <span class="rp-item-n t-mono">${String(i + 1).padStart(2, '0')}</span>
      <span class="rp-item-i">${icon(SECTION_KINDS[s.kind]?.icon || 'reports', { size: 14 })}</span>
      <span class="rp-item-t">
        <b>${s.title}</b>
        <em>${SECTION_KINDS[s.kind]?.label || s.kind}${s.id ? ` · ${s.id}` : ' · national'}</em>
      </span>
      <span class="rp-item-a">
        <button class="rp-mini" data-move="-1" ${i === 0 ? 'disabled' : ''} title="Move up">${icon('chevron', { size: 12 })}</button>
        <button class="rp-mini rp-dn" data-move="1" ${i === n - 1 ? 'disabled' : ''} title="Move down">${icon('chevron', { size: 12 })}</button>
        <button class="rp-mini rp-del" data-del title="Remove">${icon('trash', { size: 12 })}</button>
      </span>
    </li>`;

  const table = (s) => `
    <table class="rp-table">
      <thead><tr>${s.columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>
        ${s.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? '' : 't-mono'}">${c ?? '—'}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;

  const docSection = (s, i) => `
    <section class="rp-sec">
      <header class="rp-sec-hd">
        <span class="rp-sec-n t-mono">${String(i + 1).padStart(2, '0')}</span>
        <div>
          <h2>${s.title}</h2>
          ${s.subtitle ? `<p>${s.subtitle}</p>` : ''}
        </div>
      </header>
      ${table(s)}
      ${s.notes ? `<p class="rp-note">${s.notes}</p>` : ''}
      ${s.rows.length >= 400 ? '<p class="rp-note">Table truncated to the first 400 rows — use the CSV or Excel export for the complete set.</p>' : ''}
    </section>`;

  const documentHtml = () => `
    <article class="rp-doc" id="rp-doc">
      <header class="rp-cover">
        <div class="rp-cover-brand">
          <span class="rp-mark">${icon('overview', { size: 18 })}</span>
          <div>
            <b>NIGERIA MINERAL INTELLIGENCE</b>
            <em>Federal geoscience &amp; resource intelligence platform</em>
          </div>
        </div>
        <h1>${meta.title || 'Untitled report'}</h1>
        <div class="rp-cover-meta">
          <div><span>Generated</span><b class="t-mono">${stamp()}</b></div>
          <div><span>Sections</span><b class="t-mono">${resolved.length}</b></div>
          <div><span>Rows</span><b class="t-mono">${fmt.int(resolved.reduce((a, s) => a + s.rows.length, 0))}</b></div>
          ${meta.author ? `<div><span>Prepared by</span><b>${meta.author}</b></div>` : ''}
        </div>
      </header>

      <nav class="rp-toc">
        <h3>Contents</h3>
        <ol>${resolved.map((s, i) => `
          <li><span class="t-mono">${String(i + 1).padStart(2, '0')}</span> ${s.title}
            <em>${s.rows.length} rows</em></li>`).join('')}
        </ol>
      </nav>

      ${resolved.map(docSection).join('')}

      <footer class="rp-foot">
        <span>Nigeria Mineral Intelligence · generated ${stamp()}</span>
        <span>Figures include deterministic placeholder data pending live service connection — see Data Center for provenance.</span>
      </footer>
    </article>`;

  const empty = () => `
    <div class="rp-empty">
      <div class="pr-empty-g">${icon('reports', { size: 28, sw: 1.2 })}</div>
      <p class="pr-empty-t">No sections yet</p>
      <p class="pr-empty-s">Add sections from any module with <b>Add to report</b>, or start from a preset below.</p>
      <div class="rp-presets">
        ${PRESETS.map((p) => `
          <button class="rp-preset" data-preset="${p.id}">
            <b>${p.label}</b><em>${p.hint}</em>
            <span>${p.sections.length} sections</span>
          </button>`).join('')}
      </div>
    </div>`;

  function render() {
    const items = reports.items;
    view.innerHTML = `
      <div class="pr-wrap rp-wrap">
        <header class="pr-head">
          <div class="pr-head-t">
            <h1>Reports</h1>
            <p>Assemble sections from any module into a single document, then export as PDF, CSV or Excel.</p>
          </div>
          <div class="pr-head-k">
            <div class="pr-kpi"><div class="pr-kpi-l">Sections</div>
              <div class="pr-kpi-v">${items.length}</div><div class="pr-kpi-s">in this report</div></div>
          </div>
        </header>

        <div class="rp-body">
          <aside class="rp-side">
            <section class="panel">
              <header class="panel-hd">
                <span class="accent-bar accent-green"></span><h3>Document</h3>
              </header>
              <div class="panel-bd rp-meta">
                <label class="rp-field">
                  <span>Title</span>
                  <input id="rp-title" type="text" value="${(meta.title || '').replace(/"/g, '&quot;')}" placeholder="Report title" />
                </label>
                <label class="rp-field">
                  <span>Prepared by</span>
                  <input id="rp-author" type="text" value="${(meta.author || '').replace(/"/g, '&quot;')}" placeholder="Name or department" />
                </label>
              </div>
            </section>

            <section class="panel rp-cart">
              <header class="panel-hd">
                <span class="accent-bar accent-gold"></span><h3>Sections</h3>
                <span class="spacer"></span>
                ${items.length ? '<button class="rp-clear" data-clear>Clear all</button>' : ''}
              </header>
              <div class="panel-bd">
                ${items.length
                  ? `<ol class="rp-list">${items.map((s, i) => cartRow(s, i, items.length)).join('')}</ol>`
                  : '<p class="rp-hint">Nothing added yet.</p>'}
              </div>
            </section>

            <section class="panel">
              <header class="panel-hd">
                <span class="accent-bar accent-cyan"></span><h3>Add a section</h3>
              </header>
              <div class="panel-bd rp-add">
                <label class="rp-field">
                  <span>Scope</span>
                  <select id="rp-kind">
                    ${Object.entries(SECTION_KINDS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                  </select>
                </label>
                <label class="rp-field" id="rp-target-wrap" hidden>
                  <span>Target</span>
                  <select id="rp-target"></select>
                </label>
                <button class="btn-ghost btn-primary rp-add-btn" data-add-section>
                  ${icon('plus', { size: 13 })} Add section
                </button>
                <div class="rp-preset-row">
                  ${PRESETS.map((p) => `<button class="rp-chip" data-preset="${p.id}">${p.label}</button>`).join('')}
                </div>
              </div>
            </section>
          </aside>

          <main class="rp-main">
            <div class="rp-bar">
              <span class="rp-bar-t">${items.length ? 'Preview' : 'Report builder'}</span>
              <span class="spacer"></span>
              <button class="btn-ghost" data-export="csv" ${items.length ? '' : 'disabled'}>
                ${icon('download', { size: 13 })} CSV</button>
              <button class="btn-ghost" data-export="xls" ${items.length ? '' : 'disabled'}>
                ${icon('download', { size: 13 })} Excel</button>
              <button class="btn-ghost" data-export="print" ${items.length ? '' : 'disabled'}>
                ${icon('copy', { size: 13 })} Print</button>
              <button class="btn-ghost btn-primary" data-export="pdf" ${items.length ? '' : 'disabled'}>
                ${icon('download', { size: 13 })} PDF</button>
            </div>
            <div class="rp-stage" id="rp-stage">
              ${items.length ? `<div class="pr-loading">${icon('refresh', { size: 18 })}<span>Building preview…</span></div>` : empty()}
            </div>
          </main>
        </div>
      </div>`;

    syncTargets();
    if (items.length) build();
  }

  /* ---------------- target picker ---------------- */

  async function syncTargets() {
    const kind = $('#rp-kind', view)?.value;
    const wrap = $('#rp-target-wrap', view);
    const sel = $('#rp-target', view);
    if (!kind || !wrap || !sel) return;

    const NEEDS = {
      state: async () => Object.keys((await api.getProspectivityInputs()).reduce((a, s) => {
        a[s.name] = 1; return a;
      }, {})).sort(),
      commodity: async () => (await api.getCommodities()).map((c) => c.id),
      occurrence: async () => (await api.getDeposits()).map((d) => `${d.id}|${d.name}`),
      petroleum: async () => [...new Set((await api.getPetroleumBlocks()).map((b) => b.state))].sort(),
      titles: async () => [...new Set((await api.getMiningTitles()).map((t) => t.state))].sort(),
      prospectivity: async () => (await api.getProspectivityInputs()).map((s) => s.name).sort(),
      risk: async () => (await api.getProspectivityInputs()).map((s) => s.name).sort(),
    };

    if (!NEEDS[kind]) { wrap.hidden = true; sel.innerHTML = ''; return; }
    const opts = await NEEDS[kind]();
    const optional = ['petroleum', 'titles', 'prospectivity', 'risk'].includes(kind);
    sel.innerHTML = (optional ? '<option value="">Whole country</option>' : '')
      + opts.map((o) => {
        const [v, l] = String(o).includes('|') ? o.split('|') : [o, o];
        return `<option value="${v}">${l}</option>`;
      }).join('');
    wrap.hidden = false;
  }

  /* ---------------- build & export ---------------- */

  async function build() {
    // Presets add several sections in a row, each firing a render. A plain
    // in-flight guard would drop the later builds and leave a stale document,
    // so instead we re-resolve until the cart stops changing mid-build.
    if (building) return;
    building = true;
    try {
      let signature;
      do {
        signature = reports.items.map((s) => s.uid).join('|');
        resolved = await resolveSections(api, reports.items);
      } while (signature !== reports.items.map((s) => s.uid).join('|'));

      const stage = $('#rp-stage', view);
      if (stage) stage.innerHTML = reports.count ? documentHtml() : empty();
    } catch (err) {
      console.error('[reports] build failed', err);
      const stage = $('#rp-stage', view);
      if (stage) stage.innerHTML = '<div class="rp-empty"><p class="pr-empty-t">Could not build the report</p><p class="pr-empty-s">Check the console for details.</p></div>';
    } finally {
      building = false;
    }
  }

  function exportAs(kind) {
    if (!resolved.length) { toast('Add at least one section first'); return; }
    const name = slug(meta.title || 'nmi-report') || 'nmi-report';
    const date = new Date().toISOString().slice(0, 10);

    if (kind === 'csv') {
      download(`${name}-${date}.csv`, toCsv(resolved, meta), 'text/csv;charset=utf-8');
      toast('CSV exported');
    } else if (kind === 'xls') {
      download(`${name}-${date}.xls`, toExcel(resolved, meta), 'application/vnd.ms-excel');
      toast('Excel workbook exported');
    } else {
      // PDF and Print are the same path: the print stylesheet renders the
      // preview to paper, and the browser's dialogue offers "Save as PDF".
      toast(kind === 'pdf' ? 'Choose “Save as PDF” in the print dialogue' : 'Opening print dialogue');
      document.body.classList.add('is-printing');
      const done = () => {
        document.body.classList.remove('is-printing');
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      setTimeout(() => window.print(), 120);
      setTimeout(done, 60000);
    }
  }

  /* ---------------- module ---------------- */

  return {
    async mount(v) {
      view = v;
      render();

      view.addEventListener('change', (e) => {
        if (e.target.id === 'rp-kind') syncTargets();
      });

      view.addEventListener('input', (e) => {
        if (e.target.id === 'rp-title') { meta.title = e.target.value; saveMeta(); }
        if (e.target.id === 'rp-author') { meta.author = e.target.value; saveMeta(); }
      });

      view.addEventListener('click', (e) => {
        const ex = e.target.closest('[data-export]');
        if (ex) { exportAs(ex.dataset.export); return; }

        const pre = e.target.closest('[data-preset]');
        if (pre) {
          const p = PRESETS.find((x) => x.id === pre.dataset.preset);
          let n = 0;
          p.sections.forEach((s) => { if (reports.add({ ...s })) n += 1; });
          toast(n ? `Added ${n} section${n > 1 ? 's' : ''}` : 'Those sections are already in the report');
          return;
        }

        if (e.target.closest('[data-add-section]')) {
          const kind = $('#rp-kind', view).value;
          const wrap = $('#rp-target-wrap', view);
          const id = wrap.hidden ? null : ($('#rp-target', view).value || null);
          const label = wrap.hidden || !id ? SECTION_KINDS[kind].label
            : `${SECTION_KINDS[kind].label} — ${$('#rp-target', view).selectedOptions[0].textContent}`;
          const ok = reports.add({ kind, id, title: label, state: store.get('selectedState')?.name });
          toast(ok ? `Added ${label}` : 'That section is already in the report');
          return;
        }

        if (e.target.closest('[data-clear]')) {
          reports.clear();
          resolved = [];
          toast('Report cleared');
          return;
        }

        const item = e.target.closest('.rp-item');
        if (!item) return;
        const mv = e.target.closest('[data-move]');
        if (mv) { reports.move(item.dataset.uid, +mv.dataset.move); return; }
        if (e.target.closest('[data-del]')) reports.remove(item.dataset.uid);
      });

      // Re-render whenever the cart changes — including from another module.
      // Debounced because presets add several sections in quick succession and
      // each one would otherwise trigger a full rebuild of the document.
      const rerender = debounce(() => { if (view.isConnected) render(); }, 60);
      unsub = reports.subscribe(rerender);
    },

    onShow() { if (view && reports.count !== resolved.length) render(); },

    destroy() { unsub?.(); unsub = null; },
  };
}
