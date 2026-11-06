export class Emitter {
  constructor() {
    this._h = new Map();
  }
  on(evt, fn) {
    if (!this._h.has(evt)) this._h.set(evt, new Set());
    this._h.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    this._h.get(evt)?.delete(fn);
  }
  emit(evt, ...args) {
    const set = this._h.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[emitter] ${evt}`, err);
      }
    }
  }
}
