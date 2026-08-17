# Real Data Sources — Nigeria Mineral Intelligence

Where to get the authoritative government data that replaces the placeholder
fixtures in `js/data/fixtures.js` and `js/data/api.js`.

Every URL below was **fetched and checked on 17 August 2026**. Status is recorded
honestly, including the sources that are currently down — a link that 404s today
is still worth knowing about, but you should not plan a release around it.

---

## TL;DR — the shortlist

| Need | Source | Status | Format |
|---|---|---|---|
| **Mining titles (cadastre)** | Mining Cadastre Office publications | ✅ **Working — 10,125 rows** | `.xlsx` |
| Production & revenue | NEITI Solid Minerals dashboard | ✅ Working | `.xlsx` |
| Audited sector detail | NEITI Solid Minerals Audit Reports | ✅ Working | PDF |
| Mineral occurrences | NGSA National Mineral Occurrence DB | ⚠️ Offline / on request | MS Access |
| Occurrences (fallback) | USGS MRDS WFS | ✅ Working, but thin (24) | GML/CSV |
| Petroleum blocks | NUPRC concession reports | ⚠️ URLs unstable | PDF |
| Boundaries (ADM1/ADM2) | geoBoundaries | ✅ Already in use | GeoJSON |

**Start with the cadastre.** It is the single highest-value download: real,
current, complete, and it maps almost 1:1 onto the Mining Titles module.

---

## 1. Mining Cadastre Office (MCO) — mining titles ⭐

**The best source available, and it works right now.**

- Portal: <https://www.miningcadastre.gov.ng/publication>
- eMC+ system: <https://nigeriaminingcadastre.gov.ng/emc>
- Public map portal: <https://emcplus.gaf.de/index-q=portals.html>

The MCO publishes a **"Valid Mineral Titles"** spreadsheet and refreshes it
periodically. Verified download:

```
https://www.miningcadastre.gov.ng/img/publications/1783900094_pub.xlsx
→ HTTP 200, 1,473,769 bytes, "Valid Mineral Titles As At 31 May 2026"
```

⚠️ The filename is a **timestamp, not a stable path**. Scrape the publications
page for the current link rather than hard-coding this one.

### Verified contents

- **10,125 title rows**, one sheet named `BASE`, 19 columns
- Columns: `S/N, TITLE, CODE, HOLDER, MINERAL, CU, AREA (SQ. KM), STATE, LGA,
  EFFECTIVE DATE, EXPIRY DATE, ADDRESS, EMAIL, PHONE NUMBER`

| Title type | Count |
|---|---|
| EL — Exploration Licence | 5,210 |
| SSML — Small Scale Mining Lease | 3,420 |
| QL — Quarry Lease | 1,066 |
| ML — Mining Lease | 416 |
| QLS | 13 |

Top states: Nasarawa 770, Niger 762, Kwara 722, Kogi 720, Kaduna 692,
Bauchi 582, Plateau 544, Oyo 501.

Top minerals: **Lithium 3,782**, Gold 3,331, Cassiterite 1,638, Tantalum 1,415,
Sand 1,192, Beryl 1,181, Lead 1,025, Granite 886.

### What this corrects in our placeholder data

This is the important part — the real data disagrees with our fixtures:

1. **Volume**: 10,125 real titles vs our fixture's 5,196. Roughly double.
2. **Lithium leads, not gold.** Our `RESOURCE_META` treats gold as the headline
   commodity; the live register is dominated by lithium pegmatite licences.
   That is a genuine shift in the Nigerian market and the UI should reflect it.
3. **EL dominates** (51%), and SSML is a third of the register — our fixture
   spread titles evenly across five types.
4. **Titles span multiple states and LGAs.** Rows carry values like
   `"ABIA, EBONYI"` and `"Umu-Nneochi, Ivo"`. Our schema assumes one state per
   title; the importer must split on commas and the data model needs a
   many-to-many relation.
5. **Real LGA attribution exists** — 813 distinct LGA tokens. This finally
   supplies the LGA-level title counts the Reports module currently disclaims.
6. **No coordinates.** The spreadsheet has area in km² but no polygons, so
   titles still cannot be drawn on the map from this file alone. Geometry lives
   in eMC+ / the GAF map portal and needs a separate request.

### Data-quality warnings

Handle these in the importer or you will ingest garbage:

- `AREA (SQ. KM)` contains **unevaluated Excel formulas** (`=F2*0.21`). Read
  with `data_only=True` (openpyxl) or recompute from the `CU` cadastral-unit
  column — 1 CU ≈ 0.21 km².
- Dates are **mixed types**: some real `datetime`, some `'17/03/2023'` strings.
- `HOLDER` has dirty values, e.g. one row reads `'QL+1:24'`.
- State names are UPPERCASE; LGA names are mixed case. Normalise before joining
  to `data/lga/*.geojson`.
- 41 distinct state tokens for 37 states — whitespace/spelling variants.

