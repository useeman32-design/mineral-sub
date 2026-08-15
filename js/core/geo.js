/**
 * Geodesic measurement helpers.
 * All calculations are spherical (mean Earth radius), which is accurate to
 * well under a metre at the scales this application works at.
 */

const R = 6371008.8; // IUGG mean Earth radius, metres
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance between two [lat,lng] pairs, in metres. */
export function haversine(a, b) {
  const [la1, lo1] = a, [la2, lo2] = b;
  const dLat = rad(la2 - la1);
  const dLon = rad(lo2 - lo1);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Total length of a vertex path, in metres. */
export function pathLength(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += haversine(pts[i - 1], pts[i]);
  return t;
}

/**
 * Spherical polygon area in m², via the shoelace formula on the sphere.
 * Ring is closed implicitly; winding direction is ignored.
 */
export function polygonArea(pts) {
  if (pts.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const [la1, lo1] = pts[i];
    const [la2, lo2] = pts[(i + 1) % pts.length];
    total += (rad(lo2) - rad(lo1)) * (2 + Math.sin(rad(la1)) + Math.sin(rad(la2)));
  }
  return Math.abs((total * R * R) / 2);
}

/** Perimeter of a closed ring, in metres. */
export function polygonPerimeter(pts) {
  if (pts.length < 2) return 0;
  return pathLength([...pts, pts[0]]);
}

/** Initial bearing from a to b, in degrees (0–360). */
export function bearing(a, b) {
  const [la1, lo1] = a, [la2, lo2] = b;
  const y = Math.sin(rad(lo2 - lo1)) * Math.cos(rad(la2));
  const x = Math.cos(rad(la1)) * Math.sin(rad(la2)) -
    Math.sin(rad(la1)) * Math.cos(rad(la2)) * Math.cos(rad(lo2 - lo1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Midpoint of a path, used for placing labels. */
export function centroid(pts) {
  if (!pts.length) return null;
  let la = 0, lo = 0;
  pts.forEach((p) => { la += p[0]; lo += p[1]; });
  return [la / pts.length, lo / pts.length];
}

/* ------------------------------------------------------------------
   Formatting — honours the unit system chosen in Settings
   ------------------------------------------------------------------ */

const FT = 3.280839895;
const MI = 0.000621371192;
const AC = 0.000247105381;
const SQMI = 3.861021585e-7;

export function formatDistance(m, units = 'metric') {
  if (!isFinite(m)) return '—';
  if (units === 'imperial') {
    const mi = m * MI;
    return mi >= 0.1 ? `${mi.toFixed(2)} mi` : `${Math.round(m * FT).toLocaleString()} ft`;
  }
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m).toLocaleString()} m`;
}

export function formatArea(m2, units = 'metric') {
  if (!isFinite(m2)) return '—';
  if (units === 'imperial') {
    const sqmi = m2 * SQMI;
    if (sqmi >= 0.1) return `${sqmi.toFixed(2)} mi²`;
    return `${(m2 * AC).toFixed(2)} ac`;
  }
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(2)} km²`;
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${Math.round(m2).toLocaleString()} m²`;
}

/** Always-metres readout for the secondary line in the inspector. */
export function formatSqMetres(m2) {
  return `${Math.round(m2).toLocaleString()} m²`;
}

/**
 * Derived metrics for a shape record. Kept here (not in the draw engine) so
 * both the map and the inspector read identical numbers.
 */
export function measureShape(shape, units = 'metric') {
  const pts = shape.latlngs || [];
  switch (shape.type) {
    case 'line': {
      const len = pathLength(pts);
      return {
        primary: formatDistance(len, units),
        primaryLabel: 'Length',
        rows: [
          ['Segments', String(Math.max(0, pts.length - 1))],
          ['Vertices', String(pts.length)],
          ...(pts.length >= 2 ? [['Bearing', `${bearing(pts[0], pts.at(-1)).toFixed(1)}°`]] : []),
        ],
        raw: { lengthM: len },
      };
    }
    case 'circle': {
      const r = pts.length >= 2 ? haversine(pts[0], pts[1]) : 0;
      const area = Math.PI * r * r;
      return {
        primary: formatDistance(r, units),
        primaryLabel: 'Radius',
        rows: [
          ['Area', formatArea(area, units)],
          ['Area (m²)', formatSqMetres(area)],
          ['Circumference', formatDistance(2 * Math.PI * r, units)],
          ['Diameter', formatDistance(2 * r, units)],
        ],
        raw: { radiusM: r, areaM2: area },
      };
    }
    case 'polygon': {
      const area = polygonArea(pts);
      const per = polygonPerimeter(pts);
      return {
        primary: formatArea(area, units),
        primaryLabel: 'Area',
        rows: [
          ['Area (m²)', formatSqMetres(area)],
          ['Perimeter', formatDistance(per, units)],
          ['Vertices', String(pts.length)],
        ],
        raw: { areaM2: area, perimeterM: per },
      };
    }
    case 'point':
    default: {
      const p = pts[0] || [0, 0];
      return {
        primary: `${Math.abs(p[0]).toFixed(4)}°${p[0] >= 0 ? 'N' : 'S'}`,
        primaryLabel: 'Latitude',
        rows: [['Longitude', `${Math.abs(p[1]).toFixed(4)}°${p[1] >= 0 ? 'E' : 'W'}`]],
        raw: { lat: p[0], lng: p[1] },
      };
    }
  }
}
