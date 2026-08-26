# Data acquisition matrix — 26 August 2026

One page you can act on. Every source below was probed again today.
**Do not treat a public URL as an open licence.** Publicly reachable ≠ permission to republish.

| Column | Meaning |
|---|---|
| **Status** | `IN APP` already shipping · `FETCHED` downloaded today · `YOU (10 min)` account/click · `MANUAL` call/letter/visit · `DEAD` no usable endpoint · `HEAVY` do not put the raw file on GitHub |
| **Who** | `us` = we can (or did) fetch · `you` = only you can, because it needs a person, an account, or a letter |

---

## A. Already in the app — do not re-fetch

| Dataset | Records | How we got it | Licence / risk | Module |
|---|---|---|---|---|
| Mining title blocks + attributes | **11,706** polygons | MCO **eMC+ GeoServer WFS** (unauthenticated public map endpoint), 21 Aug 2026 | **Public endpoint, not an open licence.** Formal reuse request is drafted — see `MCO-WFS-REUSE.md`. | Titles, Map, Prospectivity |
| Valid titles spreadsheet (provenance only) | 10,125 | MCO publications page, still the 31 May 2026 workbook | Published spreadsheet. No geometry. App no longer reads it. | provenance |
| Audited production 2023 | 36 states, 44 commodities, 82.08 Mt | NEITI SMA 2023 Appendix 19 | Public audit under the NEITI Act 2007 | Dashboard, Map, Reports |
| Protected areas | 325 | WDPA / Protected Planet bulk | WDPA terms, attribution, non-commercial redistribution limits | Map, Risk |
| Mining footprints | 160 | Maus et al. 2022 + OSM, Zenodo, ODbL | ODbL 1.0 | Map |
| Mineral sites (interim) | 165 | USGS minfac + MRDS + OSM | Public domain + ODbL. **~2% of NGSA.** | Map, Minerals |
| Settlements | 911 | OSM Overpass | ODbL 1.0 | Map, Risk |
| Major roads | 5,211 | OSM Overpass | ODbL 1.0 | Map |
| State / LGA boundaries | 37 + 774 | geoBoundaries | CC BY 4.0 | everything |
| Overlap analysis | 515 licences × 87 parks; 61 unlicensed workings | Derived | Derived from source licences | Reports, Map |
| WorldPop 1 km raster | 1 grid | WorldPop | CC BY 4.0. Source GeoTIFF is in `data/source/`; browser never loads it. | Risk (future zonal stats) |
| NGSA Sheet 28 sample (Argungu NE) | 1 sheet of ~330 | NGSA (`curl -k`, expired TLS) | Sample only. Not national coverage. | Prospectivity (not connected) |

Cadastre publications page checked today: **same workbook** (`1783900094_pub.xlsx`, “Valid Mineral Titles As At 31 May 2026”). No newer spreadsheet.

---

## B. Fetched today — no letter needed

Retrieved 26 Aug 2026 from public pages. Originals in `data/source/`. Small summaries in `data/reference/`.

