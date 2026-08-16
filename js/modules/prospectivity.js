/**
 * PROSPECTIVITY MODULE
 * ====================
 * A live weighted-overlay targeting model. The criteria editor on the left
 * drives an immediate re-score of all 37 states; the ranked target list and
 * the selected target's evidence breakdown sit on the right.
 *
 * The maths lives in core/scoring.js so it stays testable and swappable. This
 * file is presentation and interaction only.
 */

import { $, $$, fmt, debounce, clamp } from '../core/utils.js?v=11d9f5e';
import { icon } from '../core/icons.js?v=11d9f5e';
import { api } from '../data/api.js?v=11d9f5e';
import { ctx } from '../core/context.js?v=11d9f5e';
import { reports } from '../core/reports.js?v=11d9f5e';
import { toast } from './dashboard.js?v=11d9f5e';
import { RESOURCE_META } from '../data/fixtures.js?v=11d9f5e';
import {
  CRITERIA, TIERS, runModel, defaultWeights, explain,
} from '../core/scoring.js?v=11d9f5e';

const WEIGHTS_KEY = 'nmi.prosWeights';
const COMMODITY_OPTS = [
  { id: '', label: 'All commodities' },
  { id: 'gold', label: 'Gold' },
  { id: 'lithium', label: 'Lithium' },
  { id: 'tin', label: 'Tin / Columbite' },
  { id: 'lead', label: 'Lead / Zinc' },
  { id: 'iron', label: 'Iron Ore' },
  { id: 'barite', label: 'Barite' },
  { id: 'limestone', label: 'Limestone' },
  { id: 'coal', label: 'Coal' },
];

