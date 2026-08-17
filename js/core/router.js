/**
 * Hash-based SPA router.
 *
 * Guarantees required by the spec:
 *  - the application shell (topbar + sidebar + background) is created ONCE
 *  - navigating swaps only the contents of the stage element
 *  - no full document loads, no browser loading bar
 *  - modules can keep state alive between visits (keepAlive) so the map
 *    instance is never destroyed and re-created
 */

export class Router {
  /**
   * @param {HTMLElement} stage  container whose children are module views
   * @param {HTMLElement} bar    internal progress bar element
   */
  constructor(stage, bar) {
    this.stage = stage;
    this.bar = bar;
    this.routes = new Map();
    this.mounted = new Map();  // id -> { el, mod }
    this.current = null;
    this._subs = new Set();
    this._navigating = false;
  }

  /** register(id, { title, factory, keepAlive }) */
  register(id, def) { this.routes.set(id, def); return this; }

  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }

  /**
   * Tear down every mounted view except the active one, and force the active
   * one to remount. Used when the underlying data source changes (sample <->
   * live), since keep-alive modules hold rendered rows that are now stale.
   */
  resetViews({ except = null } = {}) {
    this.mounted.forEach((entry, id) => {
      if (id === except) return;
      try { entry.mod?.destroy?.(); } catch (err) { console.error('[router] destroy', id, err); }
      entry.el.remove();
      this.mounted.delete(id);
    });
  }

  start(fallback = 'overview') {
    this.fallback = fallback;
    addEventListener('hashchange', () => this._resolve());
    this._resolve();
  }

  navigate(id) {
    if (id === this.current) return;
    // Updating the hash does NOT reload the document.
    location.hash = '#/' + id;
  }

  _resolve() {
    const id = (location.hash.replace(/^#\/?/, '') || this.fallback).split('?')[0];
    const target = this.routes.has(id) ? id : this.fallback;
    if (target !== id) { location.replace('#/' + target); return; }
    this._go(target);
  }

  async _go(id) {
    if (id === this.current || this._navigating) return;
    this._navigating = true;

    // Internal progress affordance (never the browser's own loading bar)
    this.bar.classList.remove('is-running');
    void this.bar.offsetWidth;
    this.bar.classList.add('is-running');

    const def = this.routes.get(id);
    const prev = this.current ? this.mounted.get(this.current) : null;

    // Suspend the outgoing module without destroying keep-alive state
    if (prev) {
      prev.mod?.onHide?.();
      if (this.routes.get(this.current).keepAlive) {
        prev.el.style.display = 'none';
      } else {
        prev.mod?.destroy?.();
        prev.el.remove();
        this.mounted.delete(this.current);
      }
    }

    let entry = this.mounted.get(id);
    if (!entry) {
      const view = document.createElement('section');
      view.className = 'view';
      view.id = 'view-' + id;
      view.setAttribute('role', 'region');
      view.setAttribute('aria-label', def.title);
      const mod = await def.factory();
      this.stage.appendChild(view);
      await mod.mount?.(view);
      entry = { el: view, mod };
      this.mounted.set(id, entry);
    } else {
      entry.el.style.display = '';
    }

    entry.el.classList.remove('is-entering');
    void entry.el.offsetWidth;
    entry.el.classList.add('is-entering');
    entry.mod?.onShow?.();

    this.current = id;
    document.title = `${def.title} · Nigeria Mineral Intelligence`;
    this._subs.forEach((fn) => fn(id, def));
    this._navigating = false;
  }
}
