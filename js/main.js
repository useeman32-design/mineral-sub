/**
 * NIGERIA MINERAL INTELLIGENCE — application entry point
 * ======================================================
 * Boots the persistent shell once, registers every module with the router,
 * and hands control over. Adding a module later = one register() call; the
 * shell, design system and navigation need no changes.
 */

import { buildShell } from './components/shell.js?v=5b08fd6';
import { Router } from './core/router.js?v=5b08fd6';
import { store } from './core/store.js?v=5b08fd6';
import { api } from './data/api.js?v=5b08fd6';
import { $ } from './core/utils.js?v=5b08fd6';
import { createDashboard, toast } from './modules/dashboard.js?v=5b08fd6';
import { createStub } from './modules/stub.js?v=5b08fd6';
import { createSettings } from './modules/settings.js?v=5b08fd6';
import { createExplore } from './modules/explore.js?v=5b08fd6';
import { theme } from './core/theme.js?v=5b08fd6';
import { applyPrefs } from './modules/settings.js?v=5b08fd6';

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
    id: 'minerals', title: 'Minerals', keepAlive: false,
    factory: createStub({
      title: 'Minerals', glyph: 'minerals',
      blurb: 'Commodity-level intelligence across all 38 tracked minerals — occurrence registers, grade and tonnage records, host geology and producer activity.',
      features: ['Commodity registers', 'Grade & tonnage', 'Host lithology', 'Occurrence photos', 'Assay records', 'Producer index'],
    }),
  },
  {
    id: 'prospectivity', title: 'Prospectivity', keepAlive: false,
    factory: createStub({
      title: 'Prospectivity', glyph: 'prospectivity',
      blurb: 'Weighted-overlay and machine-learning prospectivity modelling with editable criteria, confidence surfaces and exportable target rankings.',
      features: ['Weighted overlay', 'ML target scoring', 'Confidence surfaces', 'Criteria editor', 'Target ranking', 'Model versioning'],
    }),
  },
  {
    id: 'risk', title: 'Risk Intelligence', keepAlive: false,
    factory: createStub({
      title: 'Risk Intelligence', glyph: 'risk',
      blurb: 'Composite exploration risk covering security advisories, environmental constraints, accessibility and community land status, scored per licence block.',
      features: ['Security advisories', 'Protected areas', 'Accessibility index', 'Community disputes', 'Composite scoring', 'Alert subscriptions'],
    }),
  },
  {
    id: 'oilgas', title: 'Oil & Gas', keepAlive: false,
    factory: createStub({
      title: 'Oil & Gas', glyph: 'oil',
      blurb: 'Upstream petroleum intelligence — licence blocks, field outlines, well records, production history and reserve accounting across all Nigerian basins.',
      features: ['Licence blocks (OML/OPL)', 'Field outlines', 'Well & log records', 'Production history', 'Reserves accounting', 'Basin analysis'],
    }),
  },
  {
    id: 'titles', title: 'Mining Titles', keepAlive: false,
    factory: createStub({
      title: 'Mining Titles', glyph: 'titles',
      blurb: 'Mining cadastre integration — exploration licences, small-scale and mining leases, holder records, expiry tracking and overlap detection.',
      features: ['Cadastre polygons', 'Holder registry', 'Expiry tracking', 'Overlap detection', 'Application status', 'Fee compliance'],
    }),
  },
  {
    id: 'reports', title: 'Reports', keepAlive: false,
    factory: createStub({
      title: 'Reports', glyph: 'reports',
      blurb: 'Generate investor-grade briefing documents — state resource profiles, prospectivity dossiers and due-diligence packs with map plates and charts.',
      features: ['State profiles', 'Prospect dossiers', 'Due-diligence packs', 'Map plate export', 'Scheduled delivery', 'Branding templates'],
    }),
  },
  {
    id: 'data', title: 'Data Center', keepAlive: false,
    factory: createStub({
      title: 'Data Center', glyph: 'data',
      blurb: 'Dataset catalogue and ingestion pipeline — survey lineage, coverage tracking, quality flags, versioning and bulk export in GIS-native formats.',
      features: ['Dataset catalogue', 'Ingestion pipeline', 'Lineage & provenance', 'Quality flags', 'Versioning', 'Bulk GIS export'],
    }),
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
  const router = new Router(shell.stage, shell.routeBar);

  MODULES.forEach((m) => router.register(m.id, {
    title: m.title, keepAlive: m.keepAlive, factory: m.factory,
  }));

  router.onChange((id) => shell.setActive(id));
  shell.onNav((id) => router.navigate(id));
  router.start('overview');

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

  // Remove boot splash
  const splash = document.getElementById('boot');
  if (splash) { splash.classList.add('is-out'); setTimeout(() => splash.remove(), 500); }
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
