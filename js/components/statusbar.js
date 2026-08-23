/**
 * Shared map status bar — the drill breadcrumb plus a live coordinate
 * readout. Used identically by Overview and Explore.
 */

import { icon } from '../core/icons.js?v=acb5907';
import { store } from '../core/store.js?v=acb5907';
import { fmt, $ } from '../core/utils.js?v=acb5907';

const NEXT = { nation: 'state', state: 'LGA', lga: 'local area', local: 'prospect', prospect: 'occurrence' };

export function createStatusBar(stage, nmap, { onCrumb } = {}) {
  const bar = document.createElement('div');
  bar.className = 'map-ui map-statusbar';
  stage.appendChild(bar);

  function render() {
    const d = store.get('drill');
    const parts = [{ id: 'nation', label: 'Nigeria' }];
    if (d.state) parts.push({ id: 'state', label: d.state });
    if (d.lga) parts.push({ id: 'lga', label: d.lga });
    if (d.prospect) parts.push({ id: 'prospect', label: d.prospect });

    bar.innerHTML = `
      <div class="sb-crumbs">
        ${parts.map((p, i) => `
          <button class="crumb ${i === parts.length - 1 ? 'is-current' : ''}" data-crumb="${p.id}">
            ${i === 0 ? icon('pin', { size: 11 }) : ''}<span>${p.label}</span>
          </button>
          ${i < parts.length - 1 ? `<span class="crumb-sep">${icon('chevronR', { size: 10 })}</span>` : ''}`).join('')}
        <span class="crumb-sep">${icon('chevronR', { size: 10 })}</span>
        <span class="crumb-next">${NEXT[d.level] || 'detail'}</span>
      </div>
      <span class="sb-sep"></span>
      <span class="sb-coord" title="Cursor position">
        ${icon('crosshair', { size: 11 })}<b class="t-mono" data-coord>—</b>
      </span>
      <span class="sb-sep"></span>
      <span class="sb-metric" title="Zoom level">Z <b class="t-mono" data-zoom>—</b></span>
      <span class="sb-sep"></span>
      <span class="sb-metric" title="Detail level">
        <b class="t-mono sb-band" data-band>nation</b>
      </span>`;
  }

  render();
  const unsub = store.subscribe('drill', () => { render(); nmap._emitScale?.(); });

  bar.addEventListener('click', (e) => {
    const c = e.target.closest('[data-crumb]');
    if (!c) return;
    if (c.dataset.crumb === 'nation') nmap.resetView();
    onCrumb?.(c.dataset.crumb);
  });

  // Live coordinates, throttled to animation frames
  let pending = null, raf = 0;
  const write = () => {
    raf = 0;
    const el = $('[data-coord]', bar);
    if (el && pending) el.textContent = fmt.coord(pending.lat, pending.lng);
  };
  const onMove = (e) => {
    pending = e.latlng;
    if (!raf) raf = requestAnimationFrame(write);
  };
  const onOut = () => {
    pending = null;
    const el = $('[data-coord]', bar);
    if (el) el.textContent = '—';
  };
  nmap.map.on('mousemove', onMove);
  nmap.map.on('mouseout', onOut);

  const onScale = (e) => {
    const z = $('[data-zoom]', bar);
    const bd = $('[data-band]', bar);
    if (z) z.textContent = e.detail.zoom.toFixed(1);
    if (bd) {
      bd.textContent = e.detail.band;
      bd.dataset.level = e.detail.band;
    }
  };
  stage.addEventListener('map:scale', onScale);

  // seed immediately so the bar is never blank before the first zoom event
  requestAnimationFrame(() => nmap._emitScale?.());

  return {
    el: bar,
    destroy() {
      unsub();
      nmap.map.off('mousemove', onMove);
      nmap.map.off('mouseout', onOut);
      stage.removeEventListener('map:scale', onScale);
    },
  };
}
