# Data Inventory — every file, why we need it, where it's used

Two directories, two purposes:

- **`data/source/`** — originals exactly as downloaded. Provenance and
  re-processing only. **The browser never fetches these.**
- **`data/reference/`** — small derived products the app actually loads.

Everything here was downloaded and verified on **17 August 2026**.

---

## PART 1 — Downloaded and in the repo now

### `data/source/mco-valid-titles.xlsx` — 1.4 MB ⭐

**What:** The Nigerian mining cadastre. 10,125 valid mineral titles, one sheet
(`BASE`), 19 columns: title type, licence code, holder, minerals, cadastral
units, area, state, LGA, effective date, expiry date, holder address/email/phone.

**Source:** Mining Cadastre Office · https://www.miningcadastre.gov.ng/publication
("Valid Mineral Titles As At 31 May 2026")

**Why we need it:** This is the legal register of who holds what mineral rights
in Nigeria. Without it the Mining Titles module is invented; with it, the module
is authoritative.

**Where it's used:** Mining Titles (whole module), Prospectivity (tenure
criterion), Reports (title sections), Map Explorer (once geometry arrives).

⚠️ **Refresh:** the filename is a timestamp (`1783900094_pub.xlsx`), not a stable
path. Scrape the publications page for the current link.

---

### `data/reference/mining-titles.json` — 2.2 MB ⭐

**What:** The cadastre, cleaned and web-ready. 10,125 records:

```json
{"type":"EL","code":"29804","holder":"Palladium Mining Limited",
 "minerals":["Lead","Zinc"],"cu":61,"areaKm2":12.81,
 "states":["Abia"],"lgas":["Umu-Nneochi"],
 "granted":"2024-08-29","expiry":"2026-08-28"}
```

**Cleaning applied** (each fixes a real defect found in the source):
- Area recomputed from cadastral units (`CU × 0.21`) — the source column holds
  **unevaluated Excel formulas** (`=F2*0.21`) that read as text.
- Dates normalised to ISO — the source mixes real datetimes with `'17/03/2023'` strings.
- Multi-state and multi-LGA cells split into arrays — **652 titles span more than
  one state**.
- State names normalised: `FCT` → `Federal Capital Territory`,
  `Kaduna North` → `Kaduna`, uppercase → title case.

**Result: 37/37 states now join cleanly to `nigeria-states.geojson`. Zero orphans.**

**Where it's used:** `api.getMiningTitles()` — replaces the generated fixture.

---

### `data/reference/titles-summary.json` — 12 KB

**What:** Per-state aggregates plus a national rollup, precomputed so the app
never parses 10,125 records to draw a KPI.

National: **10,125 titles · 153,657 km² licensed · 37 states · 195 commodities**

Top commodities: **Lithium 3,782** · Gold 3,331 · Cassiterite 1,638 ·
Tantalum 1,415 · Sand 1,192 · Beryl 1,181 · Lead 1,025 · Granite 886

Per state, e.g. Zamfara: 30 titles, 396.5 km², 17 active / 12 expiring / 1
expired, 13 LGAs, top minerals gold, granite, copper.

**Why:** the honest headline is that **lithium now leads gold** in licensed
titles. Our fixture assumed gold. Real data corrects the story the app tells.

**Where it's used:** Dashboard KPIs, Mining Titles KPI strip, Prospectivity
tenure criterion, state profile reports.

---

### `data/reference/protected-areas.geojson` — 333 KB

**What:** 325 protected-area polygons — 296 forest reserves, 20 game reserves,
8 national parks, 1 strict nature reserve. 47,523 km² total. Each carries name,
designation, IUCN category, area, status year. Simplified to ~4 decimal places
for web use.

**Source:** Protected Planet / WDPA August 2026 (from the 11.4 MB bulk archive).

**Why we need it:** A highly prospective target inside a national park is not
investable. This turns the Risk engine's environment factor (16% weight) from a
seeded number into a genuine spatial test.

**Where it's used:** Risk Intelligence (environmental factor), Map Explorer
(overlay layer), Reports (environmental constraints section).

