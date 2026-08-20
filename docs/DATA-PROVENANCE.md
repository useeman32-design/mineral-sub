# Data provenance — what every number can be traced to

One page for defending the platform in a presentation. Each row states what the
data is, who produced it, and what it can and cannot support.

## Tier 1 — Government, audited, citable without qualification

| Dataset | Records | Source | Authority |
|---|---|---|---|
| **Audited production by state, 2023** | 36 states, 44 commodities, 82.08 Mt | NEITI Solid Minerals Industry Audit 2023, Appendix 19 | Independently reconciled by **Haruna Yahaya & Co. (Chartered Accountants)** under the NEITI Act 2007 and the EITI Standard |
| **Valid mineral titles** | 10,125 titles | Mining Cadastre Office, "Valid Mineral Titles as at 31 May 2026" | Statutory licensing register |
| **State boundaries (ADM1)** | 36 states + FCT | geoBoundaries | Standard reference boundaries |
| **LGA boundaries (ADM2)** | 774 | geoBoundaries | Standard reference boundaries |

The NEITI figures are the strongest evidence in the platform. They are not
estimates or scraped values — they are company returns reconciled against
government agency records by an appointed independent administrator, published
by a federal agency.

**Headline facts, defensible verbatim:**

- Total audited production 2023: **95,070,036 tonnes** nationally (up 34.4% on
  2022's 70,727,531 t). The company-level appendix loaded into this app
  accounts for **82,083,636 t** — the portion attributable to a *named operator
  in a named state*. The difference is unilaterally disclosed volume with no
  operator attribution. **Do not present the two numbers as if they should
  match; explain the distinction.**
- Sector revenue to government 2023: **₦401.87 bn**, up 16% on ₦345.41 bn in 2022.
- Cumulative 2007–2023: **₦1.137 tn** (~$3.86 bn).
- GDP contribution: **0.75%** (2023).
- Royalty paid 2023: **₦9.01 bn**.
- Exports 2023: **4.32 M tonnes**, ₦117.29 bn.
- Top producing states: **Edo, Ogun, Kogi** — matches NEITI's own finding that
  Ogun, Kogi and Rivers led production.
- **137 distinct operating companies** appear in the appendix.

Commodity concentration is the story the data tells loudest: **limestone is
57.4%** of audited tonnage and granite aggregate 17.0%. Together, construction
materials are roughly three-quarters of everything formally produced. Lithium,
despite the investment noise, is **0.9%**.

## Tier 2 — Openly licensed, verifiable, but with stated limits

| Dataset | Records | Source | Limit to state plainly |
|---|---|---|---|
| Satellite mining footprints | 160 polygons, 35.7 km² | Maus et al. 2022 + OSM (Zenodo, ODbL) | Observed workings, **not licence boundaries** |
| Georeferenced mineral sites | 165 points, 34 states | USGS minfac (32), USGS MRDS (14), OSM (119) | Interim; ~2% of what NGSA is said to hold |
| Protected areas | 325 polygons | WDPA / Protected Planet | Non-commercial licence terms |
| Settlements | 911 | OpenStreetMap Overpass | Community-mapped |
| Population grid | 1 km raster | WorldPop, CC BY 4.0 | Modelled, not censused |

## Tier 3 — Sample data, clearly labelled in-app

Minerals occurrence register, Oil & Gas blocks, geochemistry and airborne
geophysics are **sample data**. The Data Center labels them as such and the GO
LIVE toggle switches the app between sample and real sources. Say this openly
in the presentation — the honesty is a strength, and the toggle demonstrates
the architecture is ready for the real feed.

## Known gaps — state these before you are asked

1. **No coordinates for individual titles.** The MCO export carries state, LGA
   and area in cadastral units, but no geometry. The eMC+ portal holds it
   behind a login with no public WMS/WFS. Requested via the Ministry/MCO.
2. **Occurrence coverage is thin.** The NGSA National Mineral Occurrence
   Database (36 states + FCT, with commodity, grade, reserve and geology) is
   described publicly but has no download link. Requested from the GeoData
   Centre.
3. **Cadastre date quality.** The published register contains raw Excel serials
   (46059, 47884), transposed digits (`0810/2030`, year 4048) and placeholder
   dates (1900-02-02). The app rejects anything outside 1960–2100 and displays
   "Date unrecorded" rather than inventing a year. **This is a deliberate
   integrity decision and worth showing.**
4. **NEITI's own caveats.** The 2023 audit reports ₦680.63 m in annual service
   fee liabilities across 1,619 companies, and notes non-responsive entities.
   The sector's formal data is incomplete at source, not just in this app.

## Reproducibility

Originals are committed under `data/source/`, derived web products under
`data/reference/`. Anyone can re-run the extraction against the source files.

- `neiti-2023-appendix19-production-by-state.xlsx` (2.1 MB) → `production-2023.json`
- `neiti-2023-audit-report.pdf` (5.2 MB, 228 pp) — the full audit for citation
- `mco-valid-titles.xlsx` (1.4 MB) → `mining-titles.json`, `titles-summary.json`

## Counting Nigeria correctly

**36 states + the FCT = 37 ADM1 units.** The FCT is not a state. The app says
"36 states + FCT" everywhere. NEITI's appendix reports 36 producing states.

## Server-side note

`neiti.gov.ng` and `ngsa.gov.ng` both serve **expired TLS certificates**. A
verifying client fails; `curl -k` succeeds. When the PHP importer is built,
scope `CURLOPT_SSL_VERIFYPEER=false` to those hosts only — never globally.
