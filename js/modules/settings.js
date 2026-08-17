/**
 * SETTINGS MODULE
 * Real, working preferences. Appearance is wired end-to-end; the remaining
 * groups persist to localStorage so the API can adopt them later.
 */

import { icon } from '../core/icons.js?v=a2f4c1d';
import { theme } from '../core/theme.js?v=a2f4c1d';
import { store } from '../core/store.js?v=a2f4c1d';
import { $, $$ } from '../core/utils.js?v=a2f4c1d';
import { toast } from './dashboard.js?v=a2f4c1d';

const PREFS_KEY = 'nmi.prefs';

const DEFAULTS = {
  units: 'metric',
  coordFormat: 'dd',
  density: 'comfortable',
  motion: 'full',
  mapLabels: true,
  autoSatellite: true,
  pulseMarkers: true,
};

export function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

export function savePrefs(p) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  dispatchEvent(new CustomEvent('nmi:prefs', { detail: p }));
}

export function applyPrefs(p = loadPrefs()) {
  document.documentElement.setAttribute('data-density', p.density);
  document.documentElement.setAttribute('data-motion', p.motion);
  store.set({ prefs: p });
}

export function createSettings() {
  let root;

  const swatch = (t) => t === 'light'
    ? `<span class="th-prev th-light"><i></i><i></i><i></i></span>`
    : t === 'dark'
      ? `<span class="th-prev th-dark"><i></i><i></i><i></i></span>`
      : `<span class="th-prev th-sys"><i></i><i></i><i></i></span>`;

  const card = (title, accent, body) => `
    <article class="panel set-card">
      <header class="panel-hd">
        <span class="accent-bar ${accent}"></span><h3>${title}</h3>
      </header>
      <div class="panel-bd">${body}</div>
    </article>`;

  const row = (label, hint, control) => `
    <div class="set-row">
      <div class="set-row-t">
        <div class="set-label">${label}</div>
        ${hint ? `<div class="set-hint">${hint}</div>` : ''}
      </div>
      <div class="set-ctl">${control}</div>
    </div>`;

  const seg = (name, opts, val) => `
    <div class="set-seg" data-seg="${name}">
      ${opts.map((o) => `<button data-val="${o.v}" class="${o.v === val ? 'is-on' : ''}">${o.l}</button>`).join('')}
    </div>`;

  const toggle = (name, on) => `
    <button class="set-switch ${on ? 'is-on' : ''}" data-toggle="${name}" role="switch" aria-checked="${on}">
      <span class="knob"></span>
    </button>`;

  function render(view) {
    const p = loadPrefs();
    const pref = theme.preference;

    view.innerHTML = `
      <div class="set-wrap">
        <header class="set-head">
          <div>
            <h1>Settings</h1>
            <p>Workspace preferences. Appearance and map options apply immediately and persist on this device.</p>
          </div>
          <button class="btn-ghost" id="set-reset" style="flex:none;padding:0 14px">Reset to defaults</button>
        </header>

        <div class="set-grid">
          ${card('Appearance', '', `
            <div class="theme-picker" id="theme-picker">
              ${['dark', 'light', 'system'].map((t) => `
                <button class="theme-opt ${pref === t ? 'is-on' : ''}" data-theme-opt="${t}">
                  ${swatch(t)}
                  <span class="th-name">${t === 'system' ? 'System' : t[0].toUpperCase() + t.slice(1)}</span>
                  <span class="th-tick">${icon('check', { size: 12, sw: 2.6 })}</span>
                </button>`).join('')}
            </div>
            ${row('Interface density', 'Compact fits more data per screen',
              seg('density', [{ v: 'comfortable', l: 'Comfortable' }, { v: 'compact', l: 'Compact' }], p.density))}
            ${row('Motion', 'Reduce animation and pulsing markers',
              seg('motion', [{ v: 'full', l: 'Full' }, { v: 'reduced', l: 'Reduced' }], p.motion))}
          `)}

          ${card('Map & Units', 'accent-cyan', `
            ${row('Measurement units', null,
              seg('units', [{ v: 'metric', l: 'Metric' }, { v: 'imperial', l: 'Imperial' }], p.units))}
            ${row('Coordinate format', 'Decimal degrees or degrees-minutes-seconds',
              seg('coordFormat', [{ v: 'dd', l: 'DD' }, { v: 'dms', l: 'DMS' }], p.coordFormat))}
            ${row('Show map labels', 'State and deposit names on the map', toggle('mapLabels', p.mapLabels))}
            ${row('Auto satellite at depth', 'Switch to imagery below local zoom', toggle('autoSatellite', p.autoSatellite))}
            ${row('Pulsing site markers', 'Animated halo on major occurrences', toggle('pulseMarkers', p.pulseMarkers))}
          `)}

          ${card('Data Sources', 'accent-purple', `
            <div class="set-src">
              ${[
                ['Boundary service', 'geoBoundaries ADM1 / ADM2', 'Connected', 'ok'],
                ['Occurrence registry', 'NMI placeholder fixtures', 'Sample data', 'warn'],
                ['Satellite imagery', 'ArcGIS World Imagery', 'On demand', 'ok'],
                ['Prospectivity engine', 'Awaiting API binding', 'Not connected', 'off'],
              ].map(([n, d, s, k]) => `
                <div class="src-row">
                  <div><div class="set-label">${n}</div><div class="set-hint">${d}</div></div>
                  <span class="src-badge src-${k}">${s}</span>
                </div>`).join('')}
            </div>
            ${row('API base URL', 'Where the Laravel backend is mounted',
              `<code class="set-code">/api/v1</code>`)}
          `)}

          ${card('Account', 'accent-gold', `
            <div class="set-user">
              <span class="avatar" style="width:42px;height:42px;font-size:13px">AO</span>
              <div>
                <div class="set-label" style="font-size:var(--fs-md)">A. Okafor</div>
                <div class="set-hint">Lead Geologist · Federal Ministry of Solid Minerals</div>
              </div>
            </div>
            ${row('Role', 'Determines module access', `<span class="set-tagv">Administrator</span>`)}
            ${row('Region scope', 'Data visibility boundary', `<span class="set-tagv">National — 36 states + FCT</span>`)}
          `)}
        </div>
      </div>`;
  }

  function wire(view) {
    view.addEventListener('click', (e) => {
      // theme
      const t = e.target.closest('[data-theme-opt]');
      if (t) {
        theme.set(t.dataset.themeOpt);
        $$('.theme-opt', view).forEach((n) => n.classList.toggle('is-on', n === t));
        toast(`Theme: ${t.dataset.themeOpt}`);
        return;
      }

      // segmented controls
      const sb = e.target.closest('.set-seg button');
      if (sb) {
        const name = sb.closest('[data-seg]').dataset.seg;
        const p = loadPrefs();
        p[name] = sb.dataset.val;
        savePrefs(p); applyPrefs(p);
        sb.parentElement.querySelectorAll('button').forEach((n) => n.classList.toggle('is-on', n === sb));
        return;
      }

      // switches
      const sw = e.target.closest('[data-toggle]');
      if (sw) {
        const name = sw.dataset.toggle;
        const p = loadPrefs();
        p[name] = !p[name];
        savePrefs(p); applyPrefs(p);
        sw.classList.toggle('is-on', p[name]);
        sw.setAttribute('aria-checked', String(p[name]));
        return;
      }

      if (e.target.closest('#set-reset')) {
        savePrefs({ ...DEFAULTS });
        applyPrefs({ ...DEFAULTS });
        theme.set('dark');
        render(view); wire(view);
        toast('Settings restored to defaults');
      }
    });
  }

  return {
    mount(view) { root = view; render(view); wire(view); },
    onShow() { if (root) { render(root); } },
  };
}
