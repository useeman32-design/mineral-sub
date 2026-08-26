# Data ledger — every dataset, traceable

**Single source of truth for what data is in this repo.** Every time a dataset
is added, changed or removed, this file is updated in the same commit. If a
number appears in the app, it traces to a row here.

Other docs and what they are for:

| Doc | Purpose |
|---|---|
| **`DATA-LEDGER.md`** (this file) | **The register. Start here.** |
| `DATA-PROVENANCE.md` | Presentation brief — how to defend the numbers |
| `GEOMETRY-GAP.md` | The coordinates problem and how it gets closed |
| `DATA-INVENTORY.md` | Longer per-file rationale (superseded in part by this) |
| `DATA-SOURCES.md`, `DATA-ACQUISITION-PLAN.md` | Source research and analysis |
| `DATA-MATRIX.md` | Fetch-vs-ask list, how to get each dataset, heavy-file verdict |
| `MCO-WFS-REUSE.md` | Where the title blocks came from, and how we can depend on them |
| `CALL-SCRIPTS.md` | Phone scripts — NGSA, MCO, NUPRC. No payment language |
| `REQUEST-EMAILS.md` | Drafted agency requests, no payment language |

---

## In the app now — `data/reference/`

These are the small derived products the browser actually fetches.

| File | Size | Records | Source | Added | sha256 |
|---|---|---|---|---|---|
| `mining-titles.json` | 2 186 KB | 10 125 titles | MCO cadastre export | `8d602ad` | `afcb4a8589e2` |
| `titles-summary.json` | 11 KB | 37 ADM1 units | Rebuilt from the GeoServer extract | `HEAD` | `6e58b604048c` |
| `production-2023.json` | 24 KB | 36 states, 44 commodities | NEITI 2023 Audit, App. 19 | `f6c0de3` | `30a4b96e6e43` |
| `title-polygons.geojson` | 2,830 KB | 11 706 polygons | MCO eMC+ GeoServer WFS | `b8d356e` | `a096afff6cf5` |
| `title-attributes.json` | 3,182 KB | 11 706 titles | MCO eMC+ GeoServer WFS | `b8d356e` | `c9ee8f3ffffe` |
| `mining-footprints.geojson` | 101 KB | 160 polygons | Maus et al. 2022 + OSM | `a2f4c1d` | `29a9d1b39acb` |
| `mineral-sites.json` | 28 KB | 165 points | USGS minfac + MRDS + OSM | `a2f4c1d` | `616b15b409d9` |
| `overlap-analysis.json` | 163 KB | 525 conflicts | Derived: cadastre × footprints × WDPA | `4f964c1` | `758fcf10285c` |
| `roads-major.geojson` | 730 KB | 5 211 ways | OpenStreetMap Overpass | `4f964c1` | `005a129aebcf` |
| `protected-areas.geojson` | 333 KB | 325 polygons | WDPA / Protected Planet | `8d602ad` | `48d973d46d9e` |
| `ng-settlements-osm.json` | 67 KB | 911 settlements | OSM Overpass | `74b1b0f` | `0a4f878e9373` |
| `neiti-2023-complements.json` | 4 KB | 6 appendices summarised | NEITI SMA 2023 Apps. 6–8, 14, 21, 23 | `HEAD` | `9df911dfd7c5` |
| `nuprc-2025-round-blocks.json` | 10 KB | 50 PPL teasers | NUPRC 2025 Licensing Round portal | `HEAD` | `fa923919f787` |

Plus boundaries, committed earlier: `data/nigeria-states.geojson` (37 ADM1) and
`data/lga/*.geojson` (774 ADM2), both geoBoundaries, CC BY 4.0.

## Originals — `data/source/`

Kept for provenance and re-processing. **The browser never fetches these.**

