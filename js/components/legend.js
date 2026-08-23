/**
 * Shared resource legend — identical in Overview and Explore.
 * Collapses to a compact pill; state persists per module scope.
 */

import { icon } from '../core/icons.js?v=acb5907';
import { RESOURCE_META } from '../data/fixtures.js?v=acb5907';
import { $, $$ } from '../core/utils.js?v=acb5907';

export const LEGEND_RESOURCES = ['gold', 'lithium', 'tin', 'iron', 'lead', 'barite', 'oil', 'gas'];

/**
 * @param {HTMLElement} stage  map container
 * @param {object} opts
 * @param {string} opts.scope  storage key suffix ('overview' | 'explore')
 * @param {Function} opts.onToggle (resourceIds[]) => void
 * @param {Function} opts.getActive () => resourceIds[]
 */
export function createLegend(stage, { scope = 'map', onToggle, getActive } = {}) {
  const KEY = `nmi.legendHidden.${scope}`;

  const legend = document.createElement('div');
  legend.className = 'map-ui map-legend glass-bar';
  legend.dataset.legend = scope;
  legend.innerHTML = `
    <div class="lg-hd">
      <span>Resource Legend</span>
      <span class="lg-acts">
        <button class="lg-toggle" data-lg-all title="Show / hide all">${icon('eye', { size: 12 })}</button>
        <button class="lg-toggle" data-lg-collapse title="Hide legend">${icon('minus', { size: 12 })}</button>
      </span>
    </div>
    <div class="lg-list">
      ${LEGEND_RESOURCES.map((r) => {
        const m = RESOURCE_META[r];
        return `<div class="lg-row" data-lg="${r}">
          <i class="lg-dot" style="background:${m.hex};box-shadow:0 0 6px ${m.hex}"></i>
          <span>${m.label}</span></div>`;
      }).join('')}
    </div>
    <div class="lg-scale"><span>Low</span><div class="lg-ramp"></div><span>High</span></div>`;
  stage.appendChild(legend);

  const pill = document.createElement('button');
  pill.className = 'map-ui legend-pill';
  pill.dataset.legendPill = scope;
  pill.innerHTML = `${icon('layers', { size: 12 })}<span>Legend</span>`;
  stage.appendChild(pill);

  function setHidden(hidden) {
    legend.hidden = hidden;
    pill.hidden = !hidden;
    localStorage.setItem(KEY, hidden ? '1' : '0');
  }
  setHidden(localStorage.getItem(KEY) === '1');
  pill.addEventListener('click', () => setHidden(false));

  function sync(list) {
    $$('.lg-row', legend).forEach((r) => r.classList.toggle('is-off', !list.includes(r.dataset.lg)));
  }

  legend.addEventListener('click', (e) => {
    if (e.target.closest('[data-lg-collapse]')) { setHidden(true); return; }

    if (e.target.closest('[data-lg-all]')) {
      const cur = getActive();
      const list = cur.length === LEGEND_RESOURCES.length ? [] : [...LEGEND_RESOURCES];
      onToggle(list); sync(list);
      return;
    }
    const row = e.target.closest('.lg-row');
    if (!row) return;
    const id = row.dataset.lg;
    const cur = [...getActive()];
    const list = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onToggle(list); sync(list);
  });

  sync(getActive());
  return { el: legend, pill, sync, setHidden };
}