export function createProspectivity() {
  let root;
  let states = [];
  let weights = loadWeights();
  let commodity = '';
  let selectedName = null;
  let result = { targets: [], activeWeight: 0 };
  let lgas = [];

  function loadWeights() {
    try {
      const saved = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || 'null');
      if (!saved) return defaultWeights();
      // Merge onto defaults so a newly added criterion is never missing.
      const base = defaultWeights();
      Object.keys(base).forEach((k) => { if (saved[k]) base[k] = { ...base[k], ...saved[k] }; });
      return base;
    } catch { return defaultWeights(); }
  }

  const saveWeights = debounce(() => {
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
  }, 250);

  const isDefault = () => {
    const d = defaultWeights();
    return Object.keys(d).every((k) => d[k].weight === weights[k].weight && weights[k].on);
  };

  /* ------------------------------------------------------------------ *
   * Templates
   * ------------------------------------------------------------------ */

  const kpi = (label, value, sub, accent) => `
    <div class="pr-kpi">
      <div class="pr-kpi-l">${label}</div>
      <div class="pr-kpi-v" style="color:${accent}">${value}</div>
      <div class="pr-kpi-s">${sub}</div>
    </div>`;

  function criterionRow(c) {
    const w = weights[c.id];
    const share = result.activeWeight && w.on
      ? Math.round((w.weight / result.activeWeight) * 100) : 0;
    return `
      <div class="pr-crit ${w.on ? '' : 'is-off'}" data-crit="${c.id}" style="--ac:${c.accent}">
        <div class="pr-crit-hd">
          <button class="pr-crit-tog" data-crit-toggle="${c.id}" role="switch"
                  aria-checked="${w.on}" title="${w.on ? 'Disable' : 'Enable'} ${c.label}">
            <span class="pr-tog-k"></span>
          </button>
          <div class="pr-crit-t">
            <div class="pr-crit-n">${c.label}${c.invert ? '<em title="Lower raw values score higher">inverted</em>' : ''}</div>
            <div class="pr-crit-h">${c.hint}</div>
          </div>
          <div class="pr-crit-w">
            <span class="t-mono" data-w-val="${c.id}">${w.weight}</span>
            <em>${share}%</em>
          </div>
        </div>
        <input type="range" class="pr-range" min="0" max="60" step="5"
               value="${w.weight}" data-crit-weight="${c.id}"
               aria-label="${c.label} weight" ${w.on ? '' : 'disabled'} />
      </div>`;
  }

  function targetRow(t) {
    const on = t.name === selectedName;
    return `
      <button class="pr-t ${on ? 'is-on' : ''}" data-target="${t.name}"
              aria-pressed="${on}" style="--tc:${t.tier.color}">
        <span class="pr-t-r t-mono">${t.rank}</span>
        <span class="pr-t-n">
          <span class="pr-t-nm">${t.name}</span>
          <span class="pr-t-sub">${t.code} · ${t.region}</span>
        </span>
        <span class="pr-t-bar"><span style="width:${t.score}%"></span></span>
        <span class="pr-t-s t-mono">${t.score.toFixed(1)}</span>
        <span class="pr-tier" style="color:${t.tier.color}">${t.tier.label}</span>
      </button>`;
  }

  function evidenceBar(c) {
    return `
      <div class="pr-ev" style="--ac:${c.accent}">
        <div class="pr-ev-hd">
          <span class="pr-ev-n">${c.label}</span>
          <span class="pr-ev-w t-mono">w ${c.weight}</span>
          <span class="pr-ev-v t-mono">${Math.round(c.evidence)}</span>
        </div>
        <div class="pr-ev-track">
          <span class="pr-ev-fill" style="width:${c.evidence}%"></span>
          <span class="pr-ev-mark" style="left:${c.share}%" title="${c.share.toFixed(0)}% of model weight"></span>
        </div>
        <div class="pr-ev-ft">contributes ${c.contribution.toFixed(1)} pts</div>
      </div>`;
  }

  function dossier(t) {
    const near = result.targets
      .filter((x) => x.name !== t.name && x.region === t.region)
      .slice(0, 4);

    return `
      <header class="pr-dh" style="--tc:${t.tier.color}">
        <div class="pr-dh-t">
          <span class="pr-dh-rank t-mono">#${t.rank}</span>
          <div>
            <div class="pr-dh-tier">${t.tier.label} · ${t.region}</div>
            <h2>${t.name}</h2>
          </div>
        </div>
        <div class="pr-dh-k">
          ${kpi('Composite', t.score.toFixed(1), t.tier.note, t.tier.color)}
          ${kpi('Confidence', t.confidence.label, `${t.coverage}% survey coverage`, t.confidence.color)}
          ${kpi('Occurrences', fmt.int(t.occurrences), `${t.titles} active titles`, 'var(--gold)')}
        </div>
      </header>

      <div class="pr-dgrid">
        <section class="panel pr-p pr-p-wide">
          <header class="panel-hd">
            <span class="accent-bar accent-purple"></span><h3>Evidence Breakdown</h3>
            <span class="spacer"></span>
            <span class="panel-x">${t.contributions.length} criteria</span>
          </header>
          <div class="panel-bd">
            <p class="pr-why">${explain(t)}</p>
            <div class="pr-evs">${t.contributions.map(evidenceBar).join('')}</div>
          </div>
        </section>

        <section class="panel pr-p">
          <header class="panel-hd">
            <span class="accent-bar accent-gold"></span><h3>Target Profile</h3>
          </header>
          <div class="panel-bd">
            <div class="pr-facts">
              ${fact('Commodities recorded', (t.commodities || []).length
                ? t.commodities.map((c) => `<span class="pr-tag">${c}</span>`).join('') : '—')}
              ${fact('Risk level', `<span class="pr-risk pr-risk-${t.risk}">${t.risk}</span>`)}
              ${fact('Survey coverage', `<span class="t-mono">${t.coverage}%</span>`)}
              ${fact('Active titles', `<span class="t-mono">${fmt.int(t.titles)}</span>`)}
              ${fact('Petroleum acreage', t.petroleum ? 'Yes' : 'No')}
              ${fact('Centroid', `<span class="t-mono">${fmt.coord(t.centroid[0], t.centroid[1])}</span>`)}
            </div>
            ${lgas.length ? `
              <label class="pr-sel pr-lga">
                <span>LGA</span>
                <select id="pr-lga">
                  <option value="">All LGAs in ${t.name}</option>
                  ${lgas.map((l) => `<option value="${l.name}"${l.name === ctx.get().lga ? ' selected' : ''}>${l.name}</option>`).join('')}
                </select>
              </label>` : ''}
            <div class="ctx-acts">
              <button class="btn-ghost btn-primary" data-go="explore">${icon('map', { size: 13 })} View on map</button>
              <button class="btn-ghost" data-go="risk">${icon('risk', { size: 13 })} Risk</button>
              ${commodity ? `<button class="btn-ghost" data-go="minerals">${icon('minerals', { size: 13 })} Mineral</button>` : ''}
              <button class="btn-ghost" data-report-item>${icon('reports', { size: 13 })} Generate report</button>
            </div>
          </div>
        </section>

        <section class="panel pr-p">
          <header class="panel-hd">
            <span class="accent-bar accent-cyan"></span><h3>Regional Peers</h3>
            <span class="spacer"></span><span class="panel-x">${t.region}</span>
          </header>
          <div class="panel-bd">
            ${near.length ? `<div class="pr-peers">
              ${near.map((n) => `
                <button class="pr-peer" data-target="${n.name}">
                  <span class="pr-peer-r t-mono">#${n.rank}</span>
                  <span class="pr-peer-n">${n.name}</span>
                  <span class="pr-peer-b"><span style="width:${n.score}%;background:${n.tier.color}"></span></span>
                  <span class="pr-peer-s t-mono">${n.score.toFixed(1)}</span>
                </button>`).join('')}
            </div>` : '<p class="pr-none">No other states scored in this region.</p>'}
          </div>
        </section>
      </div>`;
  }

  const fact = (l, v) => `
    <div class="pr-fact"><span class="pr-fact-l">${l}</span><span class="pr-fact-v">${v}</span></div>`;

  function emptyDossier() {
    return `
      <div class="pr-empty">
        <div class="pr-empty-g">${icon('prospectivity', { size: 30, sw: 1.3 })}</div>
        <p class="pr-empty-t">Select a target</p>
        <p class="pr-empty-s">Its evidence breakdown, profile and regional peers appear here.</p>
      </div>`;
  }

  function distribution() {
    const counts = TIERS.map((t) => ({
      ...t,
      n: result.targets.filter((x) => x.tier.id === t.id).length,
    }));
    const total = result.targets.length || 1;
    return `
      <div class="pr-dist" role="img" aria-label="Target tier distribution">
        ${counts.map((c) => `
          <span class="pr-dist-seg" style="width:${(c.n / total) * 100}%;background:${c.color}"
                title="${c.label}: ${c.n} states"></span>`).join('')}
      </div>
      <div class="pr-dist-key">
        ${counts.map((c) => `
          <span class="pr-dk"><i style="background:${c.color}"></i>${c.label}<b>${c.n}</b></span>`).join('')}
      </div>`;
  }

  function shell() {
    return `
      <div class="pr-wrap">
        <header class="pr-head">
          <div class="pr-head-t">
            <h1>Prospectivity</h1>
            <p>Weighted-overlay targeting across all 37 states. Adjust criteria
            weights and the model re-scores immediately.</p>
          </div>
          <div class="pr-head-k" id="pr-head-k"></div>
        </header>

        <div class="ctx-bar" id="pr-ctx" hidden></div>

        <div class="pr-body">
          <aside class="pr-dock">
            <div class="pr-dock-hd">
              <h3>Model Criteria</h3>
              <button class="pr-reset" id="pr-reset" title="Restore default weights">
                ${icon('refresh', { size: 12 })}<span>Reset</span>
              </button>
            </div>
            <div class="pr-scope">
              <label class="pr-sel">
                <span>Commodity</span>
                <select id="pr-commodity">
                  ${COMMODITY_OPTS.map((o) => `
                    <option value="${o.id}"${o.id === commodity ? ' selected' : ''}>${o.label}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="pr-crits" id="pr-crits"></div>
            <div class="pr-dock-ft">
              <div class="pr-wsum">
                <span>Total weight</span>
                <b class="t-mono" id="pr-wsum">0</b>
              </div>
              <p class="pr-note">Weights are relative — the composite is the
              weighted mean of enabled criteria, so only their proportions matter.</p>
            </div>
          </aside>

          <section class="pr-main">
            <div class="panel pr-rank">
              <header class="panel-hd">
                <span class="accent-bar"></span><h3>Ranked Targets</h3>
                <span class="spacer"></span>
                <span class="panel-x" id="pr-count">0</span>
              </header>
              <div class="pr-dist-wrap" id="pr-dist"></div>
              <div class="pr-tlist" id="pr-tlist"></div>
            </div>
            <div class="pr-detail" id="pr-detail"></div>
          </section>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function score() {
    result = runModel(states, weights, { commodity: commodity || null });
    // Keep a valid selection when the pool changes under a commodity filter.
    if (selectedName && !result.targets.some((t) => t.name === selectedName)) selectedName = null;
    if (!selectedName && result.targets.length) selectedName = result.targets[0].name;
  }

  function renderCriteria() {
    const host = $('#pr-crits', root);
    if (host) host.innerHTML = CRITERIA.map(criterionRow).join('');
    const sum = $('#pr-wsum', root);
    if (sum) sum.textContent = result.activeWeight;
    const reset = $('#pr-reset', root);
    if (reset) reset.hidden = isDefault();
  }

  /** Weight labels change on every drag — update in place, never re-render. */
  function syncWeightLabels() {
    CRITERIA.forEach((c) => {
      const w = weights[c.id];
      const val = $(`[data-w-val="${c.id}"]`, root);
      const pct = val?.nextElementSibling;
      if (val) val.textContent = w.weight;
      if (pct) pct.textContent = `${result.activeWeight && w.on ? Math.round((w.weight / result.activeWeight) * 100) : 0}%`;
    });
    const sum = $('#pr-wsum', root);
    if (sum) sum.textContent = result.activeWeight;
    const reset = $('#pr-reset', root);
    if (reset) reset.hidden = isDefault();
  }

  function renderTargets() {
    const host = $('#pr-tlist', root);
    if (!host) return;
    if (!result.targets.length) {
      host.innerHTML = `<p class="pr-none pr-none-pad">No state records the selected commodity.</p>`;
    } else if (!result.activeWeight) {
      host.innerHTML = `<p class="pr-none pr-none-pad">Every criterion is disabled — enable at least one to score targets.</p>`;
    } else {
      host.innerHTML = result.targets.map(targetRow).join('');
    }
    const n = $('#pr-count', root);
    if (n) n.textContent = `${result.targets.length} states`;
    const d = $('#pr-dist', root);
    if (d) d.innerHTML = result.targets.length ? distribution() : '';
  }

  function renderHead() {
    const host = $('#pr-head-k', root);
    if (!host) return;
    const t1 = result.targets.filter((t) => t.tier.id === 't1').length;
    const hiConf = result.targets.filter((t) => t.confidence.id === 'high').length;
    const lead = result.targets[0];
    host.innerHTML = `
      ${kpi('Tier 1 targets', t1, 'drill-ready', 'var(--green)')}
      ${kpi('Leading target', lead ? lead.name : '—', lead ? `${lead.score.toFixed(1)} composite` : 'no data', 'var(--gold)')}
      ${kpi('High confidence', hiConf, `of ${result.targets.length} scored`, 'var(--cyan)')}`;
  }

  async function pickTarget(name, { keepLga = false } = {}) {
    selectedName = name;
    const rec = states.find((x) => x.name === name);
    if (!keepLga) ctx.set({ state: name, lga: null });
    lgas = rec ? await api.getLgas(rec.code) : [];
    renderTargets();
    renderDetail();
    renderCtxBar();
    $('#pr-detail', root)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function renderCtxBar() {
    const bar = $('#pr-ctx', root);
    if (!bar) return;
    const c = ctx.get();
    if (!c.commodity && !c.state) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = `
      <span class="ctx-l">${icon('target', { size: 12 })} Context</span>
      <span class="ctx-trail">${ctx.label(RESOURCE_META) || 'National'}</span>
      <button class="ctx-clear" data-ctx-clear title="Clear context">${icon('plus', { size: 12 })}</button>`;
  }

  /** Adopt context handed over by another module. */
  async function adopt() {
    const c = ctx.get();
    if (c.commodity && c.commodity !== commodity) {
      commodity = c.commodity;
      const sel = $('#pr-commodity', root);
      if (sel) sel.value = commodity;
      refresh({ criteria: true });
    }
    if (c.state && c.state !== selectedName) await pickTarget(c.state, { keepLga: !!c.lga });
    if (c.lga) { const l = $('#pr-lga', root); if (l) l.value = c.lga; }
    renderCtxBar();
  }

  function renderDetail() {
    const host = $('#pr-detail', root);
    if (!host) return;
    // With no criteria enabled every score is 0, so a dossier would show a
    // meaningless rank and tier. Explain the state instead.
    if (!result.activeWeight) {
      host.innerHTML = `
        <div class="pr-empty">
          <div class="pr-empty-g">${icon('sliders', { size: 30, sw: 1.3 })}</div>
          <p class="pr-empty-t">No criteria enabled</p>
          <p class="pr-empty-s">The weighted overlay needs at least one active
          criterion. Enable one on the left, or reset to the default model.</p>
        </div>`;
      return;
    }
    const t = result.targets.find((x) => x.name === selectedName);
    host.innerHTML = t ? dossier(t) : emptyDossier();
  }

  /** Full recompute + repaint. Used on weight, toggle and scope changes. */
  function refresh({ criteria = false } = {}) {
    score();
    renderTargets();
    renderHead();
    renderDetail();
    if (criteria) renderCriteria(); else syncWeightLabels();
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function wire() {
    root.addEventListener('click', (e) => {
      const tog = e.target.closest('[data-crit-toggle]');
      if (tog) {
        const id = tog.dataset.critToggle;
        weights[id].on = !weights[id].on;
        saveWeights();
        refresh({ criteria: true });
        return;
      }

      const pick = e.target.closest('[data-target]');
      if (pick) { pickTarget(pick.dataset.target); return; }

      if (e.target.closest('#pr-reset')) {
        weights = defaultWeights();
        saveWeights();
        refresh({ criteria: true });
        return;
      }

      if (e.target.closest('[data-ctx-clear]')) { ctx.clear(); commodity = ''; renderCtxBar(); refresh({ criteria: true }); return; }

      if (e.target.closest('[data-report-item]')) {
        const ok = reports.add({
          kind: 'prospectivity', id: selectedName,
          commodity: commodity || null,
          title: `Prospectivity — ${selectedName}`,
        });
        toast(ok ? `Added ${selectedName} prospectivity to the report`
                 : `${selectedName} prospectivity is already in the report`);
        return;
      }

      const go = e.target.closest('[data-go]')?.dataset.go;
      if (go) {
        ctx.set({
          commodity: commodity || ctx.get().commodity,
          state: selectedName,
          layer: go === 'explore' ? 'prospectivity' : null,
        });
        ctx.go(go);
      }
    });

    // Live re-score while dragging a weight slider.
    root.addEventListener('input', (e) => {
      const sl = e.target.closest('[data-crit-weight]');
      if (sl) {
        weights[sl.dataset.critWeight].weight = clamp(+sl.value, 0, 60);
        saveWeights();
        refresh();
      }
    });

    root.addEventListener('change', (e) => {
      if (e.target.id === 'pr-commodity') {
        commodity = e.target.value;
        ctx.set({ commodity: commodity || null });
        renderCtxBar();
        refresh({ criteria: true });
      }
      if (e.target.id === 'pr-lga') {
        ctx.set({ lga: e.target.value || null });
        renderCtxBar();
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Module contract
   * ------------------------------------------------------------------ */

  return {
    async mount(view) {
      root = view;
      view.innerHTML = `<div class="pr-loading">${icon('refresh', { size: 18 })}<span>Running prospectivity model…</span></div>`;

      states = await api.getProspectivityInputs();
      score();

      view.innerHTML = shell();
      wire();
      renderCriteria();
      renderTargets();
      renderHead();
      renderCtxBar();
      renderDetail();
      await adopt();
    },
    onShow() { adopt(); },
  };
}
