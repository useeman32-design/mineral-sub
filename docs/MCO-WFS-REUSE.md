# The mining-title blocks — where they came from, and how we can depend on them

You were right to flag this. The polygons on the map did not come from the published Excel sheet. They came from a government map service we queried without asking anyone first.

This note names the site, states what that does and does not allow, and lists the steps that make the layer defensible.

**This is practical risk management, not legal advice.**

---

## The site you are thinking of

**Mining Cadastre Office — eMC+** (electronic Mining Cadastre).

| | |
|---|---|
| Map / portal | https://nigeriaminingcadastre.gov.ng/eMC |
| Public registration (no payment) | https://nigeriaminingcadastre.gov.ng/eMC/Account/RegisterPublic |
| Publications (the Excel register) | https://www.miningcadastre.gov.ng/publication |
| The endpoint we used | `https://nigeriaminingcadastre.gov.ng/eMC/GeoServer/WmsProxy.ashx` |

The public map is served by a GeoServer proxy. The same proxy answers **WFS** (vector features) as well as WMS (pictures of the map), with **no login**:

```
SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature
&TYPENAME=emcplus:wms_lic_valid_2057
&OUTPUTFORMAT=application/json
&SRSNAME=EPSG:4326
```

`SRSNAME=EPSG:4326` is required. Without it the coordinates are not longitude/latitude.

Retrieved 21 August 2026: **12,089** features, **11,706** kept. The 383 dropped rows are Reconnaissance Permits published with null geometry — an RP is non-exclusive and has no block, so we omitted them rather than inventing shapes.

Those 11,706 polygons are the squares on the map. They are real cadastral units (15 arc-second, 0.21 km²), not sketches.

The published spreadsheet (`Valid Mineral Titles As At 31 May 2026`, 10,125 rows) is the **same register without geometry**. Licence numbers do not join 1:1 (spreadsheet `29804` vs GeoServer `ML-000002`), but holder overlap is 94%, which is how we know they are the same underlying cadastre. The app now runs **only** on the GeoServer extract so the register and the map cannot disagree.

---

## Did we take it “without consent”?

Honest answer, in two parts.

**Access.** We did not break a password and we did not scrape a hidden admin tool. We asked the same unauthenticated map service that the public eMC+ viewer uses, and it returned GeoJSON. The Office also publishes the attribute register as Excel for anyone to download. Under the Nigerian Minerals and Mining Act 2007 the cadastre is a public register; under the FOI Act 2011 a public institution’s records are accessible. So: this is **public government information**, obtained from a public endpoint.

**Reuse.** Publicly reachable is not the same as an open licence. The Office’s own website terms (https://www.miningcadastre.gov.ng/terms-and-conditions, last updated **8 May 2023**) say the content is offered for **personal, non-commercial use or internal business purpose only**, and that copying, aggregating, republishing or **publicly displaying** it for a commercial purpose needs **express prior written permission** from `info@miningcadastre.gov.ng`.

A public GitHub Pages app that draws 11,706 title polygons is public display. An internal prototype on your laptop is closer to “internal business purpose”. Those are different risk levels. We have been treating the extract as “Nigerian Government public data”. That overclaims the *licence*, even though it does not overclaim the *source*.

The Data Center licence row is now:

> **Public eMC+ endpoint; reuse permission requested**

not “open data”.

---

## How we can still depend on it

Depend on it as **the official cadastre**, not as a file we have been licensed to sell.

| We can say, today | We must not say, today |
|---|---|
| These are the Mining Cadastre Office’s valid title blocks, snapshot 21 Aug 2026, from the eMC+ map service. | This is open data / CC BY / we have a licence to redistribute. |
| The squares are the issued cadastral units, not approximations. | The Mining Cadastre Office endorses this platform. |
| Attributes match the public register (holder, mineral, dates, litigation). | We scraped a private database. |
| If MCO issues a correction or asks us to take the layer down, we will. | The live site is a substitute for eMC+. |

That is enough for a demo, a public-interest screening tool, and a conversation with an agency. It is **not** enough to productise or sell the cadastre layer.

### If someone challenges it in a meeting

> The blocks are the Mining Cadastre Office cadastre. They are the same polygons the public eMC+ map draws. We took a snapshot from that map’s own WFS on 21 August 2026 so the app does not call their server at runtime. We credit the Office on the map and in the Data Center. Their website terms ask for written permission before republication, so we have written to info@miningcadastre.gov.ng to confirm reuse, attribution, and a correction/takedown route. Until that letter comes back we label the layer “public endpoint; reuse permission requested”, not open data. If the Office objects, the layer comes off.

Do not mention “we found an unauthenticated proxy” in a hostile room. Say “the public eMC+ map service”.

---

## What we are doing about it

1. **Honest labelling** in the Data Center (done in this commit).
2. **Email 6** in `REQUEST-EMAILS.md` — a humble request for written reuse terms, attribution wording, an official feed if they have one, and a correction/takedown contact. No payment language. **Send this.**
3. **Call script** in `CALL-SCRIPTS.md` §2. Call if the email sits for five working days.
4. **Register** a public eMC+ account (no payment) so we are a known user, not only an anonymous WFS client.
5. Keep the snapshot **in-repo** so the live app never depends on their endpoint staying open. If they switch the proxy off, the map still works, and we honour a takedown if they ask.
6. **Do not** build a live WFS harvest into the website. A snapshot plus a letter is the defensible pattern.

---

## What would actually close the risk

A short reply from MCO, even an email, that says some combination of:

- you may display the valid titles with attribution to the Mining Cadastre Office;
- here is how to be credited;
- here is who to notify if a holder disputes a record;
- (optional) here is the official extract / WMS we would rather you used.

Until that exists, treat the layer as **provisionally usable, not cleared**.