Other useful MCO publications (all live):
`Revoked Mineral Titles`, `Grants Ready for Collection`,
`Gazetted Refused Applications`, `Revoked Dormant Mineral Titles Gazette`.

---

## 2. NEITI — production, revenue, audited reporting ⭐

**Nigeria Extractive Industries Transparency Initiative.** Working bulk
downloads, and the legally mandated audit of the sector.

- Dashboard: <https://dashboard.neiti.gov.ng/solid-mineral/index.php>
- Reports: <https://neiti.gov.ng/reports>

Three verified `.xlsx` downloads:

```
/solid-mineral/files/Solid_mineral_production.xlsx    Year, Total Production
/solid-mineral/files/Solid_mineral_Revenue.xlsx       Year, Total revenue   (note the space in the filename)
/solid-mineral/files/Contribution_By_commodity.xlsx   year, Minerals, Production, Percentage
```

Annual series from **2007 onward** — e.g. 2007 revenue ₦8.19 bn, production
13,266,217 t; 2007 commodity split Limestone 43.97%, Granite 42.13%,
Laterite 10.96%.

This is exactly what the Dashboard KPIs and the report charts should be built
on: it is real, time-series, and citable. It replaces invented deltas like
"+4.2% this quarter" with defensible figures.

Also: **Solid Minerals Industry Audit Report** (annual PDF, 2023 edition at
`neiti.gov.ng/cms/wp-content/uploads/2024/12/NEITI-SMA-REPORT-2023.pdf`) —
company-level production and payments, useful for the Mining Titles holder
records.

---

## 3. NGSA — geoscience and mineral occurrences

**Nigerian Geological Survey Agency**, the mandated custodian. Home:
<https://ngsa.gov.ng/>

⚠️ **The NGSA site was unreachable from our test host** (`curl` returned `000`
on all paths) while other sites resolved fine. It may be geo-fenced, blocking
datacentre IPs, or intermittently down. Try from a Nigerian connection or a
normal browser before concluding it is offline.

What NGSA holds (from its published catalogue):

- **National Mineral Occurrence Database** — all 36 states + FCT, with
  commodity, location, state, status, type, reserve, grade, geology and mineral
  association. This is the *exact* dataset behind our `DEPOSITS` fixture.
  Distributed as **Microsoft Access**, not an API — likely a written request to
  the GeoData Centre.
  <https://ngsa.gov.ng/database/>
- **Airborne magnetic + radiometric** — nationwide survey (Fugro, 2003–2010),
  1:50,000 Geosoft grids and ASCII.
  <https://ngsa.gov.ng/airborne-magnetic-data/>
- **Airborne TDEM** (2009) over Birnin Gwari, Ife-Ilesha, Benue.
  <https://ngsa.gov.ng/em-database/>
- **Geological & mineral resources maps**, per state, plus 2023–2025
  **Mineral Prospectivity Model Maps** and **critical-mineral corridor maps**
  (gold, lithium, copper, REE) — including *LGA-level mineral potential zones*
  for Nasarawa, Osun, Oyo, Sokoto. Directly relevant to our Prospectivity
  module. <https://ngsa.gov.ng/geological-maps/>
- **Regional geochemistry** — the BGS/GTK-assisted national programme.
- **GeoData Centre** (NGSA + NSRMEA), searchable via GeoNetwork.
  <https://ngsa.gov.ng/geodata-centre/>

**NMRDSS** — Nigerian Mineral Resources Decision Support System, the official
web platform for querying mineral occurrences:
<https://miningdecision.minesandsteel.gov.ng/nmrdss/>
❌ **Did not resolve** (HTTPS and HTTP, TLS verification off). The parent domain
`minesandsteel.gov.ng` returns 200, so the subdomain specifically is down.

**Practical route:** email/visit the GeoData Centre at NGSA, Utako, Abuja
(+234 803 968 6192). Ask for the Mineral Occurrence Database export and the
prospectivity model layers. Government geoscience data in Nigeria is largely
**request-based, not API-based** — budget for correspondence, not a cron job.

---

## 4. Petroleum — NUPRC

**Nigerian Upstream Petroleum Regulatory Commission.** <https://www.nuprc.gov.ng/>

⚠️ **Deep links are unstable.** The concession situation PDF and
`/concession/`, `/downloads/` all returned 404 during testing even though they
appear in search results and were live earlier in 2025. The site root works.
Navigate from the homepage rather than deep-linking.

Known-good figures from the **NUPRC 2024 Annual Report** (worth citing even
though the PDF URL has since moved):

- **282 blocks**: 55 OPL, 107 OML, 70 PPL, 50 PML
- By terrain: Onshore Niger Delta 132, Continental Shelf 92, Deep Offshore 40,
  Anambra Basin 6, Chad Basin 6, Benin Basin 4, Benue Trough 2
- 2023 report: 456 total blocks, 219 open