| File | Size | Added | sha256 |
|---|---|---|---|
| `mco-valid-titles.xlsx` | 1 439 KB | `8d602ad` | `6dc9841a61a8` |
| `neiti-2023-appendix19-production-by-state.xlsx` | 2 051 KB | `f6c0de3` | `428b5c568c66` |
| `neiti-2023-audit-report.pdf` (228 pp) | 5 058 KB | `f6c0de3` | `3ee7ec5a9f43` |
| `neiti-contribution_by_commodity.xlsx` | 12 KB | `8d602ad` | `d9fb49c4cdc0` |
| `neiti-solid_mineral_production.xlsx` | 8 KB | `8d602ad` | `ccdd14bf6a25` |
| `neiti-solid_mineral_revenue.xlsx` | 8 KB | `8d602ad` | `1bc83755943f` |
| `ngsa-sht28_Argungu_NE_ASCII.zip` | 389 KB | `8d602ad` | `32d2e8b0b237` |
| `ngsa-sht28_Argungu_NE_TMI.zip` | 1 056 KB | `8d602ad` | `f54c998082e3` |
| `wdpa-nigeria.zip` | 11 663 KB | `8d602ad` | `5b82810edeb1` |
| `worldpop-nga-1km-2020.tif` | 5 022 KB | `8d602ad` | `d186c3e2b9a7` |

**Note:** the three NEITI dashboard spreadsheets stop at **2015** and are
**not used by the app**. They are retained only as provenance for the older
series. The 2023 audit appendix replaced them as the economic evidence base.

---

## Per-dataset detail

### `production-2023.json` — audited output by state

- **Source:** NEITI Solid Minerals Industry Audit Report 2023, **Appendix 19**
  (Production by State and Company)
- **URL:** `https://neiti.gov.ng/audits/solid-minerals?period=2023&type=all`
- **Auditor:** Haruna Yahaya & Co. (Chartered Accountants)
- **Published:** October 2024 · **Covers:** 1 Jan – 31 Dec 2023
- **Extraction:** sheet `2023ne`, 1 046 company rows × 149 columns. Mineral
  columns paired as (Quantity MT, Amount ₦) from the two header rows. State
  labels normalised against `nigeria-states.geojson` — **zero unmatched**.
- **Totals:** 82 083 636 t · 44 commodities · 137 operators
- **Caveat:** the audit's national headline is **95 070 036 t**. The difference
  is unilaterally disclosed volume with no operator attribution. Do not present
  the two as if they should reconcile.
- **Used by:** Explore inspector, Overview selection card, Data Center

### `mining-titles.json` — the cadastre

- **Source:** Mining Cadastre Office, "Valid Mineral Titles as at 31 May 2026"
- **URL:** `https://www.miningcadastre.gov.ng/publication` (href is absolute)
- **Fields:** type, code, holder, minerals[], cu, areaKm2, states[], lgas[], granted, expiry
- **Known defects, handled in code:** raw Excel serials (`46059`, `47884`),
  transposed digits (`0810/2030`, year `4048`), placeholder `1900-02-02`.
  Anything outside 1960–2100 is rejected and shown as "Date unrecorded".
  `AREA (SQ. KM)` holds unevaluated formulas — recomputed from `CU` × 0.21.
- **No coordinates.** See `GEOMETRY-GAP.md`.

### `title-polygons.geojson` + `title-attributes.json` — THE CADASTRE, GEOREFERENCED

**This closes the coordinates gap for mining titles.**

- **Source:** Mining Cadastre Office **eMC+ GeoServer**, exposed through the
  application's own WMS/WFS proxy. Layer `emcplus:wms_lic_valid_2057`.
- **Endpoint:** `https://nigeriaminingcadastre.gov.ng/eMC/GeoServer/WmsProxy.ashx`
- **How it was found:** the eMC+ JS bundle sets `MapConfig.MapProxy =
  "GeoServer/WmsProxy.ashx"`. That proxy answers `SERVICE=WMS` **and**
  `SERVICE=WFS` **without authentication**, returning GeoJSON.
- **Reproduce:**
  ```
  ?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature
  &TYPENAME=emcplus:wms_lic_valid_2057
  &OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326
  ```
- **Retrieved:** 21 Aug 2026 · 12 089 features · 8.8 MB raw
- **Kept:** 11 706 with geometry. **383 Reconnaissance Permits are published
  with null geometry** — correct, since an RP is non-exclusive and grants no
  defined block. They are omitted rather than faked.
- **Located:** 11 674 to a state (99.7%), 11 599 to an LGA (99.1%) by
  point-in-polygon against our own ADM1/ADM2 boundaries.
- **Attributes:** `lic_no`, `type_str`, `status_str`, `holder_str`, `minerals`,
  `grant_date`, `expiry_date`, `area_km`, `has_litigation`.
