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
| `REQUEST-EMAILS.md` | Drafted agency requests, no payment language |

---

## In the app now — `data/reference/`

These are the small derived products the browser actually fetches.

| File | Size | Records | Source | Added | sha256 |
|---|---|---|---|---|---|
| `mining-titles.json` | 2 186 KB | 10 125 titles | MCO cadastre export | `8d602ad` | `afcb4a8589e2` |
| `titles-summary.json` | 8 KB | 36 states + FCT | Derived from the above | `8d602ad` | `80c7d7c50293` |
| `production-2023.json` | 24 KB | 36 states, 44 commodities | NEITI 2023 Audit, App. 19 | `f6c0de3` | `30a4b96e6e43` |
| `title-polygons.geojson` | 2,830 KB | 11 706 polygons | MCO eMC+ GeoServer WFS | `b8d356e` | `a096afff6cf5` |
| `title-attributes.json` | 3,182 KB | 11 706 titles | MCO eMC+ GeoServer WFS | `b8d356e` | `c9ee8f3ffffe` |
| `mining-footprints.geojson` | 101 KB | 160 polygons | Maus et al. 2022 + OSM | `a2f4c1d` | `29a9d1b39acb` |
| `mineral-sites.json` | 28 KB | 165 points | USGS minfac + MRDS + OSM | `a2f4c1d` | `616b15b409d9` |
| `protected-areas.geojson` | 333 KB | 325 polygons | WDPA / Protected Planet | `8d602ad` | `48d973d46d9e` |
| `ng-settlements-osm.json` | 67 KB | 911 settlements | OSM Overpass | `74b1b0f` | `0a4f878e9373` |

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