Compare with our fixture: **31 generated blocks across 10 states**. The real
register is ~9× larger and organised by **basin and terrain**, not by state —
which is why the Oil & Gas module now filters by basin. Our basin mapping is a
reasonable approximation but should be replaced with NUPRC's own attribution.

- **2025 Licensing Round portal**: <https://br2025.nuprc.gov.ng/> ✅ live —
  per-block detail pages (PPL 2A42, PPL 307…), 50 blocks offered, 37 awarded to
  31 companies in July 2026.
- Concession contracts index: `nuprc.gov.ng/concession/`
- Block geometry: prepared with **Daimler Geographics**; seismic via
  **TGS-PetroData** and the **National Data Repository (NDR)** — both
  commercial, purchase links on the bid-round portal.

For oil & gas **production by field**, the USGS Minerals Yearbook (Nigeria
chapter) is a free, well-structured secondary source:
<https://pubs.usgs.gov/myb/vol3/2019/myb3-2019-nigeria.pdf>

---

## 5. Boundaries — already correct

`data/nigeria-states.geojson` and `data/lga/*.geojson` come from
**geoBoundaries** (pinned commit `9469f09`), CC BY 4.0:

```
https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson
```

37 ADM1 features, 774 ADM2. No change needed. The official alternative is the
**Office of the Surveyor-General of the Federation (OSGOF)**, and NGSA also
publishes MGCP standard topographic sheets.

---

## 6. Supplementary / fallback

- **USGS MRDS** ✅ — global mineral occurrence database with a working WFS:
  ```
  https://mrdata.usgs.gov/wfs/mrds?service=WFS&version=1.0.0&request=GetFeature&typeName=mrds&bbox=2.6,4.2,14.7,13.9
  ```
  Returns **24 records** in the Nigeria bbox with names, coordinates, commodity
  codes and permalinks (Madekali Prospect Fe, United Tin Areas Sn/Nb, Agbaja
  Prospect Fe, Jos Refinery). Caveats: **thin** (our fixture already has 64
  sites), **some records are Cameroonian** (the bbox overlaps), and USGS
  **stopped systematic updates in 2011**. Useful for cross-checking coordinates,
  not as a primary register. Bulk: `mrdata.usgs.gov/mrds/mrds-csv.zip` (23 MB).
- **USGS Minerals Yearbook — Nigeria** ✅ — annual production by commodity and
  named operators. Excellent for validating NEITI figures.
- **EITI global** ✅ <https://eiti.org/countries/nigeria>
- **resourceprojects.org** ✅ / **resourcedata.org** ✅ — project-level payments.
- **Dataphyte** ✅ <https://www.dataphyte.com/> — Nigerian data journalism,
  often republishes extractives data in clean form.
- **HDX Nigeria** <https://data.humdata.org/group/nga> — humanitarian layers
  (population, conflict, infrastructure) relevant to the **Risk** module.
  ACLED conflict data here would replace our synthetic security factor.
- **GRID3 Nigeria** — settlement/infrastructure layers; both `grid3.gov.ng` and
  `data.grid3.gov.ng` failed to resolve during testing.
- **NBS** `nigerianstat.gov.ng` — did not resolve from our host; normally the
  source for state-level economic indicators.

---

## Recommended integration order

1. **Mining Cadastre `.xlsx`** — biggest win, works today, real LGA attribution.
   Replaces the entire `getMiningTitles()` fixture.
2. **NEITI production/revenue** — makes the Dashboard KPIs and report charts
   defensible instead of invented.
3. **NGSA occurrence database** — start the request process early; it is the
   long pole. It replaces `DEPOSITS` and underpins Minerals + Prospectivity.
4. **NUPRC blocks** — scrape the bid-round portal, or request the concession
   register directly.
5. **ACLED / HDX** — turns the Risk engine's security factor from a seeded
   number into evidence.

### Notes for the Laravel backend

The API contract in `js/data/api.js` was written so this swap is a base-URL
change. Server-side, you will want:

- A **scheduled importer** per source (the MCO filename changes every release,
  so scrape the publications page for the newest link).
- A **normalisation layer**: uppercase states, comma-split multi-state and
  multi-LGA rows, parse the two date formats, resolve `=F2*0.21` formulas,
  fuzzy-match LGA names to the geoBoundaries ADM2 spelling.
- **Provenance columns** — `source`, `retrieved_at`, `source_url` — feeding the
  Data Center module, which is already built to display exactly that.
- Keep the placeholder generators as a **seeder** so development and demos work
  without live government endpoints.

### A caution worth stating plainly

Several of these portals were unreachable from our test host and some deep
links have already rotted within a year. Nigerian government data publishing is
improving quickly (eMC+ and the NEITI dashboard are genuinely good) but it is
**not yet API-stable**. Mirror every file you successfully download, timestamp
it, and never let the live app depend on a direct call to these hosts at
request time.
