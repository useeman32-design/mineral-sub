# Where do occurrence and title *locations* come from?

You are right that NGSA and NUPRC cover most of what the app needs. The one
thing neither of them has given us yet is **geometry** — the actual coordinates
of mineral occurrences and the polygons of mining titles. This note records
what we hold, what we tested, and how the gap gets closed.

## What we actually have today

| Layer | Geometry? | Source |
|---|---|---|
| State boundaries (36 + FCT) | ✅ polygons | geoBoundaries, in repo |
| LGA boundaries (774) | ✅ polygons | geoBoundaries, in repo |
| Protected areas (325) | ✅ polygons | WDPA, in repo |
| Settlements (911) | ✅ points | OSM Overpass, in repo |
| **Mining titles (10,125)** | ❌ **none** | MCO cadastre export — state/LGA *names* and a `CU` count only |
| **Mineral occurrences** | ❌ **none** | NGSA database is described online but not downloadable |

So the register is real and complete on attributes — holder, commodity, area,
dates — and completely blind on position. That is the whole gap.

## Why the MCO export has no coordinates

The published spreadsheet (`Valid Mineral Titles As At 31 May 2026`) carries
`STATE`, `LGA` and `CU` (cadastral units, 1 CU = 0.21 km²). The coordinates
exist in the eMC+ system behind `nigeriaminingcadastre.gov.ng/eMC` — the map
page is real and returns a 40 KB document, but it sits behind a login. There
is no public WMS/WFS/ArcGIS service exposed; probing for one returns the
portal's "Not found" page. **Title polygons therefore require a request**, not
a scrape. That is Email 4 in `REQUEST-EMAILS.md`.

## Interim sources that were tested and rejected

- **USGS MRDS** — the bulk CSV *does* download (25 MB, the `.php` endpoint is
  the one that 404s). It contains **14 Nigeria records**. All 14 have
  coordinates, all are Jos-belt tin plus a couple of prospects, and the `state`
  field is empty on every one. Too thin to be an occurrence layer.
- **OpenStreetMap quarries/mines** — 931 features in the Nigeria bounding box,
  but clipping to the actual state polygons leaves **119**, of which only **5**
  are named. The rest of the bbox hits was Cameroon. Useful as a texture layer,
  not as an occurrence register.
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
