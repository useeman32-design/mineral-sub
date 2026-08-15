/**
 * Snapshot-based undo/redo stack.
 *
 * Shapes are plain serialisable data, so snapshotting the whole collection is
 * simpler and far more robust than inverse-command pairs — an interrupted or
 * partially-applied edit can never corrupt the timeline.
 */

export class History {
  constructor({ limit = 60, onChange } = {}) {
    this.limit = limit;
    this.onChange = onChange || (() => {});
    this.stack = [];
    this.index = -1;
    this._muted = false;
  }

  /** Seed the timeline with the starting state (no undo available yet). */
  reset(state, label = 'Initial') {
    this.stack = [{ state: clone(state), label }];
    this.index = 0;
    this.onChange(this.status);
  }

  /** Record a new state on top of the current position, dropping any redo tail. */
  push(state, label = 'Edit') {
    if (this._muted) return;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push({ state: clone(state), label });
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
    this.onChange(this.status);
  }

  undo() {
    if (!this.canUndo) return null;
    this.index--;
    this.onChange(this.status);
    return clone(this.stack[this.index].state);
  }

  redo() {
    if (!this.canRedo) return null;
    this.index++;
    this.onChange(this.status);
    return clone(this.stack[this.index].state);
  }

  /** Apply a batch of changes as a single undo step. */
  mute(fn) {
    this._muted = true;
    try { fn(); } finally { this._muted = false; }
  }

  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.stack.length - 1; }
  get undoLabel() { return this.canUndo ? this.stack[this.index].label : null; }
  get redoLabel() { return this.canRedo ? this.stack[this.index + 1].label : null; }

  get status() {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoLabel: this.undoLabel,
      redoLabel: this.redoLabel,
      depth: this.stack.length,
      position: this.index,
    };
  }
}

function clone(v) {
  return typeof structuredClone === 'function'
    ? structuredClone(v)
    : JSON.parse(JSON.stringify(v));
}
