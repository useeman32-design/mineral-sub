/**
 * Icon registry — inline SVG (no external icon font/CDN).
 * Usage: icon('minerals', { size: 17, cls: 'ico' })
 */

const PATHS = {
  overview: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  map: '<path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z"/><path d="M9 3v15M15 6v15"/>',
  minerals: '<path d="M12 2.5 4.5 8l2.8 11h9.4L19.5 8 12 2.5Z"/><path d="m4.5 8 7.5 3 7.5-3M12 11v8"/>',
  prospectivity: '<path d="M12 2.6 14.2 8l5.8.5-4.4 3.8 1.3 5.7L12 15l-4.9 3 1.3-5.7L4 8.5 9.8 8 12 2.6Z"/>',
  risk: '<path d="M12 2.8 3.6 7v6c0 4.6 3.5 7.6 8.4 9.2 4.9-1.6 8.4-4.6 8.4-9.2V7L12 2.8Z"/><path d="M12 8.6v4.2M12 16.2h.01"/>',
  oil: '<path d="M12 2.8s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.1 12 2.8 12 2.8Z"/><path d="M9.4 13.6a2.7 2.7 0 0 0 2.6 3.1"/>',
  titles: '<rect x="3.2" y="5" width="17.6" height="15" rx="2"/><path d="M3.2 9.4h17.6M8 5V2.6M16 5V2.6M8 13.5h4"/>',
  reports: '<path d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8l-5-5Z"/><path d="M14 2.8v5h5M8.6 13h6.8M8.6 16.6h4.6"/>',
  data: '<ellipse cx="12" cy="5.6" rx="7.8" ry="3"/><path d="M4.2 5.6v12.8c0 1.7 3.5 3 7.8 3s7.8-1.3 7.8-3V5.6"/><path d="M4.2 12c0 1.7 3.5 3 7.8 3s7.8-1.3 7.8-3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m20 20-4.4-4.4"/>',
  bell: '<path d="M18 8.6a6 6 0 1 0-12 0c0 6.4-2.4 8.2-2.4 8.2h16.8S18 15 18 8.6Z"/><path d="M13.7 20.4a2 2 0 0 1-3.4 0"/>',
  pin: '<path d="M20 10.4c0 6.4-8 12.2-8 12.2s-8-5.8-8-12.2a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10.4" r="2.8"/>',
  layers: '<path d="m12 2.6 9.4 5-9.4 5-9.4-5 9.4-5Z"/><path d="m2.6 16.6 9.4 5 9.4-5M2.6 11.8l9.4 5 9.4-5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  satellite: '<path d="m10 5.5 3.5-3.5 4 4L14 9.5 10 5.5Z"/><path d="m6.5 9 4 4-4 4-4-4 4-4Z"/><path d="M13.6 9.9 9.9 13.6"/><path d="M16 15.5a5 5 0 0 1-5 5M20.5 16a9.5 9.5 0 0 1-9.5 9.5" transform="translate(0 -3)"/>',
  crosshair: '<circle cx="12" cy="12" r="8.2"/><path d="M12 1.8v4.4M12 17.8v4.4M22.2 12h-4.4M6.2 12H1.8"/>',
  ruler: '<path d="m15.6 2.6 5.8 5.8a1.4 1.4 0 0 1 0 2L10.4 21.4a1.4 1.4 0 0 1-2 0L2.6 15.6a1.4 1.4 0 0 1 0-2L13.6 2.6a1.4 1.4 0 0 1 2 0Z"/><path d="m6.4 11.8 2 2M9.6 8.6l2 2M12.8 5.4l2 2"/>',
  fullscreen: '<path d="M3.4 8.4V4.8a1.4 1.4 0 0 1 1.4-1.4h3.6M15.6 3.4h3.6a1.4 1.4 0 0 1 1.4 1.4v3.6M20.6 15.6v3.6a1.4 1.4 0 0 1-1.4 1.4h-3.6M8.4 20.6H4.8a1.4 1.4 0 0 1-1.4-1.4v-3.6"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  chevron: '<path d="m6 9.5 6 6 6-6"/>',
  chevronR: '<path d="m9.5 6 6 6-6 6"/>',
  chevronL: '<path d="m14.5 6-6 6 6 6"/>',
  filter: '<path d="M21 4H3l7.2 8.5v6.1l3.6 1.8v-7.9L21 4Z"/>',
  activity: '<path d="M21.5 12h-4l-3 8.5-6-17L5.5 12h-4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  grid: '<rect x="3.4" y="3.4" width="7" height="7" rx="1.2"/><rect x="13.6" y="3.4" width="7" height="7" rx="1.2"/><rect x="3.4" y="13.6" width="7" height="7" rx="1.2"/><rect x="13.6" y="13.6" width="7" height="7" rx="1.2"/>',
  refresh: '<path d="M21 11.5A9 9 0 0 0 6.2 5.8L3 8.8"/><path d="M3 4v4.8h4.8"/><path d="M3 12.5A9 9 0 0 0 17.8 18.2L21 15.2"/><path d="M21 20v-4.8h-4.8"/>',
  print: '<path d="M6.5 9.2V3.2h11v6M6.5 17.5h-2a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6.5" y="14" width="11" height="6.8" rx="1"/>',
  download: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 17.5v1.8a1.7 1.7 0 0 0 1.7 1.7h12.6a1.7 1.7 0 0 0 1.7-1.7v-1.8"/>',
  info: '<circle cx="12" cy="12" r="9.2"/><path d="M12 16.5v-5M12 7.8h.01"/>',
  eye: '<path d="M1.8 12S5.6 4.8 12 4.8 22.2 12 22.2 12 18.4 19.2 12 19.2 1.8 12 1.8 12Z"/><circle cx="12" cy="12" r="3.2"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1.5 14h5M9.5 8h5M17.5 16h5"/>',
  panelLeft: '<rect x="3" y="3.5" width="18" height="17" rx="2"/><path d="M9.5 3.5v17"/>',
  undo: '<path d="M3 8.5h11.5a5.5 5.5 0 0 1 0 11H8"/><path d="M6.5 4 3 8.5 6.5 13"/>',
  redo: '<path d="M21 8.5H9.5a5.5 5.5 0 0 0 0 11H16"/><path d="M17.5 4 21 8.5 17.5 13"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  move: '<path d="M12 2v20M2 12h20"/><path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
  moon: '<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 1.8v2.6M12 19.6v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M1.8 12h2.6M19.6 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/>',
  logout: '<path d="M9 21H5.4A1.4 1.4 0 0 1 4 19.6V4.4A1.4 1.4 0 0 1 5.4 3H9M16 17l5-5-5-5M21 12H9"/>',
};

