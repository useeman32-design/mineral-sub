/**
 * OIL & GAS MODULE
 * ================
 * Upstream petroleum: licence blocks with operator, terrain, production and
 * reserve figures. Built on the shared register view so it behaves exactly
 * like Mining Titles.
 */

import { fmt } from '../core/utils.js?v=eb3c4a3';
import { icon } from '../core/icons.js?v=eb3c4a3';
import { api } from '../data/api.js?v=eb3c4a3';
import { ctx } from '../core/context.js?v=eb3c4a3';
import { reports } from '../core/reports.js?v=eb3c4a3';
import { createRegister } from '../components/register.js?v=eb3c4a3';
import { toast } from './dashboard.js?v=eb3c4a3';

const STATUS_COLOR = {
  Producing: 'var(--green)',
  Development: 'var(--gold)',
  Appraisal: 'var(--cyan)',
};

export function createOilGas() {
  let reg;

  const detail = (b) => `
    <div class="rg-card" style="--rc:${STATUS_COLOR[b.status] || 'var(--cyan)'}">
      <header class="rg-card-hd">
        <div>
          <div class="rg-card-k">${b.kind} · ${b.terrain}</div>
          <h2>${b.id}</h2>
          <div class="rg-card-s">${b.operator}</div>
        </div>
        <span class="rg-badge" style="color:${STATUS_COLOR[b.status]}">${b.status}</span>
      </header>

      <div class="rg-metrics">
        <div><span>Oil</span><b class="t-mono">${fmt.int(b.oilBopd)}</b><em>bopd</em></div>
        <div><span>Gas</span><b class="t-mono">${b.gasMmscfd}</b><em>mmscf/d</em></div>
        <div><span>Reserves</span><b class="t-mono">${b.reservesMmboe}</b><em>mmboe</em></div>
      </div>

      <div class="pr-facts">
        ${fact('State', b.state)}
        ${fact('Terrain', b.terrain)}
        ${fact('Licence area', `<span class="t-mono">${fmt.int(b.areaKm2)} km²</span>`)}
        ${fact('Wells drilled', `<span class="t-mono">${b.wells}</span>`)}
        ${fact('Awarded', `<span class="t-mono">${b.awarded}</span>`)}
        ${fact('Expiry', `<span class="t-mono">${b.expiry}</span>`)}
      </div>

      <div class="ctx-acts">
        <button class="btn-ghost btn-primary" data-go-map>${icon('map', { size: 13 })} View on map</button>
        <button class="btn-ghost" data-go-risk>${icon('risk', { size: 13 })} Risk</button>
        <button class="btn-ghost" data-add-report>${icon('reports', { size: 13 })} Add to report</button>
      </div>
    </div>`;

  const fact = (l, v) => `
    <div class="pr-fact"><span class="pr-fact-l">${l}</span><span class="pr-fact-v">${v}</span></div>`;

  return {
    async mount(view) {
      reg = createRegister(view, {
        title: 'Oil & Gas',
        blurb: 'Upstream petroleum licence blocks across the Niger Delta, Anambra and Dahomey basins — operators, production and reserve accounting.',
        accent: 'accent-cyan',
        glyph: 'oil',
        tableTitle: 'Licence blocks',
        searchHint: 'Search block, operator or state',
        loadingLabel: 'Loading petroleum register…',
        emptyHint: 'Block production, reserves and licence dates open here.',
        defaultSort: 'oil',
        defaultDir: 'desc',
        load: () => api.getPetroleumBlocks(),
        rowId: (b) => b.id,

        kpis: (list) => {
          const oil = list.reduce((a, b) => a + b.oilBopd, 0);
          const gas = list.reduce((a, b) => a + b.gasMmscfd, 0);
          const prod = list.filter((b) => b.status === 'Producing').length;
          return [
            { label: 'Blocks', value: list.length, sub: `${prod} producing`, accent: 'var(--cyan)' },
            { label: 'Oil output', value: fmt.compact(oil), sub: 'bopd, gross', accent: 'var(--green)' },
            { label: 'Gas output', value: fmt.int(gas), sub: 'mmscf/d', accent: 'var(--gold)' },
          ];
        },

        filters: [
          { id: 'kind', label: 'Type',
            options: [{ v: '*', l: 'All types' }, { v: 'OML', l: 'OML' }, { v: 'OPL', l: 'OPL' }],
            match: (b, v) => b.kind === v },
          { id: 'terrain', label: 'Terrain',
            options: [{ v: '*', l: 'All terrain' }, { v: 'Onshore', l: 'Onshore' },
              { v: 'Swamp', l: 'Swamp' }, { v: 'Shallow offshore', l: 'Shallow offshore' },
              { v: 'Deep offshore', l: 'Deep offshore' }],
            match: (b, v) => b.terrain === v },
          { id: 'status', label: 'Status',
            options: [{ v: '*', l: 'All status' }, { v: 'Producing', l: 'Producing' },
              { v: 'Development', l: 'Development' }, { v: 'Appraisal', l: 'Appraisal' }],
            match: (b, v) => b.status === v },
        ],

        search: (b, q) => b.id.toLowerCase().includes(q)
          || b.operator.toLowerCase().includes(q) || b.state.toLowerCase().includes(q),

        columns: [
          { id: 'block', label: 'Block', get: (b) => b.id, mono: true },
          { id: 'kind', label: 'Type', get: (b) => b.kind },
          { id: 'state', label: 'State', get: (b) => b.state },
          { id: 'terrain', label: 'Terrain', get: (b) => b.terrain },
          { id: 'operator', label: 'Operator', get: (b) => b.operator },
          { id: 'oil', label: 'Oil (bopd)', get: (b) => fmt.int(b.oilBopd), sort: (b) => b.oilBopd, align: 'r', mono: true },
          { id: 'gas', label: 'Gas', get: (b) => b.gasMmscfd, sort: (b) => b.gasMmscfd, align: 'r', mono: true },
          { id: 'status', label: 'Status', get: (b) => b.status,
            render: (b) => `<span class="rg-tag" style="color:${STATUS_COLOR[b.status]}">${b.status}</span>` },
        ],

        detail,

        onClick: (e, getSel) => {
          const b = getSel();
          if (e.target.closest('[data-go-map]') && b) {
            ctx.set({ state: b.state, lga: null, occurrence: null, commodity: 'oil', layer: 'deposits' });
            ctx.go('explore');
          }
          if (e.target.closest('[data-go-risk]') && b) {
            ctx.set({ state: b.state, lga: null });
            ctx.go('risk');
          }
          if (e.target.closest('[data-add-report]') && b) {
            const ok = reports.add({ kind: 'petroleum', id: b.state, title: `Petroleum blocks — ${b.state}` });
            toast(ok ? `Added ${b.state} petroleum blocks to the report`
              : `${b.state} petroleum blocks are already in the report`);
          }
          if (e.target.closest('[data-report-all]')) {
            const ok = reports.add({ kind: 'petroleum', id: null, title: 'Petroleum licence blocks — national' });
            toast(ok ? 'Added national petroleum register to the report'
              : 'National petroleum register is already in the report');
          }
        },
      });

      await reg.mount();
    },
  };
}