- **Composition:** Exploration Licence 5 956 · Small Scale Mining Lease 4 005 ·
  Quarry Lease 1 308 · Mining Lease 436 · Water Use Permit 1. Total 180 269 km².
- **Split into two files on purpose:** the map only needs geometry plus a
  licence key (2.8 MB, **360 KB gzipped**); attributes load separately for
  detail panels (3.1 MB, **430 KB gzipped**).

**Relationship to `mining-titles.json`:** these are two views of the same
register published in different formats. Licence numbers do **not** join —
the spreadsheet uses bare serials (`29804`), the GeoServer uses prefixed
numbers (`ML-000002`). Matching on normalised holder name gives **4 055 shared
holders covering 94.0% of our spreadsheet rows**, which confirms they are the
same underlying register. The WFS layer is the **authoritative** one: it is
live, self-contained, carries clean ISO-style dates, and has geometry.

**Caveat:** this is an application endpoint, not a documented open-data API.
It could be restricted at any time. The extract is committed so the app never
depends on it at runtime.

**Licence status (26 Aug 2026):** publicly reachable ≠ open licence. The MCO
website terms (8 May 2023) limit commercial republication / public display
without written permission. The Data Center now labels this row
**"Public eMC+ endpoint; reuse permission requested"** rather than
"Nigerian Government public data". Email 6 asks the Office to confirm reuse,
attribution and a takedown route. Background: `MCO-WFS-REUSE.md`.

### `neiti-2023-complements.json` — remaining 2023 appendices, summarised

Fetched 26 Aug 2026 from the NEITI solid-minerals listing (the
`2023-APPENDICES/` directory itself 404s; files linked from the listing
return 200). TLS expired; `curl -sk`. Originals in `data/source/`.

Headline figures, not to be confused with Appendix 19 production:

- App. 14 ASF liability: **1,619** titles, ₦190.4 m (2021) + ₦462.9 m (2022) +
  ₦347.2 m (2023) = **₦1.000 bn** listed outstanding.
- App. 21 social expenditure: **14** companies, **₦1.240 bn** (BUA ₦694 m,
  Dangote Cement ₦459 m).
- App. 23 NESS levy: **₦7.023 bn (2023)**, ₦4.093 bn (2022). This is the
  unilateral-revenue side of the audit — part of why headline 95.07 Mt does
  not equal our 82.08 Mt operator-attributed total.
- App. 7 is a **2023** MCO snapshot (2,428 signed + 405 RP) and is
  **superseded** by the 11,706 eMC+ extract.

### `nuprc-2025-round-blocks.json` — 50 offered PPLs, not the cadastre

Public teaser list from `https://br2025.nuprc.gov.ng/` on 26 Aug 2026.
**50** PPL identifiers (2A29–2A62, 307–309, 700–703, 800–803, 900–903, 2010).
No geometry: the licensing-round maps page is a login wall. **Must not** be
wired into the Oil & Gas module as if it were the 282-block register.

### Register and map now share one source

The Mining Titles register originally ran on `mining-titles.json` (the
published spreadsheet, 10,125 rows) while the map drew `title-polygons.geojson`
(the GeoServer extract, 11,706). The two disagreed on the national total, which
is indefensible in a demo.

The register, the dashboard KPI and `titles-summary.json` now all derive from
the **GeoServer extract**. It is the authoritative copy: live, with coordinates,
clean ISO-style dates, an explicit status field and a litigation flag.

| | Spreadsheet | GeoServer |
|---|---|---|
| Titles | 10,125 | **11,706** |
| Coordinates | none | **all 11,706** |
| Litigation flag | none | **60 titles** |
| Licensed area | 153,657 km² | **180,270 km²** |

`mining-titles.json` is retained as provenance for the published figures but is
no longer read by the app.

**One wording correction that mattered.** The register's "Integrity" filter and
its KPI previously said *boundary overlaps*, derived from a proxy — a grant
spanning more than one state. The GeoServer carries a real `has_litigation`
field, so the filter, the KPI, the detail card and the report row now say
**in litigation** and report the cadastre's own flag: 60 titles. Claiming a
boundary overlap we had not actually computed would not have survived scrutiny.

### `overlap-analysis.json` — cadastre × footprints × protected areas

Derived, not downloaded. Polygon intersection of the 11,706 licensed blocks
against the 160 satellite footprints and 325 WDPA protected areas, using a
0.25° grid bbox prefilter then vertex-containment and edge-crossing tests.