| Dataset | File | What it is | How | In the app? |
|---|---|---|---|---|
| NEITI App. 3 Royalty payers | `neiti-2023-appendix03-royalty-payers.pdf` (46 pp) | Companies that paid royalty | `curl -sk` from the 2023 appendices listing | Provenance only (PDF) |
| NEITI App. 4 ASF payers | `neiti-2023-appendix04-asf-payers.pdf` (44 pp) | Companies that paid annual service fee | same | Provenance only |
| NEITI App. 6 Licences issued | `neiti-2023-appendix06-leases-issued.xlsx` | 2,833 instruments in the audit workbook | same | Summarised in `neiti-2023-complements.json` |
| NEITI App. 7 2023 MCO snapshot | `neiti-2023-appendix07-mco-register.xlsx` | 405 RP + 2,428 signed licences | same | **Superseded** by the 11,706 eMC+ extract. Kept as audit cross-check. |
| NEITI App. 8 Revoked / relinquished / transfer | `neiti-2023-appendix08-*.xlsx` | 1,619 recommended for revocation, 13 relinquished, 102 transfers | same | Summary only |
| NEITI App. 13 Export schedule | `neiti-2023-appendix13-export-schedule.pdf` | MID mineral export schedule 2023 | same | Provenance only |
| NEITI App. 14 ASF liability | `neiti-2023-appendix14-asf-liability.xlsx` | **1,619** titles, ₦1.000 bn outstanding across 2021–23 (₦190.4 m / ₦462.9 m / ₦347.2 m) | same | Summary in complements JSON + Data Center row |
| NEITI App. 20 GHG (solid minerals) | `neiti-2023-appendix20-emissions.xlsx` | A handful of operators (Dangote, Lafarge, Zuma 828…) | same | Provenance — too thin to drive Risk |
| NEITI App. 21 Social expenditure | `neiti-2023-appendix21-social-expenditure.xlsx` | **14 companies, ₦1.240 bn.** BUA ₦694 m, Dangote ₦459 m | same | Summary in complements JSON |
| NEITI App. 23 Unilateral FG revenue | `neiti-2023-appendix23-unilateral-revenue.xlsx` | NESS levy **₦7.023 bn (2023)** / ₦4.093 bn (2022). Explains why audit headline 95.07 Mt ≠ our 82.08 Mt | same | Summary in complements JSON |
| NEITI App. 25 Beneficial ownership | `neiti-2023-appendix25-beneficial-ownership.pdf` (4 pp) | BO disclosures | same | Provenance only |
| NUPRC 2025 round block list | `nuprc-2025-round-blocks.json` | **50 PPL teasers** (2A29–2A62, 307–309, 700–703, 800–803, 900–903, 2010) | scraped `br2025.nuprc.gov.ng` | Data Center **Partial**. **Not** wired into Oil & Gas — it is not the 282-block register. |
| USGS Minerals Yearbook Nigeria 2019 | `usgs-myb-nigeria-2019.pdf` | Secondary production/operator chapter | `pubs.usgs.gov` | Provenance / cross-check |

How the NEITI files were found (do not guess paths next time):

```
https://neiti.gov.ng/audits/solid-minerals?period=2023&type=all
```

The directory `…/2023/2023-APPENDICES/` itself **404s**; individual files linked from that listing return 200. Certificate is expired — `curl -sk`.

---

## C. You can get yourself in about 10 minutes

No letter. You, in a browser, from Nigeria.

| Dataset | Why we need it | How | After you have it |
|---|---|---|---|
| **ACLED Nigeria events** | Replaces the seeded security factor in Risk | Register at https://acleddata.com/register (free for research/non-commercial). API key arrives by email. | Send me the key **or** a Nigeria CSV. I will build a per-state incident layer. HDX’s ACLED page is behind a WAF from this host. |
| **eMC+ public account** | Belt-and-braces for the cadastre, and the proper channel | https://nigeriaminingcadastre.gov.ng/eMC/Account/RegisterPublic — no payment. Then send Email 6 (reuse permission) so we are not relying on the raw WFS. | Login confirms we are a known user. Still send the letter. |
| **Copernicus / USGS EarthExplorer** | Only if we later need a Sentinel/Landsat scene for a specific site | https://dataspace.copernicus.eu/ · https://ers.cr.usgs.gov/register | Do **not** download an archive. One cloud-free tile, processed offline. |
| **Protected Planet token** | Optional live WDPA updates | https://api.protectedplanet.net/request | We already have the bulk file. Skip unless you want auto-refresh. |

---

## D. You must inquire manually — call, then email, then visit

These are the ones that actually move the platform. Scripts are in `CALL-SCRIPTS.md`; emails in `REQUEST-EMAILS.md`. **Do not offer to pay.** If they raise a fee, write it down and say you will follow their procedure.