⚠️ **Licence:** WDPA terms — non-commercial use, attribution required, and you
may not redistribute the raw data as a product. Fine for display with credit.

---

### `data/reference/ng-settlements-osm.json` — 68 KB

**What:** 911 named Nigerian cities and towns with coordinates.

**Source:** OpenStreetMap via the Overpass API, ODbL 1.0.

**Why this instead of the real OSM file:** the Nigeria PBF is **677 MB** and the
shapefile set is **2 GB**. A targeted Overpass query gives the same practical
value for accessibility scoring at **68 KB** — a 10,000× reduction. This is the
pattern for every heavy geodataset: extract what you need, never ship the archive.

**Where it's used:** Risk Intelligence (accessibility, 20% weight — "nearest
settlement 4.1 km"), Map Explorer (place labels), Prospectivity (logistics).

---

### `data/source/neiti-*.xlsx` — 3 files, ~30 KB total

**What:** Nigeria's audited extractive-sector figures, annual from 2007:
- `neiti-solid_mineral_production.xlsx` — total production by year
- `neiti-solid_mineral_revenue.xlsx` — total revenue by year (2007: ₦8.19 bn)
- `neiti-contribution_by_commodity.xlsx` — production and % share per commodity

**Source:** NEITI Solid Minerals dashboard · https://dashboard.neiti.gov.ng

**Why we need it:** Our Dashboard currently shows invented deltas like
"+4.2% this quarter". NEITI is the legally mandated audit — real, citable,
defensible. Replace fiction with figures you can stand behind.

**Where it's used:** Dashboard KPIs and trend sparklines, Reports (national
indicators), Data Center (provenance).

---

### `data/source/worldpop-nga-1km-2020.tif` — 4.9 MB

**What:** Gridded population, 1 km resolution, 1441×1156, LZW GeoTIFF.

**Source:** WorldPop · CC BY 4.0

**Why the 1 km and not the 100 m:** the 100 m raster is **472 MB**. For
state/LGA-level density — which is all our risk model needs — 1 km is ample.

**Where it's used:** Risk Intelligence (community factor, 14% weight). Requires
offline zonal statistics per LGA; the app consumes the resulting numbers, never
the raster.

---

### `data/source/ngsa-sht28_Argungu_NE_*.zip` — 1.4 MB

**What:** Real airborne magnetic data for Sheet 28 (Argungu NE) — ASCII grid
with X/Y/TMI values (2.6 MB uncompressed) and a Geosoft TMI grid.

**Source:** NGSA (downloaded with certificate verification disabled — see below).

**Why we need it:** Proof the geophysics pipeline works end to end, and a
template for the ~328 sheets we must request. **Only 2 of ~330 sheets are
published online.**

**Where it's used:** Prospectivity (geophysical criterion) once national
coverage is obtained. Currently a sample, not production data.

---

### `tools/normalise-states.js`

**What:** The state-name normaliser. `FCT` → `Federal Capital Territory`,
`Kaduna North` → `Kaduna`, case fixes, multi-state cell splitting.

**Why:** every join between a government spreadsheet and our polygons goes
through this, or records silently orphan. It already rescued 213 FCT titles and
a Kaduna zonal-office variant.

---

## PART 2 — Heavy files: how to deal with them

**Never commit these.** GitHub hard-blocks anything over 100 MB, and the
workspace budget is 128 MB total.

