/**
 * STATE NAME NORMALISER
 * =====================
 * Government spreadsheets spell state names inconsistently. Every join between
 * a source dataset and our geoBoundaries polygons goes through here, or the
 * mismatch silently produces orphan records.
 *
 * Observed in the MCO cadastre (10,125 titles):
 *   'FCT'          -> Federal Capital Territory
 *   'Kaduna North' -> Kaduna   (a zonal office, not a state)
 *   'ABIA'         -> Abia     (case)
 *
 * Node, built-ins only. Also used by the browser via data/reference/*.json,
 * which is pre-normalised at build time.
 */

const ALIASES = {
  fct: 'Federal Capital Territory',
  'fct abuja': 'Federal Capital Territory',
  'f c t': 'Federal Capital Territory',
  abuja: 'Federal Capital Territory',
  'federal capital territory': 'Federal Capital Territory',
  // MCO zonal-office labels that are not states
  'kaduna north': 'Kaduna',
  'kaduna south': 'Kaduna',
  // common spelling variants
  nassarawa: 'Nasarawa',
  'cross-river': 'Cross River',
  'akwa-ibom': 'Akwa Ibom',
  'akwaibom': 'Akwa Ibom',
};

/** Title-case each word, preserving internal hyphens. */
function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * @param {string} raw a state name from any source
 * @returns {string|null} canonical geoBoundaries name, or null when unmappable
 */
export function normaliseState(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key || key === 'none') return null;
  if (ALIASES[key]) return ALIASES[key];
  return titleCase(key);
}

/** Split a multi-state cell ("ABIA, EBONYI") into canonical names. */
export function splitStates(raw) {
  if (!raw) return [];
  return [...new Set(
    String(raw).split(',').map((s) => normaliseState(s)).filter(Boolean),
  )];
}

export default { normaliseState, splitStates };
