/**
 * MINING TITLES MODULE
 * ====================
 * The cadastre: exploration licences, mining leases, quarry leases and small
 * scale permits, with expiry tracking and overlap flags — the two things that
 * matter most when reading a title register.
 */

import { fmt } from '../core/utils.js?v=db4eb0f';
import { icon } from '../core/icons.js?v=db4eb0f';
import { api } from '../data/api.js?v=db4eb0f';
import { ctx } from '../core/context.js?v=db4eb0f';
import { reports } from '../core/reports.js?v=db4eb0f';
import { createRegister } from '../components/register.js?v=db4eb0f';
import { toast } from './dashboard.js?v=db4eb0f';

/** Populated from the cadastre on first load so the filters match the data. */
let STATE_NAMES = [];
let COMMODITY_NAMES = [];

const STATUS_COLOR = {
  Active: 'var(--green)',
  Expiring: 'var(--gold)',
  Expired: 'var(--red)',
  // Some published records carry corrupt dates; shown as unknown, not guessed.
  Unknown: 'var(--text-low)',
};

export function createTitles() {
  let reg;

  const fact = (l, v) => `
    <div class="pr-fact"><span class="pr-fact-l">${l}</span><span class="pr-fact-v">${v}</span></div>`;

  const detail = (t) => `
    <div class="rg-card" style="--rc:${STATUS_COLOR[t.status]}">
      <header class="rg-card-hd">
        <div>
          <div class="rg-card-k">${t.typeLabel}</div>
          <h2 class="t-mono">${t.id}</h2>
          <div class="rg-card-s">${t.holder}</div>
        </div>
        <span class="rg-badge" style="color:${STATUS_COLOR[t.status]}">${t.status}</span>
      </header>

      ${t.overlap ? `
        <div class="rg-flag">
          ${icon('info', { size: 13 })}
          <span>Boundary overlap flagged against an adjacent title — refer to the cadastre office before relying on this polygon.</span>
        </div>` : ''}

      <div class="rg-metrics">
        <div><span>Area</span><b class="t-mono">${fmt.int(t.areaHa)}</b><em>hectares</em></div>
        <div><span>Term</span><b class="t-mono">${t.expiry - t.granted}</b><em>years</em></div>
        <div><span>Expiry</span><b class="t-mono">${t.expiry}</b><em>${t.status === 'Expired' ? 'lapsed' : 'renewal due'}</em></div>
      </div>

      <div class="pr-facts">
        ${fact('Title type', t.typeLabel)}
        ${fact('Holder', t.holder)}
        ${fact('State', t.state)}
        ${fact('Target commodity', t.commodity)}
        ${fact('Granted', `<span class="t-mono">${t.granted}</span>`)}
        ${fact('Overlap check', t.overlap ? '<span style="color:var(--gold)">Flagged</span>' : 'Clear')}
      </div>

      <div class="ctx-acts">
        <button class="btn-ghost btn-primary" data-go-map>${icon('map', { size: 13 })} View on map</button>
        <button class="btn-ghost" data-go-mineral>${icon('minerals', { size: 13 })} Commodity</button>
        <button class="btn-ghost" data-go-pros>${icon('prospectivity', { size: 13 })} Prospectivity</button>
        <button class="btn-ghost" data-go-risk>${icon('risk', { size: 13 })} Risk</button>
        <button class="btn-ghost" data-add-report>${icon('reports', { size: 13 })} Report this title</button>
        <button class="btn-ghost" data-report-state title="Every title in ${t.state}">${icon('reports', { size: 13 })} All of ${t.state}</button>
      </div>
    </div>`;

  return {
    async mount(view) {
      reg = createRegister(view, {
        title: 'Mining Titles',
        blurb: 'The national mineral cadastre — licences and leases by holder, commodity and term, with expiry and overlap surveillance.',
        accent: 'accent-gold',
        glyph: 'titles',
        tableTitle: 'Title register',
        searchHint: 'Search title ID, holder or state',
        loadingLabel: 'Loading cadastre…',
        emptyHint: 'Holder, term, area and overlap status open here.',
        defaultSort: 'expiry',
        defaultDir: 'asc',
        load: async () => {
          const rows = await api.getMiningTitles();
          // Live records carry every state and mineral on the grant; sample
          // records carry one of each. Collect from whichever is present.
          const states = new Set();
          const minerals = new Set();
          rows.forEach((t) => {
            (t.states || [t.state]).forEach((s) => s && states.add(s));
            (t.commodities || [t.commodity]).forEach((c) => c && minerals.add(c));
          });
          STATE_NAMES = [...states].sort();
          COMMODITY_NAMES = [...minerals].sort();
          return rows;
        },
        rowId: (t) => t.id,

        kpis: (list) => {
          const area = list.reduce((a, t) => a + t.areaHa, 0);
          const exp = list.filter((t) => t.status === 'Expiring').length;
          const ovl = list.filter((t) => t.overlap).length;
          return [
            { label: 'Titles', value: fmt.int(list.length), sub: `${list.filter((t) => t.status === 'Active').length} active`, accent: 'var(--gold)' },
            { label: 'Expiring', value: exp, sub: 'within 12 months', accent: 'var(--orange)' },
            { label: 'Licensed area', value: fmt.compact(area), sub: `ha · ${ovl} overlaps`, accent: 'var(--cyan)' },
          ];
        },

        stateFilterId: 'state',
        commodityFilterId: 'commodity',
        contextId: (c) => c.title,

        filters: [
          { id: 'state', label: 'State',
            options: [{ v: '*', l: 'All states' }, ...STATE_NAMES.map((n) => ({ v: n, l: n }))],
            // Cross-boundary grants list several states; match any of them.
            match: (t, v) => (t.states ? t.states.includes(v) : t.state === v) },
          { id: 'commodity', label: 'Commodity',
            options: [{ v: '*', l: 'All commodities' }],  // filled after load
            match: (t, v) => (t.commodities
              ? t.commodities.some((c) => c.toLowerCase() === String(v).toLowerCase())
              : t.commodity === v) },
          { id: 'type', label: 'Type',
            options: [{ v: '*', l: 'All types' }, { v: 'EL', l: 'Exploration Licence' },
              { v: 'ML', l: 'Mining Lease' }, { v: 'SSML', l: 'Small Scale Lease' },
              { v: 'QL', l: 'Quarry Lease' }, { v: 'RP', l: 'Reconnaissance' }],
            match: (t, v) => t.type === v },
          { id: 'status', label: 'Status',
            options: [{ v: '*', l: 'All status' }, { v: 'Active', l: 'Active' },
              { v: 'Expiring', l: 'Expiring' }, { v: 'Expired', l: 'Expired' },
              { v: 'Unknown', l: 'Date unrecorded' }],
            match: (t, v) => t.status === v },
          { id: 'flag', label: 'Integrity',
            options: [{ v: '*', l: 'All titles' }, { v: 'ovl', l: 'Overlaps only' }],
            match: (t, v) => (v === 'ovl' ? t.overlap : true) },
        ],

        search: (t, q) => t.id.toLowerCase().includes(q)
          || t.holder.toLowerCase().includes(q) || t.state.toLowerCase().includes(q)
          || t.commodity.toLowerCase().includes(q),

        columns: [
          { id: 'id', label: 'Title ID', get: (t) => t.id, mono: true },
          { id: 'type', label: 'Type', get: (t) => t.type },
          { id: 'state', label: 'State', get: (t) => t.state },
          { id: 'holder', label: 'Holder', get: (t) => t.holder },
          { id: 'commodity', label: 'Commodity', get: (t) => t.commodity },
          { id: 'area', label: 'Area (ha)', get: (t) => fmt.int(t.areaHa), sort: (t) => t.areaHa, align: 'r', mono: true },
          { id: 'expiry', label: 'Expiry', get: (t) => t.expiry ?? '—',
            sort: (t) => t.expiry ?? 9999, align: 'r', mono: true },
          { id: 'status', label: 'Status', get: (t) => t.status,
            render: (t) => `<span class="rg-tag" style="color:${STATUS_COLOR[t.status]}">${t.status}</span>${t.overlap ? '<i class="rg-dot" title="Overlap flagged"></i>' : ''}` },
        ],

        detail,

        onClick: (e, getSel) => {
          const t = getSel();
          if (e.target.closest('[data-go-map]') && t) {
            // No title polygons exist yet, so hand off the state and the
            // commodity's occurrences rather than the pending 'titles' layer.
            ctx.set({
              state: t.state, lga: null, occurrence: null, block: null,
              title: t.id, commodity: t.commodity, layer: 'deposits',
            });
            ctx.go('explore');
          }
          if (e.target.closest('[data-go-mineral]') && t) {
            ctx.set({ commodity: t.commodity, state: t.state, lga: null, occurrence: null, title: t.id });
            ctx.go('minerals');
          }
          if (e.target.closest('[data-go-pros]') && t) {
            ctx.set({ commodity: t.commodity, state: t.state, lga: null, title: t.id });
            ctx.go('prospectivity');
          }
          if (e.target.closest('[data-go-risk]') && t) {
            ctx.set({ state: t.state, lga: null, title: t.id });
            ctx.go('risk');
          }
          // Selecting one title reports exactly that title.
          if (e.target.closest('[data-add-report]') && t) {
            const ok = reports.add({ kind: 'title', id: t.id, title: `Mining title — ${t.id}` });
            toast(ok ? `Added title ${t.id} to the report`
              : `Title ${t.id} is already in the report`);
          }
          if (e.target.closest('[data-report-state]') && t) {
            const ok = reports.add({ kind: 'titles', id: t.state, title: `Mining titles — ${t.state}` });
            toast(ok ? `Added all ${t.state} titles to the report`
              : `${t.state} titles are already in the report`);
          }
          if (e.target.closest('[data-report-all]')) {
            const ok = reports.add({ kind: 'titles', id: null, title: 'Mining cadastre — national' });
            toast(ok ? 'Added the national cadastre to the report' : 'The national cadastre is already in the report');
          }
        },
      });

      await reg.mount();

      // Both option lists are only known once the cadastre has loaded, and the
      // shell renders before that — so fill them in, then apply the context so
      // an incoming state/commodity handoff can actually match an option.
      const fill = (id, all, values) => {
        const sel = view.querySelector(`[data-filter="${id}"]`);
        if (!sel) return;
        const keep = sel.value;
        sel.innerHTML = `<option value="*">${all}</option>`
          + values.map((v) => `<option value="${v}">${v}</option>`).join('');
        sel.value = keep;
      };
      fill('state', 'All states', STATE_NAMES);
      fill('commodity', 'All commodities', COMMODITY_NAMES);

      reg.applyContext();
    },

    onShow() { reg?.applyContext(); },
  };
}
