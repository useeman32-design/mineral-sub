# Data Acquisition Plan — review of the 16-source list

Every source in the proposed list was **probed on 17 August 2026**. This records
what downloaded successfully, what failed and why, what you must fetch manually,
and how each dataset gets applied to a module — with storage sized against the
**128 MB workspace budget**.

**Verdict on the list: it is sound.** The priorities are right and the sources
are the correct authorities. Three corrections follow from actual testing:

1. **NGSA is not down — its TLS certificate has expired.** Every tool that
   verifies certificates (including our earlier probes) gets a connection
   failure. `curl -k` returns HTTP 200. This changes NGSA from "unreachable" to
   "reachable with a workaround", which matters because it is the critical source.
2. **NMRDSS is broken server-side, not merely offline.** Its ArcGIS backend
   cannot reach its own internal portal host. No amount of retrying will fix it.
3. **Raw OSM and WorldPop 100 m cannot live in this workspace** (677 MB and
   472 MB against a 128 MB budget). Use the derived-extract route instead —
   proven below at **279 KB** for the same practical value.

---

## 1. Storage strategy — decide this first

| Tier | Where | Budget | What belongs |
|---|---|---|---|
| **A. Ship in repo** | `nmi/data/` | keep < 25 MB | Boundaries, occurrences, titles, protected areas, settlements — anything the browser fetches |
| **B. Git LFS / release assets** | same GitHub repo | ~2 GB | Source spreadsheets, WDPA archive, sample geophysics sheets |
| **C. Never in git** | external drive / S3 | unlimited | Raw OSM PBF, 100 m population rasters, Sentinel scenes, full airborne archive |

GitHub's practical limits: **100 MB per file** (hard block), 1 GB soft repo
warning, 2 GB per LFS file. So "move it to GitHub" works for tier B, but the
677 MB OSM PBF and 472 MB rasters are **tier C — do not commit them**.

The important principle: **the browser should never download a raster.** Heavy
files are processed *once*, offline, into small derived products. A 677 MB PBF
becomes a 280 KB settlements file. That is the difference between a working app
and one nobody can load on Nigerian mobile data.

---

## 2. Results by source

### ✅ Downloaded successfully — ready to use

| # | Source | Result | Size | Tier |
|---|---|---|---|---|
| 11 | **MCO Valid Mineral Titles** | **10,125 titles**, state + LGA + holder + mineral + dates | 1.4 MB | A/B |
| 9 | **Protected Planet / WDPA** | **325 protected-area polygons** + 11 points, 47,523 km² | 11.4 MB | B |
| 7 | **OSM via Overpass** | **972 cities/towns** with coordinates | **279 KB** | A |
| 8 | **WorldPop 1 km** | Nigeria population raster, 1441×1156 | 4.9 MB | B |
| 3 | **NGSA airborne sample** | Argungu NE TMI grid, real X/Y/Z values | 0.4 MB | B |
| 13 | **geoBoundaries ADM1/ADM2** | already shipping | 3.5 MB | A |
| — | **NEITI production/revenue** | 3 workbooks, annual series from 2007 | ~30 KB | A |
| — | **USGS MRDS (WFS)** | 24 occurrences w/ coordinates | 21 KB | A |

### ⚠️ Reachable but partial / needs a workaround

| # | Source | Finding |
|---|---|---|
| 1,2,3,4 | **NGSA website** | **Expired TLS certificate.** Works with `curl -k` / browser "proceed anyway". Everything below depends on this. |
| 3 | **NGSA airborne downloads** | Only **2 of ~330 sheets** published (Sheet 28 Argungu NE, Sheet 66 Gubio NW). Each has ASCII grid (0.4 MB), TMI grid (1.0 MB), interpretation PDF (2.0 MB). The other ~328 sheets are **not online** — they are sold/requested via the GeoData Centre. |
| 1 | **NGSA Mineral Occurrence DB** | Page **describes** the database (36 states + FCT; commodity, location, state, status, type, reserve, grade, geology, associations) but publishes **no download link**. It is a **Microsoft Access** file obtained by request. |
| 11 | **Ministry MarketPlace portal** | Works, but only **40 titles** vs the MCO spreadsheet's 10,125. Its per-title detail page adds **LGA, CU count, area in m², operator RC number and associated minerals** — richer per record, tiny sample. Use MCO for breadth, this for field definitions. |
| 12 | **NUPRC** | Site root and `/laws/licences` return 200; the concession PDFs I had earlier now 404. URLs rotate — navigate from the homepage, do not deep-link. |

