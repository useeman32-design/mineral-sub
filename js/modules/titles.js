/**
 * MINING TITLES MODULE
 * ====================
 * The cadastre: exploration licences, mining leases, quarry leases and small
 * scale permits, with expiry tracking and overlap flags — the two things that
 * matter most when reading a title register.
 */

import { fmt } from '../core/utils.js?v=effc9f2';
import { icon } from '../core/icons.js?v=effc9f2';
import { api } from '../data/api.js?v=effc9f2';
import { ctx } from '../core/context.js?v=effc9f2';
import { reports } from '../core/reports.js?v=effc9f2';
import { createRegister } from '../components/register.js?v=effc9f2';
import { toast } from './dashboard.js?v=effc9f2';

const STATUS_COLOR = {
  Active: 'var(--green)',
  Expiring: 'var(--gold)',
  Expired: 'var(--red)',
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
        load: () => api.getMiningTitles(),
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

        filters: [
          { id: 'type', label: 'Type',
            options: [{ v: '*', l: 'All types' }, { v: 'EL', l: 'Exploration Licence' },
              { v: 'ML', l: 'Mining Lease' }, { v: 'SSML', l: 'Small Scale Lease' },
              { v: 'QL', l: 'Quarry Lease' }, { v: 'RP', l: 'Reconnaissance' }],
            match: (t, v) => t.type === v },
          { id: 'status', label: 'Status',
            options: [{ v: '*', l: 'All status' }, { v: 'Active', l: 'Active' },
              { v: 'Expiring', l: 'Expiring' }, { v: 'Expired', l: 'Expired' }],
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
          { id: 'expiry', label: 'Expiry', get: (t) => t.expiry, align: 'r', mono: true },
          { id: 'status', label: 'Status', get: (t) => t.status,
            render: (t) => `<span class="rg-tag" style="color:${STATUS_COLOR[t.status]}">${t.status}</span>${t.overlap ? '<i class="rg-dot" title="Overlap flagged"></i>' : ''}` },
        ],

        detail,

        onClick: (e, getSel) => {
          const t = getSel();
          if (e.target.closest('[data-go-map]') && t) {
            // No title polygons exist yet, so hand off the state and the
            // commodity's occurrences rather than the pending 'titles' layer.
            ctx.set({ state: t.state, lga: null, occurrence: null, commodity: t.commodity, layer: 'deposits' });
            ctx.go('explore');
          }
          if (e.target.closest('[data-go-mineral]') && t) {
            ctx.set({ commodity: t.commodity, state: t.state, lga: null, occurrence: null });
            ctx.go('minerals');
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
    },
  };
}
