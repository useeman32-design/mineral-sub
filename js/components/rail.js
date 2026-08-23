/**
 * Intel rail controller — drag to resize, collapse to hide.
 *
 * When hidden, the rail's cards reflow into a grid BELOW the map so the whole
 * dashboard becomes scrollable and no information is lost. Width and collapsed
 * state persist across sessions.
 */

import { icon } from '../core/icons.js?v=e68ba8c';
import { $ } from '../core/utils.js?v=e68ba8c';

const W_KEY = 'nmi.railWidth';
const C_KEY = 'nmi.railCollapsed';
const MIN = 260;
const MAX = 560;

export function initRail(dash, { onResize } = {}) {
  const rail = $('.intel-rail', dash);
  const below = $('#rail-below', dash);
  if (!rail) return null;

  /* ---- handle ---- */
  const handle = document.createElement('div');
  handle.className = 'rail-handle';
  handle.id = 'rail-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('aria-label', 'Resize intelligence panel');
  handle.innerHTML = `<span class="rh-grip"></span><span class="rh-arrow"></span>`;
  handle.title = 'Drag to resize · click to hide';
  dash.appendChild(handle);

  /* ---- restore button (the rail handle handles hiding) ---- */
  const showBtn = document.createElement('button');
  showBtn.className = 'rail-show';
  showBtn.id = 'rail-show';
  showBtn.title = 'Show intelligence panel';
  showBtn.hidden = true;
  showBtn.innerHTML = `${icon('chevronL', { size: 14 })}<span>Intel</span>`;
  dash.appendChild(showBtn);

  const state = {
    width: clampW(+localStorage.getItem(W_KEY) || 324),
    collapsed: localStorage.getItem(C_KEY) === '1',
  };

  function clampW(v) { return Math.min(MAX, Math.max(MIN, v)); }

  function applyWidth(w) {
    state.width = clampW(w);
    dash.style.setProperty('--rail-w', state.width + 'px');
    localStorage.setItem(W_KEY, String(state.width));
  }

  /**
   * Collapsing moves the cards below the map (not away) so the page
   * scrolls to reveal everything.
   */
  function applyCollapsed(c) {
    state.collapsed = c;
    dash.classList.toggle('rail-hidden', c);
    showBtn.hidden = !c;
    handle.hidden = c;
    localStorage.setItem(C_KEY, c ? '1' : '0');

    // Move only the content cards; the hide button always stays on the rail.
    if (c) {
      [...rail.children].forEach((n) => below.appendChild(n));
    } else {
      [...below.children].forEach((n) => rail.appendChild(n));
    }
    requestAnimationFrame(() => onResize?.());
  }

  applyWidth(state.width);
  applyCollapsed(state.collapsed);

  /* ---- drag to resize, click to hide ---- */
  let dragging = false, moved = false, startX = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    if (Math.abs(x - startX) > 3) moved = true;
    applyWidth(dash.getBoundingClientRect().right - x);
    onResize?.();
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-resizing');
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', stop);
    // A click with no movement collapses the rail.
    if (!moved) applyCollapsed(true);
    else onResize?.();
  };

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    moved = false;
    startX = e.clientX;
    document.body.classList.add('is-resizing');
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', stop);
  });

  handle.addEventListener('dblclick', () => { applyWidth(324); onResize?.(); });

  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { applyWidth(state.width + 24); onResize?.(); }
    if (e.key === 'ArrowRight') { applyWidth(state.width - 24); onResize?.(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyCollapsed(true); }
  });

  showBtn.addEventListener('click', () => applyCollapsed(false));

  return {
    get collapsed() { return state.collapsed; },
    toggle() { applyCollapsed(!state.collapsed); },
  };
}
