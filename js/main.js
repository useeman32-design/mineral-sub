/**
 * NIGERIA MINERAL INTELLIGENCE — application entry point
 * ======================================================
 * Boots the persistent shell once, registers every module with the router,
 * and hands control over. Adding a module later = one register() call; the
 * shell, design system and navigation need no changes.
 */

import { buildShell } from './components/shell.js?v=c902723';
import { createGlobalSearch } from './components/search.js?v=c902723';
import { Router } from './core/router.js?v=c902723';
import { store } from './core/store.js?v=c902723';
import { reports } from './core/reports.js?v=c902723';
import { liveMode } from './data/live.js?v=c902723';
import { dsToggles, DATASET_LAYER } from './data/toggles.js?v=c902723';
import { api } from './data/api.js?v=c902723';
import { $ } from './core/utils.js?v=c902723';
import { createDashboard, toast } from './modules/dashboard.js?v=c902723';
import { createSettings } from './modules/settings.js?v=c902723';
import { createMinerals } from './modules/minerals.js?v=c902723';
import { createProspectivity } from './modules/prospectivity.js?v=c902723';
import { createRisk } from './modules/risk.js?v=c902723';
import { createOilGas } from './modules/oilgas.js?v=c902723';
import { createTitles } from './modules/titles.js?v=c902723';
import { createReports } from './modules/reports.js?v=c902723';
import { createDataCenter } from './modules/data.js?v=c902723';
import { createExplore } from './modules/explore.js?v=c902723';
import { theme } from './core/theme.js?v=c902723';
import { applyPrefs } from './modules/settings.js?v=c902723';

const MODULES = [
  {
    id: 'overview', title: 'Overview', keepAlive: true,
    factory: () => createDashboard(),
  },
  {
    id: 'explore', title: 'Explore Map', keepAlive: true,
    factory: () => createExplore(),
  },
  {
    id: 'minerals', title: 'Minerals', keepAlive: true,
    factory: () => createMinerals(),
  },
  {
    id: 'prospectivity', title: 'Prospectivity', keepAlive: true,
    factory: () => createProspectivity(),
  },
  {
    id: 'risk', title: 'Risk Intelligence', keepAlive: true,
    factory: () => createRisk(),
  },
  {
    id: 'oilgas', title: 'Oil & Gas', keepAlive: true,
    factory: () => createOilGas(),
  },
  {
    id: 'titles', title: 'Mining Titles', keepAlive: true,
    factory: () => createTitles(),
  },
  {
    id: 'reports', title: 'Reports', keepAlive: false,
    factory: () => createReports(),
  },
  {
    id: 'data', title: 'Data Center', keepAlive: true,
    factory: () => createDataCenter(),
  },
  {
    id: 'settings', title: 'Settings', keepAlive: true,
    factory: () => createSettings(),
  },
];

function boot() {
  // Theme + saved preferences must apply before the first paint of the shell
  theme.init();
  applyPrefs();

  const shell = buildShell(document.getElementById('root'));

  // Global search reaches every module and hands off through core/context.
  createGlobalSearch(document.getElementById('global-search'), { api });

  const router = new Router(shell.stage, shell.routeBar);

  MODULES.forEach((m) => router.register(m.id, {
    title: m.title, keepAlive: m.keepAlive, factory: m.factory,
  }));

  router.onChange((id) => shell.setActive(id));
  shell.onNav((id) => router.navigate(id));
  router.start('overview');

  // Excluding a dataset in the Data Center immediately drops its map layer,
  // so the two controls can never disagree about what is being shown.
  dsToggles.subscribe((id) => {
    const layerId = id ? DATASET_LAYER[id] : null;
    if (layerId) store.set({ layers: { ...store.get('layers'), [layerId]: false } });
    api.clearCache();
    // Rebuilding every view drops lazily-drawn map layers, so Explore restores
    // them from the store on remount (see explore.js). Keep the reset — the
    // cached data really is stale — but never reset the view the user is on.
    router.resetViews({ except: router.current });
  });

  // System health -> topbar + sidebar readouts (API-ready)
  api.getSystemHealth().then((h) => {
    store.set({ dataStatus: h });
    const t = document.getElementById('sm-tiles'); if (t) t.textContent = h.tiles;
    const l = document.getElementById('sm-lat');   if (l) l.textContent = h.latencyMs + ' ms';
    const s = document.getElementById('sm-sync');  if (s) s.textContent = h.lastSync;
  });

  // Topbar affordances
  document.getElementById('btn-theme')?.addEventListener('click', () => {
    const t = theme.toggle();
    toast(`${t === 'light' ? 'Light' : 'Dark'} theme`);
  });
  document.getElementById('btn-bell')?.addEventListener('click', () => toast('3 unread advisories · notification centre coming soon'));
  document.getElementById('btn-user')?.addEventListener('click', () => toast('Account menu arrives with the auth service'));
  document.getElementById('nav-profile')?.addEventListener('click', () => toast('Sign-out requires the auth service'));
  document.getElementById('loc-pill')?.addEventListener('click', () => {
    const d = store.get('drill');
    toast(d.state ? `Context: ${d.state} · click the map background to reset` : 'Context: national extent');
  });

  const gs = document.getElementById('global-search');
  gs?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && gs.value.trim()) {
      toast(`Global search wires into the unified index: "${gs.value.trim()}"`);
    }
  });

  // Data-mode indicator: the existing system pill doubles as the live/sample
  // badge, so the user always knows which dataset the numbers came from.
  const syncMode = (on) => {
    const pill = document.getElementById('sys-pill');
    const text = document.getElementById('sys-text');
    if (!pill || !text) return;
    pill.classList.toggle('is-livedata', on);
    text.textContent = on ? 'Live Data' : 'System Online';
    pill.title = on
      ? 'Serving real government datasets — see Data Center'
      : 'Serving sample data — enable Go Live in Data Center';
  };
  syncMode(liveMode.enabled);
  liveMode.subscribe((on) => {
    syncMode(on);
    // Keep-alive modules hold rows rendered from the previous source, so drop
    // every view except the one the user is looking at (Data Center repaints
    // itself). They rebuild from the new source on next visit.
    api.clearCache();
    router.resetViews({ except: router.current });
  });

  // Sidebar report-cart counter — the badge slot vacated by live/soon.
  const syncCart = (n) => {
    const b = document.querySelector('[data-cart-count]');
    if (!b) return;
    b.textContent = n;
    b.hidden = n === 0;
  };
  syncCart(reports.count);
  reports.subscribe((items) => syncCart(items.length));

  // Remove boot splash
  const splash = document.getElementById('boot');
  if (splash) { splash.classList.add('is-out'); setTimeout(() => splash.remove(), 500); }
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
