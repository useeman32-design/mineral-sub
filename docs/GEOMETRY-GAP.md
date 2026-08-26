# Where do occurrence and title *locations* come from?

**Titles — resolved, 21 Aug 2026.** 11,706 cadastral polygons from the Mining
Cadastre Office eMC+ public map service. Reuse of that snapshot still needs
written confirmation from MCO (`MCO-WFS-REUSE.md`, Email 6).

**Occurrences — still open.** NGSA's National Mineral Occurrence Database is
described online and is not downloadable. Call script: `CALL-SCRIPTS.md`.

The rest of this note is kept as the investigation record, including a few
paragraphs that pre-date the WFS snapshot and are now historical.

## What we actually have today

| Layer | Geometry? | Source |
|---|---|---|
| State boundaries (36 + FCT) | ✅ polygons | geoBoundaries, in repo |
| LGA boundaries (774) | ✅ polygons | geoBoundaries, in repo |
| Protected areas (325) | ✅ polygons | WDPA, in repo |
| Settlements (911) | ✅ points | OSM Overpass, in repo |
| **Mining titles (11,706)** | ✅ **polygons** | MCO eMC+ WFS snapshot, 21 Aug 2026 |
| **Mineral occurrences** | ⚠️ 165 interim points | USGS + OSM. NGSA database still request-only |

## eMC+ public account — register here

**https://nigeriaminingcadastre.gov.ng/eMC/Account/RegisterPublic**

Verified live (HTTP 200, valid TLS — unlike NGSA, no `-k` needed). The form is
short and asks only for: user name, given name, family name, salutation,
default language, and email. There is no payment step.

Supporting pages, all reachable:
- Login — `/eMC/Account/Login`
- General documents — `/eMC/Document/GeneralDocuments`
- Legal documents — `/eMC/Document/LegalDocuments`
- Contact — info@miningcadastre.gov.ng

The public account is still worth creating — it makes us a known user before
Email 6 (reuse permission) goes out. Geometry is no longer the open question;
**written reuse terms** are.

## Why the MCO spreadsheet has no coordinates (historical)

The published spreadsheet (`Valid Mineral Titles As At 31 May 2026`) carries
`STATE`, `LGA` and `CU` (cadastral units, 1 CU = 0.21 km²) and no polygons.
Geometry is in eMC+. An earlier probe of the portal missed the GeoServer WFS
proxy the public map uses. That proxy answered without authentication on
21 Aug 2026 and is the source of `title-polygons.geojson`. Treat that as a
**public map snapshot**, not an open-data API. Email 6 asks MCO to confirm
reuse. Do not put a live WFS harvest into the website.

## RESOLVED IN PART — two real geometry layers are now in the app

Shipped in `a2f4c1d`. Neither needs a data request; both are openly licensed.

### `data/reference/mining-footprints.geojson` — 160 polygons, 35.7 km²

Extracted from the 192,584-polygon global mining set of **Maus et al. 2022 +
OpenStreetMap** (Zenodo `10.5281/zenodo.7307210`, ODbL 1.0, 117 MB GeoPackage
filtered to `isoa3='NGA'`). These were delineated by trained interpreters from
high-resolution satellite imagery and cover pits, tailings dams, waste rock
dumps, water ponds and processing infrastructure.

All 160 are point-in-polygon tagged to **state and LGA** (160/160, no misses).
Concentrations: Kogi 30, Nasarawa 12, Cross River 10, Ebonyi 8, FCT 8, Kano 8.

**These are observed workings, not licence boundaries.** A footprint shows
where ground has actually been disturbed; a title shows where someone holds a
right. They are different things and the tooltip says so.

### `data/reference/mineral-sites.json` — 165 points across 34 states

| Source | Records | Licence | Caveat |
|---|---|---|---|
| USGS minfac (OFR 2006-1135) | 32 | Public domain | Generalised coords — often nearest town |
| USGS MRDS | 14 | Public domain | Historic Jos-belt tin, `state` field empty |
| OpenStreetMap quarries/mines | 119 | ODbL 1.0 | Good positions, commodity usually absent |

Every point was clipped against the real state polygons (bbox filtering leaks
badly into Cameroon — 931 raw OSM hits reduce to 119 genuine ones) and tagged
with its LGA.

Both layers appear in the **Explore layer tree** and the **Data Center**
catalogue. Sites are flagged `Partial` at 61% quality on purpose: this is an
interim layer, not the NGSA database, and the app should not imply otherwise.

### What this does and does not solve

It gives the map real, verifiable geometry today. It does **not** give
positions for the 10,125 individual cadastre titles — that still requires the
MCO request. The occurrence coverage (165 points) is roughly 2% of what the
NGSA database is described as holding, so Email 1 remains the priority.

## Interim sources that were tested and rejected

These were too thin *on their own*, but combined they became the 165-point
interim layer described above.

- **USGS MRDS** — bulk CSV downloads fine (25 MB; only the `.php` endpoint
  404s). **14 Nigeria records**, all with coordinates, `state` empty on every one.
- **OpenStreetMap quarries/mines** — 931 raw bbox hits, **119** after clipping
  to real state polygons, only 5 named. The rest were Cameroon.
- **USGS minfac** — 6,478 Africa/Middle East facilities, **32 in Nigeria**,
  all with coordinates. Steel 9, cement 8, tin 4.

Still rejected outright:

- **Mindat API** — 404 without credentials.
- **Delve (World Bank ASM)** — 403.
- **OneGeology BRGM Africa WMS** — connection failure.
- **Mindat API** — 404 without credentials.

## The plan, in priority order

1. **NGSA National Mineral Occurrence Database** (Email 1, already drafted).
   This is the real answer for occurrences: 36 states + FCT, with commodity,
   location, status, type, reserve, grade and geology. It is an MS Access file
   released on request through the GeoData Centre. Send this first — it
   unblocks the largest layer.
2. **Ministry / MCO title polygons** (Email 4, already drafted). Requests the
   cadastre geometry and reports the broken NMRDSS endpoint in the same note.
3. **LGA-centroid approximation as a labelled fallback.** Until 1 and 2 land,
   a title can be drawn at the centroid of its LGA. This must be rendered
   distinctly and labelled *approximate — LGA centroid, not surveyed boundary*.
   It is honest, it makes the map useful immediately, and it disappears the
   moment real geometry arrives.

Note on the fallback: 10,125 titles across 774 LGAs means heavy stacking at
each centroid, so it should be drawn as a graduated cluster ("Kagarko: 62
titles") rather than 10,125 overlapping pins.

## Certificate warning for the server-side importer

NGSA's TLS certificate is expired. Any verifying client fails; `curl -k`
returns 200. When the PHP importer is written, `CURLOPT_SSL_VERIFYPEER=false`
must be scoped **to the ngsa.gov.ng host only** — never globally.