| File | Size | How to handle |
|---|---|---|
| **OSM Nigeria `.osm.pbf`** | 677 MB | ✅ **Already solved.** Use Overpass queries for the specific features you need (proven: 911 settlements, 68 KB). Only download the PBF if you need nationwide road-network routing — then process it on a laptop with `osmium`/`ogr2ogr` and commit only the derived extract. |
| **OSM shapefiles** | 2,007 MB | Never. The PBF is strictly better if you ever need the full extract. |
| **WorldPop 100 m** | 472 MB | Not needed. The 1 km version (4.9 MB, already downloaded) is sufficient for LGA-level density. If 100 m is ever required, run zonal stats locally and commit the resulting per-LGA table (a few KB). |
| **HydroRIVERS Africa** | 103 MB | Download locally, clip to Nigeria with `ogr2ogr -clipsrc`, simplify, commit the result (expect 2–5 MB). Only needed for the flood factor (12% weight) — Phase 3. |
| **SRTM DEM (full)** | ~1.5 GB | Download only the tiles covering areas of interest from EarthExplorer. Derive slope/ruggedness locally, commit per-LGA summary statistics rather than the raster. |
| **Sentinel-2 scene** | ~600 MB each | Do not store. We already stream ArcGIS satellite tiles for the basemap. Fetch a scene only for a specific analysis, keep it off the repo. |
| **NGSA full airborne archive** | Unknown, likely GB | Must be requested anyway (Email 2). When it arrives, keep it on external storage and commit only derived raster tiles or per-area summary grids. |

### The rule to follow

> **Heavy files are processed once, offline, into small derived products.
> The browser only ever loads the derived product.**

A 677 MB PBF became a 68 KB JSON. An 11.4 MB WDPA archive became a 333 KB
GeoJSON. That is the difference between an app that loads on Nigerian mobile
data and one that does not.

### If you do need to store large files on GitHub

**Do not use Git LFS for anything GitHub Pages must serve.** Pages serves git
objects; LFS pointers would 404 in the browser. The current `data/reference/`
payload is **9.9 MB raw / 1.4 MB gzipped** — fine on Pages with lazy load.

When a GB-scale file arrives (NGSA airborne, OSM PBF, 100 m population):

1. Process it offline. Commit only the derived product the browser needs.
2. Park the original on a **GitHub Release** (2 GB/file), Cloudflare R2, S3,
   Hugging Face or Zenodo — never in the Pages tree.
3. `.gitattributes` LFS rules apply only to `data/source/*.{xlsx,zip,tif}`,
   which the browser never fetches.

Full verdict: `DATA-MATRIX.md` §F.

---

## PART 3 — Blocked, and what unblocks it

| Dataset | Status | Action |
|---|---|---|
| **NGSA Mineral Occurrence DB** | 🔴 No download link — MS Access, request only | **Email 1** — the blocker for Minerals + Prospectivity |
| **NGSA airborne (328 sheets)** | 🔴 Only 2 published | **Email 2** — likely paid |
| **NGSA geological maps** | 🔴 Sold, not downloadable | **Email 3** |
| **Mining title polygons** | ✅ 11,706 in app from eMC+ WFS | **Email 6** — written reuse permission, not a re-download |
| **NUPRC concessions** | 🟠 URLs rotate; deep links 404 | **Email 5**, or scrape https://br2025.nuprc.gov.ng/ |
| **ACLED conflict events** | 🟠 Free key required | Self-register, 10 minutes |
| **NMRDSS** | ❌ Broken server-side | Reported in Email 4; nothing we can do |

### Known technical faults worth remembering

- **NGSA's TLS certificate has expired.** `curl` and browsers refuse the
  connection; `curl -k` works. This will break server-side PHP imports too —
  handle explicitly, don't disable verification globally. Flagged politely in Email 1.
- **NMRDSS leaks an internal hostname** (`VPORTAL.ASMD.INTERNAL:7443`) into
  production, so its ArcGIS backend is unreachable from the internet.

---

## Current footprint

```
data/source/     20 MB   originals (LFS-configured, browser never fetches)
data/reference/  2.6 MB  web-ready products the app loads
```

Well inside both the 128 MB workspace budget and GitHub's limits.

## What runs on real data after this

| Module | Before | After |
|---|---|---|
| **Mining Titles** | 208 generated | **10,125 real titles** |
| **Dashboard** | Invented deltas | NEITI audited series |
| **Risk — environment** | Seeded | **325 real protected areas** |
| **Risk — access** | Seeded | **911 real settlements** |
| **Risk — community** | Seeded | Real population raster |
| **Minerals / Prospectivity** | Fixtures | ⏳ Blocked on Email 1 |
| **Oil & Gas** | 31 generated | ⏳ Blocked on Email 5 |
