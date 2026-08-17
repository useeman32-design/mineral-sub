# Data Request Emails — ready to send

Copy each block into your mail client. Replace `[ … ]` placeholders before
sending. Send **Email 1 first** — it is the blocker for the whole platform.

Practical advice for Nigerian agency correspondence:
- Send from an **organisational address** if you have one, not a free webmail.
- **Copy more than one recipient**, and phone to confirm receipt a few days later.
- Attach a **letter-headed PDF** of the same text if you have letterhead — it is
  often what gets a request formally logged.
- Be explicit that you accept a **paid data licence**; several of these datasets
  are sold, and saying so upfront avoids a round trip.

---

## Email 1 — NGSA: National Mineral Occurrence Database ⭐ HIGHEST PRIORITY

**To:** support@ngsa.gov.ng
**Cc:** info@ngsa.gov.ng
**Subject:** Data request — National Mineral Occurrence Database and prospectivity layers (digital, licensed use)

> Dear Sir/Madam,
>
> I am writing to request access to geoscientific datasets held by the Nigerian
> Geological Survey Agency for use in a mineral-resource intelligence platform we
> are developing for the Nigerian mining sector.
>
> **About the project**
> We are building a web-based GIS and analytics platform that consolidates
> Nigerian mineral occurrence data, prospectivity analysis, exploration risk
> assessment, the mining cadastre and petroleum acreage into a single interface
> for investors, geoscientists and regulators. The platform is built on Nigerian
> government data and cites the originating agency for every dataset displayed.
>
> **Datasets requested**
>
> 1. **National Mineral Occurrence Database** — described on your website
>    (https://ngsa.gov.ng/database/) as covering all 36 states and the FCT, with
>    commodity name, location, state, status, type, reserve, grade, geology and
>    mineral association. A digital export in Microsoft Access, CSV or Excel would
>    be ideal. **Geographic coordinates for each occurrence are essential** for
>    our purposes.
>
> 2. **Mineral Prospectivity Model Map of Nigeria (2023 classification)** — the
>    underlying classification data, in GIS format (shapefile/GeoTIFF) if possible.
>
> 3. **LGA-level Mineral Potential Zones** — we note published sheets for
>    Nasarawa, Osun, Oyo and Sokoto (2025) and would welcome these plus any
>    further states available.
>
> 4. **Geochemical mapping data** — element concentration data underlying the
>    published gold, copper, silver, aluminium and cerium maps, together with the
>    Geochemical Mapping Index Map 2024.
>
> **Terms**
> We are prepared to pay any applicable data licence, reproduction or service fee,
> and to sign a data-use agreement. Please advise the cost, the procedure and any
> forms we need to complete. We are equally happy to collect the data in person at
> the GeoData Centre in Utako if that is more convenient.
>
> **A technical note offered in good faith**
> The TLS/SSL certificate for `ngsa.gov.ng` expired recently. Web browsers and
> automated tools now show a security warning or refuse the connection entirely,
> which may be limiting public access to your published downloads. Renewing the
> certificate (a free Let's Encrypt certificate would suffice) should resolve it.
>
> I would be grateful for your guidance on how to proceed and am happy to provide
> any further information.
>
> Yours faithfully,
> **[Your full name]**
> [Position] · [Organisation]
> [Phone] · [Email]

---

## Email 2 — NGSA GeoData Centre: airborne geophysics

**To:** support@ngsa.gov.ng
**Subject:** Request for airborne geophysical data — magnetic and radiometric sheet coverage

> Dear Sir/Madam,
>
> Further to our interest in NGSA's geoscientific holdings, I would like to
> request access to the national airborne geophysical survey data.
>
> Your website publishes sample sheets — Sheet 28 (Argungu NE) and Sheet 66
> (Gubio NW) — as ASCII grids, TMI grids and interpretation reports. These are
> exactly the format we require. We would like to obtain the equivalent data for
> **full national coverage**, or, if that is not practical initially, for the
> following priority areas:
>
> - **Zamfara / Kebbi / Niger** (gold, schist belt)
> - **Nasarawa / Plateau** (lithium, tin, columbite)
> - **Kogi / Kwara** (iron ore, gold)
> - **Osun / Oyo** (gold, lithium pegmatites)
>
> Specifically:
> - Total Magnetic Intensity (grids and/or ASCII XYZ)
> - Radiometric data (K, U, Th and ternary)
> - Gravity data where available
> - Airborne electromagnetic (TDEM) for the Birnin Gwari, Ife-Ilesha and Benue blocks
> - Accompanying interpretation reports and sheet index
>
> We understand this data may be supplied on a commercial basis. Please advise the
> applicable fees, the available formats (Geosoft `.grd`, ASCII XYZ or GeoTIFF are
> all suitable), and the delivery method for datasets of this size.
>
> Yours faithfully,
> **[Your full name]** · [Organisation]
> [Phone] · [Email]

---

## Email 3 — NGSA: geological maps

**To:** support@ngsa.gov.ng
**Subject:** Purchase enquiry — geological and mineral resources maps, digital GIS formats

> Dear Sir/Madam,
>
> I would like to enquire about purchasing geological map products from NGSA,
> preferably in **digital GIS format** (shapefile, geodatabase or GeoTIFF) rather
> than print, as they will be used as data layers in a web mapping platform.
>
> Of interest:
> - Geological Map of Nigeria, 1:2,000,000
> - Geological sheet maps at 1:100,000 (index and available sheets)
> - State Geological and Mineral Resources Maps — all 36 states and the FCT
> - Critical mineral corridor maps: gold, lithium, copper, REE, phosphate/manganese
> - Schist Belt map of Nigeria
> - Lineament and structural data where available
>
> Please advise pricing (per sheet and for complete sets), available formats, and
> whether digital licensing is offered for use in a web application with
> attribution to NGSA.
>
> Yours faithfully,
> **[Your full name]** · [Organisation]
> [Phone] · [Email]

---

## Email 4 — Ministry of Mines and Steel Development: NMRDSS fault report + cadastre geometry

**To:** iaismp.support@minesandsteel.com
**Cc:** info@miningcadastre.gov.ng
**Subject:** NMRDSS portal error — and request for mining title spatial data

> Dear Sir/Madam,
>
> I am writing on two related matters concerning the Ministry's mineral data
> systems.
>
> **1. NMRDSS technical fault**
>
> The Nigerian Mineral Resources Decision Support System at
> `https://miningdecision.minesandsteel.gov.ng/nmrdss/` currently loads its
> interface but cannot retrieve any data. The underlying ArcGIS service returns:
>
> > `Could not connect to the ArcGIS component at URL`
> > `https://VPORTAL.ASMD.INTERNAL:7443/arcgis/sharing/rest/search`
> > `9017$SITE_NOT_INITIALIZED`
>
> The server appears to be configured with an **internal hostname**
> (`VPORTAL.ASMD.INTERNAL`) that cannot be resolved from the public internet, so
> the map and query functions do not work for external users. Your GIS team should
> be able to correct this by updating the portal's WebContextURL configuration.
> I report this simply as a member of the public who would find the system
> valuable were it operational.
>
> **2. Mining title spatial data**
>
> We are developing a mineral intelligence platform and are already using the
> Mining Cadastre Office's published "Valid Mineral Titles" spreadsheet, which is
> excellent. However, it contains no coordinates or licence boundaries.
>
> We would like to request the **spatial component** of the cadastre:
> - Mining title polygons/boundary coordinates (shapefile, GeoJSON or KML)
> - Cadastral unit reference grid
> - Title identifier so the geometry can be joined to the published register
>
> This would allow the platform to answer questions such as *"is this prospective
> area already covered by an existing licence?"* — which supports both investor
> due diligence and transparent tenure administration.
>
> We are prepared to pay any applicable fee and to sign a data-use agreement.
>
> Yours faithfully,
> **[Your full name]** · [Organisation]
> [Phone] · [Email]

---

## Email 5 — NUPRC: petroleum concession data

**To:** info@nuprc.gov.ng
**Subject:** Data request — petroleum concession register and block boundaries

> Dear Sir/Madam,
>
> I am writing to request access to petroleum acreage data held by the Commission
> for use in a Nigerian natural-resource intelligence platform.
>
> **Requested**
> 1. **Concession register** — current OPLs, OMLs, PPLs and PMLs, with block
>    identifier, operator, equity distribution, terrain, basin, area, grant date
>    and expiry date. We note the Commission's 2024 Annual Report cites 282 blocks
>    (55 OPL, 107 OML, 70 PPL, 50 PML); a current machine-readable register
>    (Excel or CSV) would be ideal.
> 2. **Block boundary geometry** — shapefile or GeoJSON of licence blocks, as
>    prepared by the Commission's Concession Mapping & GIS unit.
> 3. **Field outlines** — oil and gas field boundaries where publicly releasable.
> 4. **Production data** — published field or terminal-level production summaries.
> 5. **Basin boundaries** — Niger Delta, Anambra, Benin, Benue Trough, Chad.
>
> We understand some data held in the National Data Repository is commercial or
> restricted; we are requesting only what the Commission is able to release
> publicly, and are happy to pay any applicable licence fee.
>
> A minor note: several document links on `nuprc.gov.ng` (including the Concession
> Situation report) currently return "page not found", which makes published
> material hard to locate.
>
> Yours faithfully,
> **[Your full name]** · [Organisation]
> [Phone] · [Email]

---

## Non-email registrations — do these yourself, ~10 minutes each

| Source | Action | Why |
|---|---|---|
| **ACLED** | Register at https://acleddata.com/register — free for research/non-commercial. You receive an API key by email. | Real security incidents replace the seeded 28% security factor in the Risk engine. |
| **Protected Planet** | Optional token at https://api.protectedplanet.net/request | Only for live updates — we already have the bulk file. |
| **Copernicus** | Free account at https://dataspace.copernicus.eu/ | Sentinel-2 imagery, when you need it. |
| **USGS EarthExplorer** | Free account at https://ers.cr.usgs.gov/register | SRTM DEM and Landsat. |