| # | Dataset | Agency / person | Why it is the blocker | How to get it | Current substitute |
|---|---|---|---|---|---|
| **1** | **National Mineral Occurrence Database** | **NGSA — Dr. Kwache FNMGS**, National Geosciences Information Centre. HQ: 31 Shettima A. Munguno Crescent, Utako. Tel **+234 803 968 6192** / **806 354 4455** / **802 360 2493**. Email `support@ngsa.gov.ng`, cc `info@ngsa.gov.ng`. Hours Mon–Fri 10:00–15:00, call before 14:00. | App has **165** interim points. NGSA describes coverage of **all 36 states + FCT** (commodity, location, status, type, reserve, grade, geology, association) as a Microsoft Access file. Fixture still claims 3,612. | **Call first**, then Email 1, then collect in person at the GeoData Centre. Ask for CSV/Excel/Access **with coordinates**. | USGS + OSM 165 points, flagged Partial |
| **2** | **Regional geochemistry** | NGSA GeoData Centre, same numbers. Second choice: **Mrs. Adelugba**, Economic Geology. | Prospectivity “survey coverage” and geochem criteria are placeholders. `/geochemical-data/` 404s. | Same visit as #1. Ask for gold/Cu/Ag/Al/Ce grids + 2024 Geochemical Mapping Index, GIS format. | Seeded evidence in `_evidence()` |
| **3** | **Airborne geophysics (national)** | NGSA GeoData Centre | Only **Sheet 28 Argungu NE** and **Sheet 66 Gubio NW** are online (~2 of ~330). Rest is request-based. | Same visit. Ask for TMI, radiometric (K, U, Th), gravity, TDEM for Birnin Gwari / Ife-Ilesha / Benue, plus the sheet index. Delivery: HDD/USB. **Do not commit raw grids to GitHub** — see §F. | One sample sheet in `data/source/` |
| **4** | **Geological maps (GIS)** | NGSA | 1:2,000,000 national, 1:100,000 sheets, state mineral-resources maps, critical-mineral corridors | Email 3. Prefer shapefile/geodatabase/GeoTIFF, not print. | None |
| **5** | **eMC+ reuse permission + official geometry feed** | **Mining Cadastre Office** `info@miningcadastre.gov.ng`, cc `legal@miningcadastre.gov.ng`. Tel +234 (0) 816 410 1937. 37 Lobito Crescent, Wuse 2, Abuja. | We already have the polygons from their public WFS. What we do **not** have is written permission to display them on a public website. Site terms (8 May 2023) limit commercial republication. | **Email 6 this week.** Call if no reply in 5 working days. | WFS snapshot, labelled “reuse permission requested” |
| **6** | **Petroleum concession register + block polygons** | NUPRC Exploration & Acreage Management. `nuprc@nuprc.gov.ng`, `br2025@nuprc.gov.ng`, `info.ndr@nuprc.gov.ng`, `ogisp@nuprc.gov.ng`. 7 Sylvester Ugoh Crescent, Jabi. | Oil & Gas module is still a fixture (31 invented blocks). Real register is **282** (55 OPL, 107 OML, 70 PPL, 50 PML). OGISP is a login portal; public maps page has no shapefile. | Email 5. Bid-round teasers (50 PPL) are already fetched and must not be passed off as the cadastre. | Fixture + 50-block teaser list |
| **7** | **NMRDSS repair (bonus)** | Ministry `iaismp.support@minesandsteel.com` | Official decision-support map is broken (`VPORTAL.ASMD.INTERNAL` leaked into production). If they fix it, occurrences + cadastre may appear there. | Mentioned in Email 4. We cannot fix their server. | — |

**Priority order for your week:** 1 NGSA call (Utako is in the same city) → 5 MCO email → 6 NUPRC email → ACLED registration.

---

## E. Dead or not worth chasing from this host

| Source | Result today | Verdict |
|---|---|---|
| NGSA `/geochemical-data/`, `/downloads/` | 404 | Request in person |
| NMRDSS | ArcGIS `9017$SITE_NOT_INITIALIZED` | Broken server-side |
| NUPRC concession PDFs / `/downloads/` | 404, URLs rotate | Request; do not deep-link |
| NUPRC licensing-round maps page | 200, no GIS files, login at `client.br2025.nuprc.gov.ng` | No public polygons |
| ACLED API unauthenticated | no response | Register |
| HDX Nigeria / HDX ACLED | AWS WAF challenge from this host | You download at home |
| Protected Planet API v3 | 401 without token | Bulk file already in |
| Delve, Mindat API, OneGeology WMS | 403 / 404 / fail | Dropped |
| GRID3 Nigeria | site up; no unauthenticated mineral dump | Skip |