export function icon(name, { size = 18, cls = '', sw = 1.6, fill = 'none' } = {}) {
  const d = PATHS[name] || PATHS.info;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"
    stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${d}</svg>`;
}

/** Brand mark — geometric hex node lattice */
export function brandMark(size = 30) {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#4dffa6"/>
        <stop offset="55%" stop-color="#00e676"/>
        <stop offset="100%" stop-color="#2dd8c3"/>
      </linearGradient>
    </defs>
    <path d="M20 2.6 35.2 11v18L20 37.4 4.8 29V11L20 2.6Z" stroke="url(#bm-g)" stroke-width="1.7" opacity=".95"/>
    <path d="M20 9.4 29.4 15v10L20 30.6 10.6 25V15L20 9.4Z" stroke="#2dd8c3" stroke-width="1.1" opacity=".5"/>
    <path d="M20 2.6v6.8M35.2 11l-5.8 4M35.2 29l-5.8-4M20 37.4v-6.8M4.8 29l5.8-4M4.8 11l5.8 4" stroke="#00e676" stroke-width="1.1" opacity=".55"/>
    <circle cx="20" cy="20" r="3.4" fill="#00e676" opacity=".9"/>
    <circle cx="20" cy="20" r="6.4" stroke="#00e676" stroke-width=".9" opacity=".35"/>
  </svg>`;
}
