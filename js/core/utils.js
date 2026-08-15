/** Small DOM + formatting helpers shared by every module. */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  if (html) node.innerHTML = html;
  return node;
}

/* ---------- formatting ---------- */
export const fmt = {
  int: (n) => Number(n).toLocaleString('en-US'),
  compact: (n) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n),
  pct: (n, d = 0) => `${Number(n).toFixed(d)}%`,
  delta: (n) => `${n > 0 ? '+' : ''}${Number(n).toFixed(1)}%`,
  coord: (lat, lng) =>
    `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`,
};

/* ---------- misc ---------- */
export function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Deterministic pseudo-random from a string seed — keeps placeholder data stable. */
export function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000; };
}

/** Count-up animation for metric values. */
export function countUp(node, to, { dur = 900, decimals = 0, suffix = '' } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = (decimals ? to.toFixed(decimals) : fmt.int(Math.round(to))) + suffix;
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const p = clamp((t - t0) / dur, 0, 1);
    const e = 1 - Math.pow(1 - p, 3);
    const v = to * e;
    node.textContent = (decimals ? v.toFixed(decimals) : fmt.int(Math.round(v))) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- micro-charts (inline SVG) ---------- */

export function sparkline(values, { w = 62, h = 22, color = 'var(--green)', fill = true, sw = 1.4 } = {}) {
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 2 - ((v - min) / span) * (h - 4),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const id = 'sg' + Math.random().toString(36).slice(2, 8);
  const area = fill
    ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stop-color="${color}" stop-opacity=".3"/>
         <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
       </linearGradient></defs>
       <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/>`
    : '';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
    ${area}<path d="${d}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pts.at(-1)[0].toFixed(1)}" cy="${pts.at(-1)[1].toFixed(1)}" r="1.9" fill="${color}"/>
  </svg>`;
}

export function bars(values, { w = 60, h = 22, color = 'var(--gold)', gap = 2 } = {}) {
  const max = Math.max(...values) || 1;
  const bw = (w - gap * (values.length - 1)) / values.length;
  const rects = values.map((v, i) => {
    const bh = Math.max(2, (v / max) * h);
    return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${bw.toFixed(1)}"
      height="${bh.toFixed(1)}" rx="1" fill="${color}" opacity="${(0.42 + 0.58 * (v / max)).toFixed(2)}"/>`;
  }).join('');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects}</svg>`;
}

export function ring(pct, { size = 42, sw = 4, color = 'var(--green)', track = 'rgba(255,255,255,.07)', label } = {}) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamp(pct, 0, 100) / 100);
  return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" style="filter:drop-shadow(0 0 5px ${color})"/>
    </svg>
    ${label !== undefined ? `<span class="ring-val" style="color:${color}">${label}</span>` : ''}
  </div>`;
}

export function donut(segments, { size = 46, sw = 6 } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const arcs = segments.map((s) => {
    const len = (s.value / total) * c;
    const dash = `${Math.max(0, len - 1.6).toFixed(2)} ${(c - len + 1.6).toFixed(2)}`;
    const off = -acc;
    acc += len;
    return `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
      stroke-dasharray="${dash}" stroke-dashoffset="${off.toFixed(2)}" stroke-linecap="round"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  }).join('');
  return `<svg class="spark" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}</svg>`;
}