---

## F. Heavy files — we already have an alternative

We stopped talking about this because **the files that are in the app are no longer heavy.**

Measured today, `data/reference/` (what GitHub Pages actually serves):

| | Raw | Gzipped (what the browser downloads) |
|---|---|---|
| All reference files | **9.9 MB** | **1.4 MB** |
| `title-attributes.json` | 3.26 MB | 0.47 MB |
| `title-polygons.geojson` | 2.90 MB | 0.38 MB |
| `roads-major.geojson` | 0.75 MB | 0.09 MB |
| Everything else | < 0.4 MB each | negligible |

GitHub Pages already gzip-encodes. The dashboard only loads `titles-summary.json` + `production-2023.json` (~40 KB). Cadastre geometry loads when the layer is on.

**Do not move the current files to Git LFS.** Pages serves git objects, not LFS pointers — LFS would *break* the live site. `.gitattributes` LFS rules apply only to `data/source/*.{xlsx,zip,tif}`, which the browser never fetches.

### When a truly heavy file arrives (NGSA airborne, 100 m population, OSM PBF)

| File | Typical size | Do this |
|---|---|---|
| OSM Nigeria `.osm.pbf` | 677 MB | Never commit. Overpass extract (already done: 911 settlements, 68 KB). |
| WorldPop 100 m | 472 MB | Never commit. We have 1 km (4.9 MB). If 100 m is needed, zonal-stats offline → a few-KB table. |
| HydroRIVERS Africa | 103 MB | Clip to Nigeria offline, simplify, commit 2–5 MB. |
| NGSA airborne archive | GBs | Keep on a drive / USB from Utako. Derive PNG/PMTiles or per-sheet summary grids. Commit only the derived product. |
| Sentinel-2 scene | ~600 MB | Do not store. We already stream ArcGIS World Imagery. |
| WDPA global zip | tens of MB | Already clipped to Nigeria (333 KB). |

**Rule:** process once, offline, into a small derived product. The browser only ever loads the derived product.

**If we must host a large original later**, in this order:

1. **GitHub Release asset** (2 GB/file) — download link, not Pages.
2. **Cloudflare R2 / S3 / Hugging Face dataset / Zenodo** for public COGs or PMTiles, lazy-loaded when the user turns the layer on.
3. Split by state / zoom so a phone on Nigerian data never pulls the national raster.

Git LFS is the wrong tool for anything the website has to serve.

---

## What each module is still missing

| Module | Real today | Still blocked on |
|---|---|---|
| Mining Titles | 11,706 eMC+ titles, geometry, litigation flag | Written MCO reuse permission |
| Map Explorer | Cadastre, footprints, sites, parks, roads, GPS | NGSA occurrences; NUPRC blocks |
| Dashboard | Title KPI + NEITI production | Occurrence KPI is still a fixture |
| Reports | Production, overlap, datasets | Same |
| Minerals | 165 interim sites | **NGSA occurrence DB** |
| Prospectivity | Real title counts; everything else modelled (banner says so) | NGSA occurrences + geochem + geophysics |
| Risk | Real parks + roads; security factor is seeded (banner says so) | **ACLED**; then NGSA for tenure context |
| Oil & Gas | Fixture | **NUPRC register + polygons** |
| Data Center | Honest catalogue | Licence row on cadastre now reads “reuse permission requested” |

---

## This week, for you

1. **Call NGSA** before 14:00 — script in `CALL-SCRIPTS.md`. Ask for Dr. Kwache.
2. **Send Email 1** the same day (“further to our call this morning”) if you have not already, or the follow-up in `FOLLOW-UP.md` if Email 1 went on 17 August.
3. **Send Email 6 to MCO** — reuse permission for the eMC+ extract. This is how we *depend* on the title blocks.
4. **Register at ACLED** (10 minutes).
5. Send Email 5 to NUPRC when the first two are in flight.

I cannot do 1–5 from here. Everything that could be fetched without a person, was.
