# Nigeria Mineral Intelligence

A futuristic GIS / natural-resource intelligence workstation for Nigeria's mineral,
geological, environmental, security and petroleum resources.

Built with **HTML5 + CSS3 + vanilla JavaScript (ES modules)**. No build step, no
framework. Leaflet is vendored locally — the app runs fully offline.

---

## Running

Because the app uses ES modules and `fetch()`, it must be served over HTTP
(opening `index.html` from the filesystem will not work).

```bash
cd nmi
python3 -m http.server 3000
# → http://localhost:3000
```

---

## Architecture

```
nmi/
├── index.html                  # single document — loaded once, never again
├── css/
│   ├── tokens.css              # design tokens: the single source of visual truth
│   ├── base.css                # reset, text/panel/chip primitives, micro-charts
│   ├── shell.css               # topbar, sidebar, view stage, module stub
│   ├── dashboard.css           # dashboard grid, map surface, intel rail
│   └── overrides.css           # Leaflet theming, boot splash, toast
├── data/
│   └── nigeria-states.geojson  # 37 ADM1 polygons (geoBoundaries, simplified)
├── vendor/leaflet/             # Leaflet 1.9.4, vendored (no CDN at runtime)
└── js/
    ├── main.js                 # entry: boots shell, registers modules
    ├── core/
    │   ├── scoring.js          # weighted-overlay prospectivity model (no DOM)
    │   ├── router.js           # hash SPA router with keep-alive modules
    │   ├── store.js            # observable cross-module state
    │   ├── icons.js            # inline SVG icon registry
    │   └── utils.js            # DOM/format helpers + sparkline/ring/donut/bars
    ├── data/
    │   ├── api.js              # ⇦ THE ONLY PLACE THAT TALKS TO A BACKEND
    │   └── fixtures.js         # realistic placeholder payloads
    ├── components/
    │   ├── shell.js            # persistent topbar + sidebar (built once)
    │   ├── map.js              # Nigeria GIS engine (Leaflet)
    │   └── map-toolbar.js      # floating map UI: filters, layers, zoom, legend
    └── modules/
        ├── dashboard.js        # the Overview module (fully implemented)
        ├── explore.js          # Explore Map: docks, drawing, measurement
        ├── minerals.js         # Minerals: commodity register + dossier
        ├── prospectivity.js    # Prospectivity: criteria editor + ranked targets
        ├── settings.js         # workspace preferences
        └── stub.js             # "coming soon" factory for pending modules
```

### Module status

| Module | State |
| --- | --- |
| Overview | Implemented |
| Explore Map | Implemented |
| Minerals | Implemented |
| Prospectivity | Implemented |
| Settings | Implemented |
| Risk Intelligence, Oil & Gas, Mining Titles, Reports, Data Center | Placeholder via `createStub` |

### The prospectivity model

`core/scoring.js` implements a weighted overlay, the standard first-pass
targeting technique:

```
score(state) = Σ(weightᵢ × evidenceᵢ) / Σ(weightᵢ)
```

Each criterion maps a raw metric to a normalised 0–100 evidence score. Weights
are relative, so only their proportions matter. The module runs it client-side
so the criteria editor re-scores instantly; when Laravel hosts the real model,
POST the weights and return scored targets from `getProspectivityInputs()`'s
replacement. The file has no DOM or fixture imports, so it is unit-testable as
is.

Adding a criterion means appending one entry to `CRITERIA` — the editor, the
evidence breakdown and the weight maths all pick it up automatically.

### Mineral specimen artwork

`assets/minerals/` holds one square specimen image per commodity, referenced
through `api.getCommodities()` so no component hardcodes an asset path. Ten are
photographs (`.png`); the remaining seven are procedurally generated SVG
specimens produced by `tools/make-mineral-svgs.py`, framed to match so the two
sit side by side without looking mismatched.

Photographs are centre-cropped square, resized to 480px and palette-quantised
by `tools/optimise-minerals.py` — 15.4 MB down to 1.6 MB. Re-run it after
adding any new photograph.

### Cross-module navigation

A module hands a selection to another through `store.pendingFocus`, then routes.
The receiving module consumes the request in `onShow()` and clears it, so a
later revisit does not re-trigger the jump:

```js
// Minerals -> Explore Map
store.set({ pendingFocus: { state: 'Zamfara', site: null, from: 'minerals' } });
location.hash = '#/explore';
```

### Cache busting

GitHub Pages serves assets with `cache-control: max-age=600` and no
fingerprinting, so a deploy can be masked by a stale browser cache. Every local
asset URL carries `?v=<short sha>`, including the relative `import` specifiers
inside `js/**.js` — ES modules are fetched by their own URL, so stamping
`main.js` alone would leave submodules cached. Run before committing a deploy:

```bash
python3 tools/stamp-version.py
```

### The SPA guarantee

`index.html` loads exactly once. `Router` swaps only the children of
`<main class="stage">`. The topbar, sidebar and background never re-render, and
navigation only mutates `location.hash` — so there is no document load and no
browser loading bar. The thin green line under the topbar is our own
`.route-bar`, not the browser's.

The Overview module is registered with `keepAlive: true`: when you navigate away
its view is hidden rather than destroyed, so the Leaflet instance, zoom level and
state selection all survive round-trips.