### ❌ Failed — and why

| # | Source | Failure |
|---|---|---|
| 16 | **NMRDSS** | ArcGIS Web AppBuilder shell loads; backend returns `9017$SITE_NOT_INITIALIZED` and `Could not connect to ArcGIS component at https://VPORTAL.ASMD.INTERNAL:7443`. **A misconfigured internal hostname leaked into production.** Service folders `DSS`, `MCO`, `Hosted`, `Publish1` are visible but return errors. Nothing to harvest; worth revisiting since the folder names suggest occurrence + cadastre layers will appear here when fixed. |
| 10 | **ACLED** | API requires a registered key. `api.acleddata.com` refused unauthenticated requests. |
| 9 | **Protected Planet API** | v3 API returns `401 Unauthorized` — needs a free token. **The bulk shapefile needs no token**, so we used that instead. |
| 5,6 | **EarthExplorer / Copernicus** | Both live, both require an account and interactive scene selection. No unauthenticated bulk endpoint. |

### 🔻 Deliberately NOT downloaded — would blow the budget

| Source | Real size | Decision |
|---|---|---|
| OSM Nigeria `.osm.pbf` | **677 MB** | Tier C. Use Overpass extracts (proven: 279 KB). |
| OSM Nigeria shapefiles | **2,007 MB** | Never. |
| WorldPop 100 m raster | **472 MB** | Tier C. The 1 km version (4.9 MB) is sufficient for state/LGA density. |
| HydroRIVERS Africa | **103 MB** | Tier B/C. Clip to Nigeria first — the clipped result is a few MB. |
| Sentinel-2 scene | ~600 MB each | Tier C, and we already stream ArcGIS satellite tiles for the basemap. |

---

## 3. What you must download manually

These cannot be automated — they need an account, a login, or a written request.

**Priority 1 — the blocker**

1. **NGSA National Mineral Occurrence Database** (MS Access)
   GeoData Centre, NGSA, 31 Shettima A. Munguno Crescent, Utako, Abuja ·
   +234 803 968 6192 · support@ngsa.gov.ng
   Ask specifically for: the occurrence table export (CSV/Access), the
   **2023 Mineral Prospectivity Model Map** classification, and the
   **LGA mineral potential zones** (Nasarawa, Osun, Oyo, Sokoto already published).
   *This one dataset replaces our entire `DEPOSITS` fixture and underpins
   Minerals + Prospectivity. Start the request now — it is the long pole.*

2. **ACLED account** → https://acleddata.com/register
   Free for research/non-commercial. Then the API gives Nigeria events with
   date, LGA, event type, fatalities and coordinates. Replaces the seeded
   `security` factor in `js/core/risk.js` with real evidence.

**Priority 2**

3. **NGSA airborne sheets** beyond the two samples — GeoData Centre, likely paid.
4. **NGSA geological maps** (1:100,000 sheet series, state maps, geochemical
   maps) — the site lists them for **purchase**.
5. **Protected Planet token** (optional) → https://api.protectedplanet.net/request
   Only if you want live updates; the bulk shapefile is already downloaded.
6. **NUPRC concession register** — request from Exploration & Acreage Management,
   or scrape the 2025 bid-round portal at https://br2025.nuprc.gov.ng/

**Priority 3**

7. **Copernicus / EarthExplorer accounts** — only when you actually need imagery
   analysis. Start with one cloud-free Sentinel-2 tile over Zamfara, not the archive.

---

## 4. How each dataset maps onto our modules