**Findings:**

| | |
|---|---|
| Licences intersecting a protected area | **515**, touching **87** protected areas |
| Satellite workings inside a licence | 99 of 160 |
| Satellite workings **outside any licence** | **61** (8.38 km² disturbed) |
| Licences with an observed working matched | 93 |

Worst-affected protected areas: Cross River National Park (63 licences),
Opara Game Reserve (51), Ebbe/Kampe Game Reserve (50), Old Oyo National
Park (42), Stubbs Creek (31).

**CRITICAL CAVEAT — do not overstate this.** The footprint layer covers only
160 sites and 35.7 km² nationally. It is **not** a complete survey. Absence of
a matched footprint does **not** prove a title is dormant; it means no
satellite-mapped working in this dataset falls inside it. The 93 "worked"
figure is a **lower bound on activity**, not a compliance finding. The
protected-area overlaps are the robust half of this analysis — both inputs
are complete polygon sets.

### `roads-major.geojson` — motorway and trunk network

OpenStreetMap via Overpass, ODbL 1.0, retrieved 21 Aug 2026. 7,158 raw ways in
the bounding box, **5,211** after clipping to Nigeria's actual polygons.
Simplified with Douglas–Peucker at 0.002° (~200 m) — 730 KB raw, **80 KB
gzipped**. Replaces the "Roads & infrastructure — awaiting OSM import"
placeholder.

### `mining-footprints.geojson` — observed workings

- **Source:** Maus et al. 2022 + OSM, Zenodo `10.5281/zenodo.7307210`, **ODbL 1.0**
- **Method:** 117 MB global GeoPackage (192 584 polygons) filtered to `isoa3='NGA'`
- **Tagged:** state and LGA by point-in-polygon, 160/160 matched
- **These are observed workings, not licence boundaries.**

### `mineral-sites.json` — georeferenced sites

- USGS minfac 32 · USGS MRDS 14 · OSM 119 = **165 points, 34 states**
- Licences: public domain (USGS) + ODbL 1.0 (OSM)
- Clipped to real state polygons — a bare bbox leaks heavily into Cameroon
  (931 raw OSM hits → 119 genuine)
- **Interim.** Roughly 2% of what the NGSA database is said to hold.

---

## Per-dataset toggles

Beyond the global GO LIVE switch, every **Connected** dataset has its own
switch on its Data Center card. Default is on. Exclusions persist in
localStorage under `nmi.dsOff` as a list of disabled ids.

Switching a dataset off dims its card, drops its map layer immediately and
excludes it from reports. `DATASET_LAYER` in `js/data/toggles.js` maps dataset
ids to map layer ids so the Data Center and the layer tree can never disagree.

| Dataset id | Map layer |
|---|---|
| `titlegeom` | Mining title blocks |
| `footprints` | Mining footprints |
| `sites` | Georeferenced sites |
| `protected` | Protected areas |

## Rules

1. **Any new dataset gets a row here in the same commit that adds the file.**
2. Originals go in `data/source/`, derived products in `data/reference/`.
3. Record the licence and the caveat, not just the source.
4. Never commit files >100 MB (`git lfs` is not available in the build sandbox).
   Process heavy sources offline; commit only the derived product.
5. State what a dataset **cannot** support, in the row itself.

## TLS warning for the future importer

`neiti.gov.ng` and `ngsa.gov.ng` both serve **expired certificates**. Verifying
clients fail; `curl -k` succeeds. Scope `CURLOPT_SSL_VERIFYPEER=false` to those
hosts only — never globally.

## Live GPS navigation (device location, not IP)

Added a navigation panel to Explore Map. Position comes from
`navigator.geolocation.watchPosition` with `enableHighAccuracy: true` and
`maximumAge: 0`, which reads the device GNSS receiver — the same source Google
Maps uses. **IP geolocation is deliberately not used**: in Nigeria it typically
resolves to the carrier's gateway city and can be hundreds of kilometres from
the user. Nothing is transmitted to us; the fix stays in the browser.

Reported accuracy is shown rather than hidden, because it tells the user what
they are actually looking at:

| Reading | Label | Meaning |
|---|---|---|
| ≤ 30 m | `GPS` (green) | true satellite fix |
| ≤ 200 m | `assisted` (gold) | wifi/cell assisted |
| > 200 m | `coarse` (orange) | network positioning — prompts the user to move outdoors |

