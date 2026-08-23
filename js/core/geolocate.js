/**
 * LIVE GEOLOCATION + NAVIGATION
 * =============================
 * Real GPS, not IP geolocation. `navigator.geolocation.watchPosition` with
 * `enableHighAccuracy: true` uses the device's GNSS receiver (plus wifi/cell
 * assistance), which is what Google Maps uses. IP lookup is explicitly avoided:
 * in Nigeria it commonly resolves to the carrier's gateway city and can be
 * hundreds of kilometres out.
 *
 * Requires a secure context (https or localhost). GitHub Pages is https, so
 * the live site qualifies.
 *
 * Routing goes through OSRM, which returns a real road path rather than a
 * straight line. If routing fails the caller still gets a great-circle
 * distance so the feature degrades instead of breaking.
 */

const OSRM = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
];

/** Metres between two [lat,lng] points — haversine. */
export function haversine(a, b) {
  const R = 6371000;
  const φ1 = a[0] * Math.PI / 180, φ2 = b[0] * Math.PI / 180;
  const dφ = (b[0] - a[0]) * Math.PI / 180;
  const dλ = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtDistance(m) {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(2)} km`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtDuration(sec) {
  if (sec == null) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')} min`;
}

/**
 * Road route between two [lat,lng] points.
 * @returns {Promise<{distance:number, duration:number, coords:[number,number][], road:boolean}>}
 */
export async function route(from, to) {
  const path = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  for (const host of OSRM) {
    try {
      const r = await fetch(`${host}/route/v1/driving/${path}?overview=full&geometries=geojson`);
      if (!r.ok) continue;
      const d = await r.json();
      if (d.code !== 'Ok' || !d.routes?.length) continue;
      const rt = d.routes[0];
      return {
        distance: rt.distance,
        duration: rt.duration,
        coords: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        road: true,
      };
    } catch { /* try the next host */ }
  }
  // Routing unavailable — straight line, clearly flagged.
  return { distance: haversine(from, to), duration: null, coords: [from, to], road: false };
}

/**
 * Continuous position tracking.
 *
 * Emits every fix so the UI can shrink the remaining distance as the user
 * moves. Accuracy is reported rather than hidden: a 2000 m accuracy reading
 * means wifi/cell trilateration, not GNSS, and the UI says so.
 */
export class Tracker {
  constructor({ onFix, onError } = {}) {
    this.onFix = onFix || (() => {});
    this.onError = onError || (() => {});
    this.id = null;
    this.last = null;
    this.trail = [];
  }

  get supported() {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  get secure() {
    return typeof window !== 'undefined'
      && (window.isSecureContext || location.hostname === 'localhost');
  }

  start() {
    if (!this.supported) { this.onError({ code: -1, message: 'This browser has no geolocation support.' }); return false; }
    if (!this.secure) { this.onError({ code: -2, message: 'Location needs a secure (https) connection.' }); return false; }
    if (this.id !== null) return true;

    this.id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          latlng: [pos.coords.latitude, pos.coords.longitude],
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          at: pos.timestamp,
        };
        this.last = fix;
        const t = this.trail;
        // Only extend the trail on real movement, so a stationary device does
        // not accumulate thousands of jittering points.
        if (!t.length || haversine(t[t.length - 1], fix.latlng) > 8) t.push(fix.latlng);
        if (t.length > 500) t.shift();
        this.onFix(fix);
      },
      (err) => this.onError(err),
      {
        enableHighAccuracy: true,   // GNSS, not IP
        maximumAge: 0,              // never serve a cached fix
        timeout: 20000,
      },
    );
    return true;
  }

  stop() {
    if (this.id !== null) navigator.geolocation.clearWatch(this.id);
    this.id = null;
  }

  get active() { return this.id !== null; }
}