### Adding a module

Replace the stub factory in `js/main.js` — nothing else changes:

```js
// before
{ id: 'minerals', title: 'Minerals', keepAlive: false,
  factory: createStub({ ... }) }

// after
import { createMinerals } from './modules/minerals.js';
{ id: 'minerals', title: 'Minerals', keepAlive: true,
  factory: () => createMinerals() }
```

A module is any object with this shape — every hook is optional except `mount`:

```js
{
  async mount(viewEl) {},  // called once, build your DOM here
  onShow() {},             // each time the module becomes visible
  onHide() {},             // each time it's navigated away from
  destroy() {},            // cleanup (only called when keepAlive is false)
}
```

Use the existing primitives (`.panel`, `.chip`, `.metric`, `.meter`, `sparkline()`,
`ring()`, `donut()`) so new screens inherit the design language automatically.

---

## Connecting the Laravel API

Every number in the UI is resolved through `js/data/api.js`. Nothing else
imports fixtures. To go live:

```js
// js/data/api.js
export const api = new Api({ baseUrl: '/api/v1', live: true });
```

Expected endpoints (response shapes already match the fixtures):

| Method | Endpoint | Returns |
|---|---|---|
| `getDashboardSummary()` | `GET /dashboard/summary` | KPIs, mineral, petroleum, risk, coverage, commodities, activity |
| `getStateBoundaries()`  | `GET /geo/states`        | GeoJSON FeatureCollection (ADM1) + analytical properties |
| `getDeposits()`         | `GET /geo/deposits`      | Occurrence markers |
| `getStateProfile(name)` | `GET /geo/states/:code`  | Single state profile |
| `getSystemHealth()`     | `GET /system/health`     | Status pill + sidebar readouts |
| `getCommodities()`      | `GET /minerals`          | Commodity register: counts, trend, sites, states, geology notes |
| `getCommodity(id)`      | `GET /minerals/:id`      | Single commodity dossier |
| `getProspectivityInputs()` | `GET /prospectivity/inputs` | Scoring-model input table (model runs client-side) |

Each state feature carries: `name, code, region, centroid, commodities[],
occurrences, prospectivity (0–100), risk, titles, petroleum, coverage`.

---

## The map, and where it's going

`components/map.js` is written for progressive drill-down:

```
Nigeria → Zamfara → Anka / Maru / Gusau → local area → mineral prospect
```

`ZOOM_BANDS` already classifies the current view, and `store.drill` tracks the
path (the breadcrumb and topbar location pill both read from it):

| Band | Zoom | Renders today | Planned |
|---|---|---|---|
| `nation`   | 5 – 6.9    | ADM1 polygons, state codes, heat blooms | national aggregates |
| `state`    | 7 – 8.4    | full state names, major deposit labels  | ADM2 preload |
| `lga`      | 8.5 – 10.4 | all deposit labels                      | **ADM2 polygons**, roads |
| `local`    | 10.5 – 12.9| heat recedes                            | **satellite auto-switch**, geology, titles |
| `prospect` | 13 – 18    | —                                       | occurrences, drill collars, targets |

To add the LGA level: load `geoBoundaries-NGA-ADM2` into a new `lga` pane inside
`_onZoom()` when `zoomBand(z) === 'lga'`, and call
`store.set({ drill: { level: 'lga', ... } })` on click. The breadcrumb, location
pill and selection card update themselves.

The satellite toggle already requests real ArcGIS World Imagery; if the network
blocks it, `tileerror` falls back to a synthetic terrain treatment so the control
still reads correctly.

Other implemented map behaviour: hover tooltips with per-state stats, click-to-select
with fly-to, resource/prospectivity/risk filters, layer toggles, greedy label
decluttering, coordinate graticule, live scale bar, and location search over both
states and named deposits.

---

## Design system

Defined entirely in `css/tokens.css`.

- **Surfaces** — AMOLED `#040708` base, dark charcoal glass panels, thin luminous borders
- **Neon green** `#00e676` — primary brand accent, active navigation, energy resources
- **Cyan / teal** `#2dd8c3` — geography, boundaries, analytics
- **Gold** `#f5b942` — minerals and prospectivity
- **Orange / red** `#ff8a3d` / `#ff4d5e` — risk and danger
- **Purple / blue** `#8b7dff` / `#4d9dff` — geological and geophysical layers
- **Type** — Space Grotesk (UI), JetBrains Mono (figures), with system fallbacks

Changing a token propagates everywhere; no component hard-codes a brand colour.

---

## Responsive behaviour

Desktop is the primary target. Breakpoints at 1500 / 1240 / 1024 / 860 / 620 px
progressively narrow the intel rail, move it below the map, collapse the sidebar
to an icon rail, and reduce the KPI strip to 2-up then 1-up. The map re-fits the
national extent on every container resize.

A dedicated mobile experience (and the Flutter port) are intentionally deferred —
the phone layout currently degrades gracefully rather than pretending to be a
compressed desktop dashboard.

---

## Data attribution

State boundaries derive from [geoBoundaries](https://www.geoboundaries.org/)
ADM1 (open licence), simplified for web delivery. All statistics, deposit
records and metrics are **realistic placeholders for demonstration only** — not
authoritative geological data.