The feature needs a secure context; the live GitHub Pages site is https, so it
qualifies. Permission is requested only when the user presses "Use my location".

### Routing

| Field | Value |
|---|---|
| Service | OSRM demo server `router.project-osrm.org`, fallback `routing.openstreetmap.de/routed-car` |
| Endpoint | `/route/v1/driving/{lon},{lat};{lon},{lat}?overview=full&geometries=geojson` |
| Licence | OpenStreetMap data, ODbL 1.0 — attribution already carried for `roads-major.geojson` |
| Key | none required |
| CORS | `access-control-allow-origin: *` (verified) |
| Verified | Abuja → Nasarawa, 179.7 km / 131 min, 2,396 geometry points |

Routes follow the road network, not a great-circle line. If both routers fail
the panel falls back to a straight-line distance and **says so** in an amber
note, with the line drawn dashed, so a fallback is never mistaken for a
drivable distance.

The demo server is rate-limited, so re-routing is throttled: the road path is
recomputed roughly every twelfth fix, while the *remaining* distance is
recalculated on every fix by measuring from the nearest point on the existing
route to the destination. That keeps the countdown smooth without hammering a
public endpoint.

Destinations: any state, LGA, mineral occurrence or mining title — each
Inspector carries a **Navigate** button. States and LGAs route to their
centroid, which is a representative point, not a specific address.

## Live data is now the default (22 Aug 2026)

`js/data/live.js` previously read `localStorage['nmi.liveData'] === '1'`, so a
first-time visitor saw **sample fixtures**, not the real datasets. Measured
difference on a virgin browser profile:

| | Was (fresh visitor) | Now |
|---|---|---|
| Register | 208 titles | **11,706** |
| Active | 95 | 6,853 |
| Licensed area | 240.3K ha | 18M ha |
| In litigation | 32 | 60 |

The only way to reach the real data was a switch two clicks deep in the Data
Center. Every dataset acquired for this project was invisible by default.

The key is now an **opt-out** (`!== '0'`). Sample mode still exists as a
deliberate demo, and is flagged amber in the header pill reading `Sample Data`
with the tooltip "NOT official figures" — because demo fixtures being mistaken
for audited government data is the failure mode that matters.

### Cost of defaulting to live

Loading is lazy per dataset, and GitHub Pages serves gzip:

| Dataset | Raw | Gzipped | When it loads |
|---|---|---|---|
| `titles-summary.json` | 12 KB | ~4 KB | dashboard |
| `production-2023.json` | 28 KB | ~8 KB | dashboard |
| `title-attributes.json` | 3.2 MB | **0.5 MB** | register / cadastre click |
| `title-polygons.geojson` | 2.8 MB | **0.4 MB** | cadastre layer on |

A default visit that never leaves the dashboard costs ~40 KB raw. The heavy
files are only fetched by the modules that need them.

### Two bugs this surfaced

1. **`js/core/store.js` duplicated the layer defaults** — it hardcoded
   `layers: { ..., titles: false, ... }`, silently overriding `def:` in
   `js/data/layers.js`, which is supposed to be the single definition. The
   store is now seeded from `defaultLayerState()` at boot. Two copies of the
   same defaults meant edits to the real one did nothing.
2. **The Data Center understated our own data.** `getDatasets()` only returned
   the honest catalogue in live mode, so the default view advertised the
   cadastre as "NMI placeholder, 64 records, Sample data" while the register
   next door showed 11,706 audited titles. Cadastre, occurrence and commodity
   rows now carry real provenance, counts and licences.

Mining title blocks are now **on by default** on the Explore map.

Rows that still read "Sample data" or "Not connected" are correct and must stay:
`petroleum` (every published NUPRC endpoint errors), `geochem` and `geophys`
(awaiting NGSA release).

## Navigation and dock fixes (23 Aug 2026)

### Collapsed side panels kept their space

`makeDockResizer` (`js/components/draggable.js`) writes an inline
`width`/`min-width` on the dock when the user drags the rail. An inline style
outranks a stylesheet rule, so `.ex-dock.is-collapsed { width: 0 }` silently
lost: the panel hid its contents but still occupied its column, and the map
never reclaimed the area. Measured before the fix — collapsing a 312 px dock
left `grid-template-columns: 312px 780px 272px`.

