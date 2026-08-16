/**
 * RISK SCORING ENGINE
 * ===================
 * Composite exploration risk per state, built the same way as the
 * prospectivity model so the two read as one analytical system: normalised
 * 0–100 factors combined by weight, where 100 means highest risk.
 *
 * Kept free of DOM and fixtures so it stays testable and can be replaced by a
 * server-side model without touching the UI.
 */

import { clamp, seeded } from './utils.js?v=0521807';

const LEVEL_BASE = { low: 18, medium: 52, high: 84 };

/**
 * Risk factors. `evidence(state)` returns 0–100 where HIGH means MORE risk.
 * Each carries the mitigation note the dossier shows, so adding a factor is a
 * single entry here.
 */
export const RISK_FACTORS = [
  {
    id: 'security',
    label: 'Security',
    accent: 'var(--red)',
    weight: 32,
    hint: 'Advisory level, incident history and escort requirements for field crews.',
    mitigation: 'Engage state security liaison; budget for escorted access and convoy movement.',
    evidence: (s) => LEVEL_BASE[s.risk] ?? 50,
  },
  {
    id: 'access',
    label: 'Accessibility',
    accent: 'var(--orange)',
    weight: 22,
    hint: 'Road quality, seasonal passability and distance to a serviceable airstrip or rail head.',
    mitigation: 'Plan mobilisation in the dry season; pre-position fuel and drilling consumables.',
    evidence: (s, r) => clamp(LEVEL_BASE[s.risk] * 0.55 + (100 - s.coverage) * 0.5 + r() * 14, 0, 100),
  },
  {
    id: 'environment',
    label: 'Environmental',
    accent: 'var(--green)',
    weight: 18,
    hint: 'Protected areas, forest reserve overlap, watercourse proximity and rehabilitation load.',
    mitigation: 'Commission an ESIA early; screen tenements against the protected-area register.',
    evidence: (s, r) => clamp(28 + (s.petroleum ? 20 : 0) + r() * 44, 0, 100),
  },
  {
    id: 'community',
    label: 'Community & land',
    accent: 'var(--gold)',
    weight: 16,
    hint: 'Artisanal mining presence, land-tenure disputes and host-community agreements.',
    mitigation: 'Formalise a community development agreement before ground disturbance.',
    evidence: (s, r) => clamp((s.occurrences / 224) * 58 + LEVEL_BASE[s.risk] * 0.3 + r() * 16, 0, 100),
  },
  {
    id: 'tenure',
    label: 'Tenure & regulatory',
    accent: 'var(--purple)',
    weight: 12,
    hint: 'Cadastre congestion, overlapping applications and licence renewal exposure.',
    mitigation: 'Run a cadastre overlap search and diarise renewal dates before acquisition.',
    evidence: (s, r) => clamp((s.titles / 312) * 72 + r() * 22, 0, 100),
  },
];

export const RISK_BANDS = [
  { id: 'severe', label: 'Severe', min: 72, color: 'var(--red)', note: 'Operations require a dedicated security and access plan.' },
  { id: 'high', label: 'High', min: 56, color: 'var(--orange)', note: 'Material constraints — mitigate before committing field spend.' },
  { id: 'moderate', label: 'Moderate', min: 38, color: 'var(--gold)', note: 'Manageable with standard controls and local engagement.' },
  { id: 'low', label: 'Low', min: 0, color: 'var(--green)', note: 'Few structural constraints on exploration activity.' },
];

export const bandFor = (score) => RISK_BANDS.find((b) => score >= b.min) || RISK_BANDS[RISK_BANDS.length - 1];

export function defaultRiskWeights() {
  return RISK_FACTORS.reduce((a, f) => { a[f.id] = { weight: f.weight, on: true }; return a; }, {});
}

/**
 * Score every state.
 * @returns {{ rows: Array, activeWeight: number }}
 */
export function runRisk(states, weights = defaultRiskWeights()) {
  const active = RISK_FACTORS.filter((f) => weights[f.id]?.on && weights[f.id]?.weight > 0);
  const totalW = active.reduce((a, f) => a + weights[f.id].weight, 0);

  const rows = states.map((s) => {
    const r = seeded(s.name + 'risk');
    const factors = active.map((f) => {
      const ev = clamp(f.evidence(s, r), 0, 100);
      const w = weights[f.id].weight;
      return {
        id: f.id, label: f.label, accent: f.accent, hint: f.hint,
        mitigation: f.mitigation,
        evidence: Math.round(ev), weight: w,
        contribution: totalW ? (ev * w) / totalW : 0,
        share: totalW ? (w / totalW) * 100 : 0,
      };
    });
    const score = factors.reduce((a, f) => a + f.contribution, 0);
    const sorted = [...factors].sort((a, b) => b.evidence - a.evidence);

    return {
      ...s,
      score: Math.round(score * 10) / 10,
      band: bandFor(score),
      factors,
      driver: sorted[0] || null,
      lowest: sorted[sorted.length - 1] || null,
    };
  }).sort((a, b) => b.score - a.score);

  rows.forEach((x, i) => { x.rank = i + 1; });
  return { rows, activeWeight: totalW };
}

/** Plain-language rationale for a scored location. */
export function explainRisk(x) {
  if (!x.driver) return 'No factors are enabled, so the model cannot score this location.';
  return `${x.driver.label} is the leading constraint at ${x.driver.evidence}/100, `
    + `contributing ${x.driver.contribution.toFixed(1)} of the ${x.score.toFixed(1)} composite. `
    + `${x.lowest.label} is the least constrained at ${x.lowest.evidence}/100.`;
}