| Dataset | Module | Concrete effect |
|---|---|---|
| MCO titles (10,125) | **Mining Titles** | Replaces `getMiningTitles()`. Real holders, real expiry, real LGA. |
| MCO titles | **Prospectivity** | Enables the audit's flagship query: *"is this gold target already under licence?"* — spatial join once we have polygons. |
| NGSA occurrences | **Minerals**, **Map** | Replaces `DEPOSITS`. Real grade, reserve, host geology, associations. |
| NGSA prospectivity model | **Prospectivity** | Replaces our weighted-overlay guess with the official classification — or validates it. |
| NGSA magnetics/radiometrics | **Prospectivity** | Real geophysical criterion instead of a seeded number. |
| NGSA geochemistry | **Prospectivity** | Gold/Cu/Ag anomaly layers as scoring inputs. |
| NEITI production/revenue | **Dashboard**, **Reports** | Replaces invented KPI deltas with citable 2007→ series. |
| ACLED | **Risk** (security, 28%) | Real incident density per LGA, time-decayed. |
| WDPA (325 areas) | **Risk** (environment, 16%) | Genuine overlap test: target vs forest/game reserve/national park. |
| OSM roads/settlements | **Risk** (access, 20%) | Real "nearest road 7.2 km" instead of a synthetic score. |
| WorldPop 1 km | **Risk** (community, 14%) | Population density near target. |
| HydroSHEDS + DEM | **Risk** (flood, 12%) | Distance to drainage, slope, terrain ruggedness. |
| SRTM DEM | **Map**, **Prospectivity** | Terrain context; derive slope/aspect ourselves. |
| NUPRC blocks | **Oil & Gas** | Real OML/OPL/PPL/PML. Note the real register is **282 blocks by basin**, not 31 by state. |
| geoBoundaries | everything | Already correct — the join key for all of the above. |

**On the risk engine specifically:** all six factors in `js/core/risk.js`
(security 28, access 20, environment 16, community 14, flood 12, tenure 10) have
a real data source in this list. That module can go from "plausible" to
"defensible" without changing a line of its UI.

---

## 5. Recommended sequence

**Phase 1 — this week, no accounts needed**
1. Import MCO titles → Mining Titles module becomes real. *Biggest single win.*
2. Import NEITI series → Dashboard KPIs become citable.
3. Overpass extract (settlements + primary roads) → access scoring.
4. WDPA clip → environmental overlap.

**Phase 2 — start the paperwork now, land in weeks**
5. NGSA occurrence DB request → Minerals + Prospectivity.
6. ACLED registration → Risk security factor.

**Phase 3 — heavier, offline processing**
7. DEM + HydroSHEDS → flood/terrain.
8. NUPRC concessions → Oil & Gas.
9. Geophysics/geochemistry → advanced prospectivity.

---

## 6. Engineering notes

**Keep the browser light.** Every tier-C file is processed offline into a tier-A
product. Target budgets: occurrences < 1 MB, titles < 3 MB (or paginate via the
API), protected areas simplified to < 1 MB, settlements < 500 KB.

**Everything joins on boundaries.** The list is right that consistent boundaries
matter most. We already use geoBoundaries ADM1/ADM2, but the MCO spreadsheet has
UPPERCASE states, mixed-case LGAs and 41 state tokens for 37 states — build the
normalisation/fuzzy-match layer *before* importing anything else, or every
subsequent join inherits the mess.

**Cache what you fetch.** The MCO filename is a timestamp
(`1783900094_pub.xlsx`) and NUPRC's URLs already rotated within a year. Mirror
every successful download with a retrieval date. The Data Center module is
already built to display `source`, `retrieved_at` and `source_url`.

**Time-sensitivity for security data is a correct instinct.** Do not brand an
LGA permanently dangerous. Weight ACLED events by recency (e.g. 12-month
half-life) and show the window in the UI.

**NGSA's expired certificate** will also break server-side imports in PHP/cURL.
Handle it explicitly and log it, rather than disabling verification globally.

---

## 7. Honest assessment

The proposed stack is realistic and correctly prioritised. The gap between it
and a working system is **not technical** — it is that Nigeria's single most
important mineral dataset is an **MS Access file you have to ask for**, its
official decision-support system is **misconfigured in production**, and its
geological survey has let its **TLS certificate lapse**.

What *is* available right now is genuinely strong: a 10,125-row cadastre, real
protected areas, real population, real infrastructure, and a decade of audited
production figures. That is enough to make Mining Titles, Risk, Dashboard and
Reports run on real data immediately, while the NGSA request is in flight.
