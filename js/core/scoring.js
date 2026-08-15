/**
 * PROSPECTIVITY SCORING ENGINE
 * ============================
 * A weighted-overlay model, the standard first-pass technique in mineral
 * exploration targeting. Each criterion produces a normalised 0–100 evidence
 * score per state; the composite is the weighted mean of the enabled criteria.
 *
 *   score(state) = Σ(weightᵢ × evidenceᵢ) / Σ(weightᵢ)
 *
 * Kept free of DOM and fixtures so it can be unit-tested, reused by the map,
 * or replaced by a server-side model without touching the UI. When the Laravel
 * backend runs the real model, `runModel()` is what gets swapped for a fetch.
 */

import { clamp } from './utils.js?v=a404c97';

/**
 * Criterion definitions.
 *
 * `evidence(state)` must return 0–100, where 100 is maximally favourable.
 * `invert: true` marks a criterion where a LOW raw value is favourable, which
 * matters for the explanation text as much as the maths.
 */
export const CRITERIA = [
  {
    id: 'occurrences',
    label: 'Known occurrences',
    hint: 'Density of catalogued mineral occurrences — the strongest single predictor of further discovery.',
    weight: 30,
    accent: 'var(--gold)',
    evidence: (s, ctx) => norm(s.occurrences, ctx.range.occurrences),
  },
  {
    id: 'geology',
    label: 'Host geology',
    hint: 'Favourability of the underlying lithology for the commodity suite recorded in the state.',
    weight: 25,
    accent: 'var(--purple)',
    evidence: (s, ctx) => {
      // Commodity diversity is a proxy for varied, fertile host geology.
      const diversity = norm(s.commodities?.length || 0, ctx.range.commodities);
      const base = norm(s.prospectivity, ctx.range.prospectivity);
      return 0.45 * diversity + 0.55 * base;
    },
  },
  {
    id: 'coverage',
    label: 'Survey coverage',
    hint: 'Geological, geochemical and geophysical survey completeness. High coverage raises confidence, not prospectivity.',
    weight: 15,
    accent: 'var(--cyan)',
    evidence: (s, ctx) => norm(s.coverage, ctx.range.coverage),
  },
  {
    id: 'titles',
    label: 'Industry commitment',
    hint: 'Active mining titles as a proxy for where industry is already spending exploration capital.',
    weight: 15,
    accent: 'var(--green)',
    evidence: (s, ctx) => norm(s.titles, ctx.range.titles),
  },
  {
    id: 'access',
    label: 'Accessibility & risk',
    hint: 'Composite of security advisory level and physical accessibility. Lower risk scores higher.',
    weight: 15,
    accent: 'var(--orange)',
    invert: true,
    evidence: (s) => ({ low: 100, medium: 55, high: 18 })[s.risk] ?? 50,
  },
];

const norm = (v, [lo, hi]) => (hi === lo ? 50 : clamp(((v - lo) / (hi - lo)) * 100, 0, 100));

/** Confidence bands — how much the score can be trusted, driven by survey coverage. */
export const CONFIDENCE = [
  { id: 'high', label: 'High', min: 78, color: 'var(--green)' },
  { id: 'moderate', label: 'Moderate', min: 62, color: 'var(--cyan)' },
  { id: 'low', label: 'Low', min: 0, color: 'var(--orange)' },
];

/** Target tiers by composite score. */
export const TIERS = [
  { id: 't1', label: 'Tier 1', min: 75, color: 'var(--green)', note: 'Drill-ready — advance to detailed targeting.' },
  { id: 't2', label: 'Tier 2', min: 58, color: 'var(--gold)', note: 'Follow-up — infill geochemistry recommended.' },
  { id: 't3', label: 'Tier 3', min: 40, color: 'var(--cyan)', note: 'Reconnaissance — regional survey first.' },
  { id: 't4', label: 'Tier 4', min: 0, color: 'var(--text-faint)', note: 'Low priority under the current model.' },
];

export const tierFor = (score) => TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1];
export const confidenceFor = (coverage) => CONFIDENCE.find((c) => coverage >= c.min) || CONFIDENCE[CONFIDENCE.length - 1];

/** Default enabled/weight map, cloned so callers can mutate freely. */
export function defaultWeights() {
  return CRITERIA.reduce((acc, c) => {
    acc[c.id] = { weight: c.weight, on: true };
    return acc;
  }, {});
}

/** Min/max of every input field, so evidence functions can normalise. */
function buildRanges(states) {
  const pick = (fn) => {
    const vals = states.map(fn).filter((v) => Number.isFinite(v));
    return [Math.min(...vals), Math.max(...vals)];
  };
  return {
    occurrences: pick((s) => s.occurrences),
    prospectivity: pick((s) => s.prospectivity),
    coverage: pick((s) => s.coverage),
    titles: pick((s) => s.titles),
    commodities: pick((s) => s.commodities?.length || 0),
  };
}

/**
 * Run the weighted overlay.
 *
 * @param {Array} states  records with { name, code, ...metrics }
 * @param {Object} weights  { [criterionId]: { weight, on } }
 * @param {Object} [opts]
 * @param {string} [opts.commodity]  restrict to states recording this commodity
 * @returns {{ targets: Array, ranges: Object, activeWeight: number }}
 */
export function runModel(states, weights = defaultWeights(), { commodity = null } = {}) {
  const pool = commodity
    ? states.filter((s) => s.commodities?.includes(commodity))
    : states;

  const ctx = { range: buildRanges(pool.length ? pool : states) };
  const active = CRITERIA.filter((c) => weights[c.id]?.on && weights[c.id]?.weight > 0);
  const totalW = active.reduce((a, c) => a + weights[c.id].weight, 0);

  const targets = pool.map((s) => {
    const contributions = active.map((c) => {
      const ev = clamp(c.evidence(s, ctx), 0, 100);
      const w = weights[c.id].weight;
      return {
        id: c.id,
        label: c.label,
        accent: c.accent,
        evidence: ev,
        weight: w,
        // Share of the final score this criterion is responsible for.
        contribution: totalW ? (ev * w) / totalW : 0,
        share: totalW ? (w / totalW) * 100 : 0,
      };
    });

    const score = contributions.reduce((a, c) => a + c.contribution, 0);
    const conf = confidenceFor(s.coverage);

    return {
      ...s,
      score: Math.round(score * 10) / 10,
      tier: tierFor(score),
      confidence: conf,
      contributions: contributions.sort((a, b) => b.contribution - a.contribution),
      // The single strongest and weakest signals drive the plain-language note.
      driver: contributions[0] || null,
      drag: [...contributions].sort((a, b) => a.evidence - b.evidence)[0] || null,
    };
  }).sort((a, b) => b.score - a.score);

  targets.forEach((t, i) => { t.rank = i + 1; });
  return { targets, ranges: ctx.range, activeWeight: totalW };
}

/** Plain-language rationale for a scored target. */
export function explain(t) {
  if (!t.driver) return 'No criteria are enabled, so the model cannot score this area.';
  const d = t.driver;
  const w = t.drag;
  const lead = `${d.label} is the dominant signal, supplying ${d.contribution.toFixed(1)} of the ${t.score.toFixed(1)} composite.`;
  const tail = w && w.id !== d.id && w.evidence < 45
    ? ` ${w.label} is the weakest input at ${Math.round(w.evidence)}/100 and caps the overall rating.`
    : ' No single criterion materially drags the rating down.';
  return lead + tail;
}
