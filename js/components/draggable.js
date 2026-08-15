/**
 * Make a floating panel draggable by its header.
 * Position is clamped to the container and persisted per key.
 */

export function makeDraggable(el, handle, { key, container } = {}) {
  const bounds = () => (container || el.offsetParent || document.body).getBoundingClientRect();

  function clampInto(left, top) {
    const c = bounds();
    const w = el.offsetWidth, h = el.offsetHeight;
    return {
      left: Math.max(8, Math.min(left, c.width - w - 8)),
      top: Math.max(8, Math.min(top, c.height - h - 8)),
    };
  }

  function place(left, top, save = true) {
    const p = clampInto(left, top);
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    if (save && key) localStorage.setItem(key, JSON.stringify(p));
  }

  // restore
  if (key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved) requestAnimationFrame(() => place(saved.left, saved.top, false));
    } catch { /* ignore */ }
  }

  let startX = 0, startY = 0, originLeft = 0, originTop = 0, dragging = false;

  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    place(originLeft + (e.clientX - startX), originTop + (e.clientY - startY));
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    document.body.classList.remove('is-panel-dragging');
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
  };

  handle.addEventListener('pointerdown', (e) => {
    // never start a drag from a control inside the header
    if (e.target.closest('button, input, a, select, textarea')) return;
    const r = el.getBoundingClientRect();
    const c = bounds();
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    originLeft = r.left - c.left;
    originTop = r.top - c.top;
    place(originLeft, originTop, false);   // convert right/bottom anchoring to left/top
    el.classList.add('is-dragging');
    document.body.classList.add('is-panel-dragging');
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    e.preventDefault();
  });

  // keep inside the container when it resizes
  const ro = new ResizeObserver(() => {
    if (!el.style.left) return;
    place(parseFloat(el.style.left), parseFloat(el.style.top));
  });
  if (container) ro.observe(container);

  return {
    reset() {
      if (key) localStorage.removeItem(key);
      el.style.left = el.style.top = el.style.right = el.style.bottom = '';
    },
    destroy() { ro.disconnect(); onUp(); },
  };
}

/**
 * Dock resizer: drag the rail to resize, click it to collapse.
 * A small chevron marks it as interactive.
 */
export function makeDockResizer(dock, {
  side = 'left', min = 200, max = 460, key, onResize, onToggle,
} = {}) {
  const rail = document.createElement('div');
  rail.className = `dock-rail dock-rail-${side}`;
  rail.setAttribute('role', 'separator');
  rail.setAttribute('tabindex', '0');
  rail.setAttribute('aria-label', `Resize or hide ${side} panel`);
  rail.innerHTML = `<span class="dr-grip"></span><span class="dr-arrow"></span>`;
  dock.appendChild(rail);

  let dragging = false, moved = false, startX = 0, startW = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const w = Math.round(side === 'left' ? startW + dx : startW - dx);
    if (Math.abs(dx) > 3) moved = true;
    const clamped = Math.min(max, Math.max(min, w));
    dock.style.width = clamped + 'px';
    dock.style.minWidth = clamped + 'px';
    if (key) localStorage.setItem(key, String(clamped));
    onResize?.(clamped);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-resizing');
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
    // A click without movement collapses the dock.
    if (!moved) onToggle?.();
    else onResize?.(parseInt(dock.style.width, 10));
  };

  rail.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false;
    startX = e.clientX;
    startW = dock.getBoundingClientRect().width;
    document.body.classList.add('is-resizing');
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    e.preventDefault();
  });

  rail.addEventListener('keydown', (e) => {
    const cur = dock.getBoundingClientRect().width;
    const step = side === 'left' ? 24 : -24;
    if (e.key === 'ArrowRight') { const w = Math.min(max, Math.max(min, cur + step)); dock.style.width = dock.style.minWidth = w + 'px'; onResize?.(w); }
    if (e.key === 'ArrowLeft')  { const w = Math.min(max, Math.max(min, cur - step)); dock.style.width = dock.style.minWidth = w + 'px'; onResize?.(w); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(); }
  });

  if (key) {
    const saved = parseInt(localStorage.getItem(key) || '', 10);
    if (saved) { dock.style.width = saved + 'px'; dock.style.minWidth = saved + 'px'; }
  }

  return { rail };
}