Fixed with `!important` on the collapsed width/min-width/border. Verified: dock
312 → 0 px, map 820 → 1364 px with both docks closed.

### GPS was plotting a network fix as if it were a position

Reported from Gusau: the marker appeared in Abuja, ~260 km away. Reproduced by
feeding the app a fix with `accuracy: 48000`.

The cause is not our request — we already ask for `enableHighAccuracy: true`
and `maximumAge: 0`. It is the browser's fallback: with no GNSS lock (desktop,
tethered laptop, or indoors) Chrome returns a **network provider** estimate,
which in Nigeria resolves to the carrier's gateway city. The API reports this
honestly in `coords.accuracy`, and we were drawing it as a confident dot anyway.

`Tracker.COARSE_M = 5000`. Any fix coarser than 5 km is now **rejected**: no
marker, no route, no distance. The panel explains that only a ±N km network
estimate was available, that it is the provider's location rather than the
user's, and keeps watching — GNSS often locks seconds later. Showing nothing is
correct here, because a confident pin 260 km wrong is worse than a blank state
the user can act on.

`timeout` raised 20 s → 30 s: a cold GNSS lock outdoors regularly exceeds 20 s.

### Marker, colour and control placement

| Change | Detail |
|---|---|
| Locate control | Now a `data-tool="locate"` button in the map toolbar, `is-on` while tracking. The panel button remains. |
| Marker | Heading arrow (`.me-arrow`) instead of a dot, rotated to `coords.heading`. |
| Stationary | Falls back to a dot (`.is-still`) — a stationary receiver reports null/noisy heading, so pointing the arrow anywhere would be invention. |
| Heading fallback | When the device supplies no heading, a bearing is derived from the last two trail points. |
| Route colour | Blue `#4d9dff` (trail `#9ec9ff`), was green. Green is the platform's data/selection colour; navigation now uses standard wayfinding blue. |

### Harness note

`#view-explore` scoping is mandatory for navigation assertions — the Dashboard
holds a second `NigeriaMap`, and an unscoped `.leaflet-container` /
`.leaflet-pane` query hits the hidden Overview instance instead. Also
`#00e676` appears in the nav-pane vicinity as the country halo and state
borders (`map.js:196,306`), so route-colour assertions must target
`.leaflet-nav-pane path`, not all strokes.

## GPS threshold tightened + basemap on locate (23 Aug 2026)

Two refinements on top of the navigation fixes.

**`Tracker.COARSE_M` 5000 m → 300 m.** The 5 km reject threshold still let a
~2 km wifi/cell fix through, which plotted Abuja as the position of a user in
Gusau — the original complaint, just below the cut-off. Anything coarser than
300 m is not a GNSS fix: a real satellite lock is single or low double-digit
metres and assisted GPS is well under 200 m. 300 m leaves headroom for a
degraded but genuine fix indoors or under canopy. Verified: a ±2 km Abuja fix
is now rejected with "searching — rejected a ±2 km network fix", and the real
±14 m Gusau fix is accepted.

Added a matching regression guard: once a trusted fix exists, a reading more
than 3× worse arriving within 60 s is treated as noise, so a momentary network
fix cannot yank the marker mid-journey.

**Basemap switches to satellite on the first fix.** The vector basemap is state
polygons only. Flying to a street-level position on it landed the user in an
empty black field with nothing to navigate by. Imagery is enabled automatically
on the first fix (the toggle still works normally afterwards).

## Phase-2 feature audit (23 Aug 2026)

Swept all 10 modules: every module reachable, every visible control clicked,
console watched throughout. Four real defects found and fixed; the rest of the
platform came back clean.

### 1. Leaked window listener crashed on a destroyed map

`js/modules/dashboard.js` registered `addEventListener('nmi:prefs', ...)` on
**window** but never removed it. `destroy()` tore down the Leaflet map while
the listener survived, so changing any preference in Settings later called
`setLabels()` → `_onZoom()` → `getCenter()` on a dead map:

```
Cannot read properties of undefined (reading '_leaflet_pos')
  at NigeriaMap._stateAtCentre (map.js:513)
  at NigeriaMap.setLabels    (map.js:692)
  at dashboard.js:391
```

Only reproducible after visiting Overview, leaving, then entering Settings —
which is why plain navigation testing missed it. The listener is now registered
through `unsub` and `destroy()` nulls `nmap`.

