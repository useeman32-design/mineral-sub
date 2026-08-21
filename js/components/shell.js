/**
 * Persistent application shell — built once at boot and never re-rendered.
 * Topbar + sidebar live outside the router's stage, so module changes never
 * touch them.
 */

import { icon, brandMark } from '../core/icons.js?v=db4eb0f';
import { store } from '../core/store.js?v=db4eb0f';
import { $, $$ } from '../core/utils.js?v=db4eb0f';

export const NAV = [
  { group: 'Intelligence', items: [
    { id: 'overview',      label: 'Overview',          ico: 'overview' },
    { id: 'explore',       label: 'Explore Map',       ico: 'map' },
    { id: 'minerals',      label: 'Minerals',          ico: 'minerals' },
    { id: 'prospectivity', label: 'Prospectivity',     ico: 'prospectivity' },
    { id: 'risk',          label: 'Risk Intelligence', ico: 'risk' },
  ]},
  { group: 'Assets', items: [
    { id: 'oilgas', label: 'Oil & Gas',    ico: 'oil' },
    { id: 'titles', label: 'Mining Titles', ico: 'titles' },
  ]},
  { group: 'Operations', items: [
    { id: 'reports', label: 'Reports',     ico: 'reports' },
    { id: 'data',    label: 'Data Center', ico: 'data' },
  ]},
];

export function buildShell(mountPoint) {
  mountPoint.innerHTML = `
    <div class="app" id="app">
      <header class="topbar" role="banner">
        <div class="brand">
          ${brandMark(30)}
          <div class="brand-text">
            <span class="l1">Nigeria Mineral</span>
            <span class="l2">Intelligence</span>
          </div>
        </div>

        <div class="gsearch">
          <span class="s-icon">${icon('search', { size: 14 })}</span>
          <input type="text" id="global-search" placeholder="Search states, commodities, prospects, titles…" autocomplete="off" aria-label="Global search" />
          <span class="kbd"><span>⌘</span><span>K</span></span>
        </div>

        <div class="spacer"></div>

        <div class="topbar-tools">
          <button class="pill loc-pill" id="loc-pill" title="Current geographic context">
            ${icon('pin', { size: 12 })}<span class="loc-name" id="loc-name">Nigeria</span>
            <span class="t-mono" style="font-size:9px;color:var(--text-faint)" id="loc-scope">NATIONAL</span>
          </button>

          <span class="pill pill-live" id="sys-pill" title="Data services status">
            <span class="live-dot"></span><span id="sys-text">System Online</span>
          </span>

          <span class="tb-divider"></span>

          <button class="icon-btn theme-btn" title="Toggle light / dark theme" id="btn-theme" aria-label="Toggle theme">
            <span class="ico-moon">${icon('moon', { size: 16 })}</span>
            <span class="ico-sun">${icon('sun', { size: 16 })}</span>
          </button>
          <button class="icon-btn has-dot" title="Notifications" id="btn-bell">
            ${icon('bell', { size: 17 })}<span class="dot"></span>
          </button>
          <button class="icon-btn" title="Settings" id="btn-settings-top">${icon('settings', { size: 17 })}</button>

          <span class="tb-divider"></span>

          <button class="user-btn" id="btn-user">
            <span class="avatar">AO</span>
            <span class="user-meta">
              <span class="un">A. Okafor</span>
              <span class="ur">Lead Geologist</span>
            </span>
            ${icon('chevron', { size: 13, cls: 't-low' })}
          </button>
        </div>
      </header>

      <nav class="sidebar" role="navigation" aria-label="Modules">
        <div class="nav-scroll">
          ${NAV.map((g) => `
            <div class="nav-group">
              <div class="nav-group-label">${g.group}</div>
              ${g.items.map((it) => `
                <button class="nav-item" data-route="${it.id}" title="${it.label}">
                  ${icon(it.ico, { size: 17, cls: 'ico' })}
                  <span class="lbl">${it.label}</span>
                  ${it.id === 'reports' ? '<span class="nav-badge cart" data-cart-count hidden>0</span>' : ''}
                </button>`).join('')}
            </div>`).join('')}
        </div>

        <div class="sidebar-ft">
          <div class="sys-mini">
            <div class="r"><span class="k">Tile Service</span><span class="v" id="sm-tiles">NMI-VEC 4.2</span></div>
            <div class="r"><span class="k">Latency</span><span class="v" id="sm-lat">42 ms</span></div>
            <div class="r"><span class="k">Last Sync</span><span class="v" id="sm-sync">2 min</span></div>
          </div>

          <button class="nav-item" data-route="settings" title="Settings">
            ${icon('settings', { size: 17, cls: 'ico' })}<span class="lbl">Settings</span>
          </button>
          <button class="nav-item" id="nav-profile" title="Profile">
            ${icon('logout', { size: 17, cls: 'ico' })}<span class="lbl">Sign out</span>
          </button>

          <div style="height:8px"></div>
          <button class="rail-toggle" id="rail-toggle" title="Collapse sidebar">
            ${icon('chevronL', { size: 13 })}<span class="rt-label">Collapse</span>
          </button>
        </div>
      </nav>

      <main class="stage" id="stage" role="main">
        <div class="route-bar" id="route-bar"></div>
      </main>
    </div>`;

  const app = $('#app', mountPoint);

  /* rail collapse */
  $('#rail-toggle', app).addEventListener('click', () => {
    const c = !store.get('railCollapsed');
    store.set({ railCollapsed: c });
    app.classList.toggle('is-rail', c);
    setTimeout(() => dispatchEvent(new Event('resize')), 240);
  });

  /* location pill reflects drill context */
  store.subscribe('drill', (d) => {
    $('#loc-name', app).textContent = d.state || 'Nigeria';
    $('#loc-scope', app).textContent = (d.state ? 'STATE' : 'NATIONAL');
  });

  /* global search focus shortcut */
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#global-search', app).focus();
    }
    if (e.key === 'Escape') $('#global-search', app).blur();
  });

  return {
    app,
    stage: $('#stage', app),
    routeBar: $('#route-bar', app),
    setActive(id) {
      $$('.nav-item', app).forEach((n) => n.classList.toggle('is-active', n.dataset.route === id));
    },
    onNav(fn) {
      app.addEventListener('click', (e) => {
        const b = e.target.closest('[data-route]');
        if (b) fn(b.dataset.route);
      });
      $('#btn-settings-top', app).addEventListener('click', () => fn('settings'));
    },
  };
}
