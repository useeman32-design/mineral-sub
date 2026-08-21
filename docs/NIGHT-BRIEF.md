# Overnight brief — 21 Aug 2026

Everything below is committed, pushed and verified on the live site.
Head: `ce7d030`. Zero console errors throughout.

---

## 1. Your question: are the square blocks correct?

**Yes — and it is worth saying so out loud in the presentation.**

Nigeria's cadastre is **graticular**: licences are granted as blocks bounded by
lines of latitude and longitude, not by geology or surveyed ground. Evidence:

| Check | Result |
|---|---|
| Axis-aligned (all edges N–S or E–W) | **11,681 of 11,706 = 99.8%** |
| Block dimensions | Always multiples of **15 arc-seconds** |
| One 15″×15″ block at Nigerian latitudes | **0.21 km²** |
| Nigeria's legal cadastral unit (1 CU) | **0.21 km²** ✓ |
| Our computed area ÷ MCO's declared area | **1.000** |

That last row is the proof: our geometry reproduces the MCO's own published
areas exactly. Larger licences are multiple blocks fused, which is why you see
L-shapes and staircases as well as rectangles. Ghana's mining act uses the
identical 15-second graticule — this is standard practice, not an artefact.

**Line for the presentation:** *"These are the actual licensed cadastral
blocks as issued, not approximations."*

---

## 2. Built while you slept

### Overlap analysis — the headline finding

Intersected all 11,706 licensed blocks against the 160 satellite footprints
and 325 WDPA protected areas.

| Finding | Number |
|---|---|
| **Licences intersecting a protected area** | **515**, across **87** protected areas |
| **Satellite workings outside any licence** | **61** (8.38 km² disturbed) |
| Workings inside a licence | 99 of 160 |
| Licences with a matched working | 93 |

Worst-affected: **Cross River National Park (63 licences)**, Opara Game Reserve
(51), Ebbe/Kampe (50), Old Oyo National Park (42), Stubbs Creek (31).

Unlicensed workings cluster in **Kogi (9), Kano (7), Yobe (5), FCT (5)**.

### Two new map layers

- **Protected-area conflicts** — the 515 flagged licences drawn in red over the
  cadastre, hover gives the park, designation and holder
- **Major roads** — 5,211 motorway/trunk ways from OSM, clipped to Nigeria,
  simplified to ~200 m. **80 KB gzipped.** Retires the last
  "awaiting OSM import" placeholder.

Both canvas-rendered. With cadastre + conflicts + roads all on, the explore
view holds **1,147 DOM nodes** and each layer draws in ~6 s under **4× CPU
throttling**. 9/9 checks passed.

---

## 3. ⚠️ Read this before you present the dormancy angle

The tempting headline is *"only 93 of 11,706 licences show activity — 99% are
dormant."* **Do not say that.** It is not supportable.

Our footprint layer covers **160 sites and 35.7 km² nationally**. It is not a
survey of Nigerian mining. Absence of a matched footprint means *no
satellite-mapped working in this dataset falls inside that block* — not that
the block is idle. Presenting 99% dormancy would be the one claim in the deck
an expert could dismantle, and it would cast doubt on everything solid.

**The protected-area overlap is the robust half** — both inputs are complete
polygon sets. Lead with that: *"515 licences intersect 87 protected areas,
including 63 inside Cross River National Park."* That number holds up.

The caveat is written into the dataset's own `meta` block and the ledger, so it
travels with the data rather than living only in my head.

---

## 4. System audit — what is still missing

| Gap | Status | Route |
|---|---|---|
| **Mineral occurrences** | 165 interim points vs NGSA's full inventory | **NGSA email — the only real blocker** |
| Regional geochemistry | Not connected | NGSA email |
| Airborne geophysics | 2 of ~330 sheets public | NGSA email |
| Petroleum blocks | Sample data | NUPRC — endpoints still dead tonight |
| Commodity register | Sample data | Derivable from NGSA occurrences |

I re-probed NGSA and NUPRC tonight. NGSA's airborne page now lists **no**
downloadable sheets at all, `/geochemical-data/` and `/downloads/` are 404, and
NUPRC's asset pages and GIS host are still unreachable. **These cannot be
scraped — the email is the only route.**

---

## 5. On the emails

Monday → Friday is **4 working days**. Normal for a Nigerian agency; not yet a
red flag.

Two things worth knowing:

1. **The MCO request may be moot.** It asked for title polygons — we now have
   all 11,706 from their own GeoServer. I would still keep it open: an official
   channel is more durable than an undocumented endpoint that could be locked
   down without notice.
2. **NGSA is now the single blocker.** Occurrences, geochemistry and geophysics
   all sit behind that one request.

Suggested nudges: **phone the GeoData Centre** rather than email again — that
often works in minutes where email fails for weeks — and copy
**info@ngsa.gov.ng** if you only used support@. If nothing by mid next week,
I will draft a short follow-up in the same no-payment tone.

---

## 6. Where to see it

**https://useeman32-design.github.io/mineral-sub/**

1. **Data Center** → GO LIVE → now **19 datasets**, each connected one with its
   own on/off switch
2. **Explore Map** → Layers → **Mining title blocks**, **Protected-area
   conflicts**, **Major roads**
3. Filter Data Center by **Analytics** to find "Cadastre overlap analysis"

Full register with checksums and commits: **`docs/DATA-LEDGER.md`**.
Presentation brief: **`docs/DATA-PROVENANCE.md`**.