**Same leak class in `js/modules/explore.js`:** the filter menu's outside-click
handler was added to `document` with no removal. Also fixed.

Rule going forward: any `addEventListener` on `window` or `document` inside a
module must push its removal onto `unsub` in the same edit.

### 2. Reports disclaimed their own audited data

Both the on-screen footer (`js/modules/reports.js`) and the exported PDF
(`js/core/reports.js`) printed, unconditionally:

> "Figures include deterministic placeholder data pending live service connection"

Neither file imported `liveMode`. With live data now the default, every
exported PDF told the reader its NEITI and MCO figures were placeholders. The
footer is now source-accurate in live mode (naming MCO eMC+, NEITI 2023, WDPA,
OSM) and only warns in demo mode, where the warning is now blunter.

### 3. Shadowed object key hid the corrected title count

`liveDatasetStatus()` in `js/data/live.js` had **two** `titles:` keys in one
object literal — the first claiming 10,125 records, the second 11,706. JS keeps
the last, so behaviour was already correct, but the stale row was misleading to
read. Removed. (The function is currently exported and never called; left in
place as documentation of live-mode provenance.)

### Verified NOT broken

Four controls flagged as no-ops by the sweep were false positives, confirmed by
targeted tests:

| Flagged | Reality |
|---|---|
| Oil & Gas `kind/terrain/operator/gas` | Table sort headers — rows *do* reorder; the detector only measured HTML length, which does not change on a reorder |
| Minerals `All` | Selects all resources; a no-op only because all are already selected |
| Prospectivity / Risk `Reset` | Works — after actually moving a weight slider, Reset restores it |

All 9 modules render, both report presets build (3 sections / 24 bars and
8 sections / 10 charts), the overlap caveat is present, zero console errors.

## Provenance banners on modelled modules (23 Aug 2026)

Prospectivity and Risk Intelligence presented scores with no visible indication
that their inputs are partly synthetic. Both now carry a banner on the landing
view and the state detail view.

**Prospectivity** scores five criteria. Only one is fully real:

| Criterion | Weight | Backing |
|---|---|---|
| Known occurrences | — | ⚠️ fixture (3,612 claimed vs 165 real georeferenced sites) |
| Host geology | — | ⚠️ fixture |
| Survey coverage | — | ⚠️ fixture (53–90%, invented) |
| Industry commitment | — | ✅ real — 11,706 MCO titles |
| Accessibility & risk | — | ⚠️ derives from the fixture risk band |

`getLiveStates()` spreads the fixture record (`...rec`) and overwrites only the
title fields, so occurrences/coverage/risk stay synthetic even in live mode.
That is correct behaviour — there is no real source yet — but it was invisible.

**Risk Intelligence** is more clearly illustrative: `RISK_FACTORS` in
`js/core/risk.js` compute evidence with a seeded random term, e.g.
`clamp(28 + (s.petroleum ? 20 : 0) + r() * 44, 0, 100)`. It is a weighting
demonstrator, not an incident feed. The banner says so and warns against using
it for field-safety decisions.

Wording is deliberately specific about what IS real (the cadastre) so the
banner reads as provenance discipline rather than a blanket disclaimer.

## Data requests, remaining NEITI appendices, heavy-file verdict (26 Aug 2026)

User asked: draft the NGSA call; name the site the title blocks came from
without consent; list what we can fetch vs what needs a letter; fetch the
rest; decide the heavy-file plan.

- Call / email pack: `CALL-SCRIPTS.md`, Email 6 in `REQUEST-EMAILS.md`.
- Cadastre source named and regularised: `MCO-WFS-REUSE.md`. Data Center
  licence row no longer says "Nigerian Government public data".
- Fetch-vs-ask list: `DATA-MATRIX.md`. Everything reachable without a person
  was fetched today (NEITI 2023 appendices 3, 4, 6–8, 13, 14, 20, 21, 23, 25;
  NUPRC 2025 teaser list of 50 PPLs; USGS MYB Nigeria 2019).
- Heavy files: `data/reference/` is **9.9 MB raw / 1.4 MB gzip**. Leave it on
  GitHub Pages. Do not Git-LFS anything Pages must serve. Future rasters go
  to Releases / R2 / derived PMTiles, never the Pages tree.
