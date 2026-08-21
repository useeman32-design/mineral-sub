/**
 * RISK INTELLIGENCE MODULE
 * ========================
 * Composite exploration risk per state, with the factor breakdown that
 * explains the rating and the mitigations each factor implies.
 *
 * Shares its shape with Prospectivity on purpose: same dock-and-dossier
 * rhythm, same evidence bars, so the two read as one analytical system.
 * Context (commodity / state / LGA) arrives from any other module through
 * core/context.js and is carried onward by the action buttons.
 */

import { $, $$, fmt, clamp } from '../core/utils.js?v=3c8d53f';
import { icon } from '../core/icons.js?v=3c8d53f';
import { api } from '../data/api.js?v=3c8d53f';
import { ctx } from '../core/context.js?v=3c8d53f';
import { reports } from '../core/reports.js?v=3c8d53f';
import { toast } from './dashboard.js?v=3c8d53f';
import { RESOURCE_META } from '../data/fixtures.js?v=3c8d53f';
import {
  RISK_FACTORS, RISK_BANDS, runRisk, defaultRiskWeights, explainRisk,
} from '../core/risk.js?v=3c8d53f';

const WEIGHTS_KEY = 'nmi.riskWeights';

export function createRisk() {
  let root;
  let states = [];
  let weights = load();
  let selectedName = null;
  let result = { rows: [], activeWeight: 0 };
  let lgas = [];

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || 'null');
      if (!saved) return defaultRiskWeights();
      const base = defaultRiskWeights();
      Object.keys(base).forEach((k) => { if (saved[k]) base[k] = { ...base[k], ...saved[k] }; });
      return base;
    } catch { return defaultRiskWeights(); }
  }
  const save = () => localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
  const isDefault = () => {
    const d = defaultRiskWeights();
    return Object.keys(d).every((k) => d[k].weight === weights[k].weight && weights[k].on);
  };

  /* ---------------------------------------------------------------- */

  const kpi = (label, value, sub, accent) => `
    <div class="pr-kpi">
      <div class="pr-kpi-l">${label}</div>
      <div class="pr-kpi-v" style="color:${accent}">${value}</div>
      <div class="pr-kpi-s">${sub}</div>
    </div>`;

  function factorRow(f) {
    const w = weights[f.id];
    const share = result.activeWeight && w.on ? Math.round((w.weight / result.activeWeight) * 100) : 0;
    return `
      <div class="pr-crit ${w.on ? '' : 'is-off'}" style="--ac:${f.accent}">
        <div class="pr-crit-hd">
          <button class="pr-crit-tog" data-rf-toggle="${f.id}" role="switch"
                  aria-checked="${w.on}" title="${w.on ? 'Disable' : 'Enable'} ${f.label}">
            <span class="pr-tog-k"></span>
          </button>
          <div class="pr-crit-t">
            <div class="pr-crit-n">${f.label}</div>
            <div class="pr-crit-h">${f.hint}</div>
          </div>
          <div class="pr-crit-w">
            <span class="t-mono" data-rw-val="${f.id}">${w.weight}</span>
            <em>${share}%</em>
          </div>
        </div>
        <input type="range" class="pr-range" min="0" max="60" step="4"
               value="${w.weight}" data-rf-weight="${f.id}"
               aria-label="${f.label} weight" ${w.on ? '' : 'disabled'} />
      </div>`;
  }

  const row = (x) => {
    const on = x.name === selectedName;
    return `
      <button class="pr-t ${on ? 'is-on' : ''}" data-risk-row="${x.name}"
              aria-pressed="${on}" style="--tc:${x.band.color}">
        <span class="pr-t-r t-mono">${x.rank}</span>
        <span class="pr-t-n">
          <span class="pr-t-nm">${x.name}</span>
          <span class="pr-t-sub">${x.code} · ${x.region}</span>
        </span>
        <span class="pr-t-bar"><span style="width:${x.score}%"></span></span>
        <span class="pr-t-s t-mono">${x.score.toFixed(1)}</span>
        <span class="pr-tier" style="color:${x.band.color}">${x.band.label}</span>
      </button>`;
  };

  const evidence = (f) => `
    <div class="pr-ev" style="--ac:${f.accent}">
      <div class="pr-ev-hd">
        <span class="pr-ev-n">${f.label}</span>
        <span class="pr-ev-w t-mono">w ${f.weight}</span>
        <span class="pr-ev-v t-mono">${f.evidence}</span>
      </div>
      <div class="pr-ev-track">
        <span class="pr-ev-fill" style="width:${f.evidence}%"></span>
        <span class="pr-ev-mark" style="left:${f.share}%"></span>
      </div>
      <div class="pr-ev-ft">${f.mitigation}</div>
    </div>`;

  function dossier(x) {
    const c = ctx.get();
    const cm = c.commodity ? RESOURCE_META[c.commodity] : null;
    const lgaOpts = lgas.length ? `
      <label class="pr-sel rk-lga">
        <span>LGA</span>
        <select id="rk-lga">
          <option value="">All LGAs in ${x.name}</option>
          ${lgas.map((l) => `<option value="${l.name}"${l.name === c.lga ? ' selected' : ''}>${l.name}</option>`).join('')}
        </select>
      </label>` : '';

    return `
      <header class="pr-dh" style="--tc:${x.band.color}">
        <div class="pr-dh-t">
          <span class="pr-dh-rank t-mono">#${x.rank}</span>
          <div>
            <div class="pr-dh-tier">${x.band.label} risk · ${x.region}</div>
            <h2>${x.name}${c.lga ? ` <em class="rk-lga-tag">${c.lga}</em>` : ''}</h2>
          </div>
        </div>
        <div class="pr-dh-k">
          ${kpi('Composite risk', x.score.toFixed(1), x.band.note, x.band.color)}
          ${kpi('Leading constraint', x.driver.label, `${x.driver.evidence}/100`, x.driver.accent)}
          ${kpi('Advisory level', x.risk, 'state security rating', 'var(--orange)')}
        </div>
      </header>

      <div class="pr-dgrid">
        <section class="panel pr-p pr-p-wide">
          <header class="panel-hd">
            <span class="accent-bar accent-red"></span><h3>Risk Breakdown</h3>
            <span class="spacer"></span><span class="panel-x">${x.factors.length} factors</span>
          </header>
          <div class="panel-bd">
            <p class="pr-why">${explainRisk(x)}</p>
            <div class="pr-evs">${x.factors.map(evidence).join('')}</div>
          </div>
        </section>

        <section class="panel pr-p">
          <header class="panel-hd">
            <span class="accent-bar accent-gold"></span><h3>Location Context</h3>
          </header>
          <div class="panel-bd">
            ${lgaOpts}
            <div class="pr-facts">
              ${fact('Commodity focus', cm ? `<span class="pr-tag">${cm.label}</span>` : '<span class="mn-none">All commodities</span>')}
              ${fact('Advisory level', `<span class="pr-risk pr-risk-${x.risk}">${x.risk}</span>`)}
              ${fact('Occurrences', `<span class="t-mono">${fmt.int(x.occurrences)}</span>`)}
              ${fact('Active titles', `<span class="t-mono">${fmt.int(x.titles)}</span>`)}
              ${fact('Survey coverage', `<span class="t-mono">${x.coverage}%</span>`)}
              ${fact('Petroleum acreage', x.petroleum ? 'Yes' : 'No')}
            </div>
            <div class="ctx-acts">
              <button class="btn-ghost btn-primary" data-go="explore">${icon('map', { size: 13 })} View on map</button>
              <button class="btn-ghost" data-go="prospectivity">${icon('prospectivity', { size: 13 })} Prospectivity</button>
              ${c.commodity ? `<button class="btn-ghost" data-go="minerals">${icon('minerals', { size: 13 })} Mineral</button>` : ''}
              <button class="btn-ghost" data-report-item>${icon('reports', { size: 13 })} Generate report</button>
            </div>
          </div>
        </section>

        <section class="panel pr-p">
          <header class="panel-hd">
            <span class="accent-bar accent-purple"></span><h3>Mitigation Priorities</h3>
          </header>
          <div class="panel-bd">
            <ol class="rk-mit">
              ${[...x.factors].sort((a, b) => b.evidence - a.evidence).slice(0, 4).map((f) => `
                <li style="--ac:${f.accent}">
                  <span class="rk-mit-h">${f.label}<b class="t-mono">${f.evidence}</b></span>
                  <span class="rk-mit-b">${f.mitigation}</span>
                </li>`).join('')}
            </ol>
          </div>
        </section>
      </div>`;
  }

  const fact = (l, v) => `
    <div class="pr-fact"><span class="pr-fact-l">${l}</span><span class="pr-fact-v">${v}</span></div>`;

  function distribution() {
    const counts = RISK_BANDS.map((b) => ({ ...b, n: result.rows.filter((r) => r.band.id === b.id).length }));
    const total = result.rows.length || 1;
    return `
      <div class="pr-dist">
        ${counts.map((c) => `<span class="pr-dist-seg" style="width:${(c.n / total) * 100}%;background:${c.color}" title="${c.label}: ${c.n}"></span>`).join('')}
      </div>
      <div class="pr-dist-key">
        ${counts.map((c) => `<span class="pr-dk"><i style="background:${c.color}"></i>${c.label}<b>${c.n}</b></span>`).join('')}
      </div>`;
  }

  function shell() {
    return `
      <div class="pr-wrap">
        <header class="pr-head">
          <div class="pr-head-t">
            <h1>Risk Intelligence</h1>
            <p>Composite exploration risk across 36 states and the FCT — security, access,
            environment, community, flood and tenure, weighted to your risk appetite.</p>
          </div>
          <div class="pr-head-k" id="rk-head-k"></div>
        </header>

        <div class="ctx-bar" id="rk-ctx" hidden></div>

        <div class="pr-body">
          <aside class="pr-dock">
            <div class="pr-dock-hd">
              <h3>Risk Factors</h3>
              <button class="pr-reset" id="rk-reset" title="Restore default weights">
                ${icon('refresh', { size: 12 })}<span>Reset</span>
              </button>
            </div>
            <div class="pr-crits" id="rk-factors"></div>
            <div class="pr-dock-ft">
              <div class="pr-wsum"><span>Total weight</span><b class="t-mono" id="rk-wsum">0</b></div>
              <p class="pr-note">Weights are relative. Raise the factors your
              programme is most exposed to and the ranking re-sorts.</p>
            </div>
          </aside>

          <section class="pr-main">
            <div class="panel pr-rank">
              <header class="panel-hd">
                <span class="accent-bar accent-red"></span><h3>Risk Ranking</h3>
                <span class="spacer"></span><span class="panel-x" id="rk-count">0</span>
              </header>
              <div class="pr-dist-wrap" id="rk-dist"></div>
              <div class="pr-tlist" id="rk-list"></div>
            </div>
            <div class="pr-detail" id="rk-detail"></div>
          </section>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------- */

  function score() {
    result = runRisk(states, weights);
    if (selectedName && !result.rows.some((r) => r.name === selectedName)) selectedName = null;
  }

  function renderFactors() {
    const host = $('#rk-factors', root);
    if (host) host.innerHTML = RISK_FACTORS.map(factorRow).join('');
    syncWeights();
  }

  function syncWeights() {
    RISK_FACTORS.forEach((f) => {
      const w = weights[f.id];
      const v = $(`[data-rw-val="${f.id}"]`, root);
      if (v) {
        v.textContent = w.weight;
        const pct = v.nextElementSibling;
        if (pct) pct.textContent = `${result.activeWeight && w.on ? Math.round((w.weight / result.activeWeight) * 100) : 0}%`;
      }
    });
    const s = $('#rk-wsum', root);
    if (s) s.textContent = result.activeWeight;
    const r = $('#rk-reset', root);
    if (r) r.hidden = isDefault();
  }

  function renderList() {
    const host = $('#rk-list', root);
    if (!host) return;
    host.innerHTML = result.activeWeight
      ? result.rows.map(row).join('')
      : '<p class="pr-none pr-none-pad">Every factor is disabled — enable at least one to score risk.</p>';
    const n = $('#rk-count', root);
    if (n) n.textContent = result.rows.length >= 37
      ? '36 states + FCT'
      : `${result.rows.length} states`;
    const d = $('#rk-dist', root);
    if (d) d.innerHTML = result.activeWeight ? distribution() : '';
  }

  function renderHead() {
    const host = $('#rk-head-k', root);
    if (!host) return;
    const severe = result.rows.filter((r) => r.band.id === 'severe' || r.band.id === 'high').length;
    const top = result.rows[0];
    host.innerHTML = `
      ${kpi('High / severe', severe, `of ${result.rows.length} areas`, 'var(--red)')}
      ${kpi('Highest risk', top ? top.name : '—', top ? `${top.score.toFixed(1)} composite` : '', 'var(--orange)')}
      ${kpi('Lowest risk', result.rows.at(-1)?.name || '—', `${result.rows.at(-1)?.score.toFixed(1) || ''} composite`, 'var(--green)')}`;
  }

  function renderDetail() {
    const host = $('#rk-detail', root);
    if (!host) return;
    if (!result.activeWeight) {
      host.innerHTML = `<div class="pr-empty">
        <div class="pr-empty-g">${icon('sliders', { size: 30, sw: 1.3 })}</div>
        <p class="pr-empty-t">No factors enabled</p>
        <p class="pr-empty-s">Enable at least one risk factor, or reset to the default model.</p>
      </div>`;
      return;
    }
    const x = result.rows.find((r) => r.name === selectedName);
    host.innerHTML = x ? dossier(x) : `<div class="pr-empty">
      <div class="pr-empty-g">${icon('risk', { size: 30, sw: 1.3 })}</div>
      <p class="pr-empty-t">Select a location</p>
      <p class="pr-empty-s">Its risk breakdown, location context and mitigation priorities open here.</p>
    </div>`;
  }

  function renderCtxBar() {
    const bar = $('#rk-ctx', root);
    if (!bar) return;
    const c = ctx.get();
    if (!c.commodity && !c.state) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = `
      <span class="ctx-l">${icon('target', { size: 12 })} Context</span>
      <span class="ctx-trail">${ctx.label(RESOURCE_META) || 'National'}</span>
      <button class="ctx-clear" data-ctx-clear title="Clear context">${icon('plus', { size: 12 })}</button>`;
  }

  async function selectState(name, { keepLga = false } = {}) {
    selectedName = name;
    const rec = states.find((s) => s.name === name);
    if (!keepLga) ctx.set({ state: name, lga: null });
    lgas = rec ? await api.getLgas(rec.code) : [];
    renderList();
    renderDetail();
    renderCtxBar();
  }

  function refresh({ factors = false } = {}) {
    score();
    renderList();
    renderHead();
    renderDetail();
    if (factors) renderFactors(); else syncWeights();
  }

  /* ---------------------------------------------------------------- */

  function wire() {
    root.addEventListener('click', (e) => {
      const tog = e.target.closest('[data-rf-toggle]');
      if (tog) {
        const id = tog.dataset.rfToggle;
        weights[id].on = !weights[id].on;
        save(); refresh({ factors: true });
        return;
      }
      const pick = e.target.closest('[data-risk-row]');
      if (pick) { selectState(pick.dataset.riskRow); return; }

      if (e.target.closest('#rk-reset')) { weights = defaultRiskWeights(); save(); refresh({ factors: true }); return; }
      if (e.target.closest('[data-ctx-clear]')) { ctx.clear(); renderCtxBar(); renderDetail(); return; }

      if (e.target.closest('[data-report-item]')) {
        // Report the selected state's risk, and the LGA too when the shared
        // context has drilled to one — that is the scope the user is looking at.
        const c = ctx.get();
        const n = selectedName || c.state;
        const added = reports.addMany([
          { kind: 'risk', id: n, title: `Risk assessment — ${n}` },
          ...(c.lga ? [{ kind: 'lga', id: c.lga, state: n, title: `Local government — ${c.lga}` }] : []),
        ]);
        toast(added ? `Added ${c.lga ? `${c.lga}, ` : ''}${n} risk to the report`
                    : 'Already in the report');
        return;
      }

      const go = e.target.closest('[data-go]')?.dataset.go;
      if (go) {
        ctx.set({ state: selectedName || ctx.get().state, layer: go === 'explore' ? 'risk' : null });
        ctx.go(go);
      }
    });

    root.addEventListener('input', (e) => {
      const sl = e.target.closest('[data-rf-weight]');
      if (sl) { weights[sl.dataset.rfWeight].weight = clamp(+sl.value, 0, 60); save(); refresh(); }
    });

    root.addEventListener('change', (e) => {
      if (e.target.id === 'rk-lga') {
        ctx.set({ lga: e.target.value || null });
        renderDetail();
        renderCtxBar();
      }
    });
  }

  /** Adopt any context handed over by another module. */
  async function adopt() {
    const c = ctx.get();
    if (c.state && c.state !== selectedName) {
      await selectState(c.state, { keepLga: !!c.lga });
    } else if (c.state) {
      selectedName = c.state;
    }
    if (c.lga) { const s = $('#rk-lga', root); if (s) s.value = c.lga; }
    renderCtxBar();
    renderDetail();
  }

  return {
    async mount(view) {
      root = view;
      view.innerHTML = `<div class="pr-loading">${icon('refresh', { size: 18 })}<span>Scoring exploration risk…</span></div>`;
      states = await api.getProspectivityInputs();
      score();
      view.innerHTML = shell();
      wire();
      renderFactors();
      renderList();
      renderHead();
      renderCtxBar();
      renderDetail();
      await adopt();
    },
    onShow() { adopt(); },
  };
}
