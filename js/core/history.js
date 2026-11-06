// Historique annuler/rétablir profond et économe en mémoire.
//
// Deux types d'entrées :
//  - patch de pixels : seul le rectangle modifié est stocké (avant/après) ;
//  - transaction de structure : instantané léger de l'arbre (les tableaux de
//    pixels sont partagés par référence, voir Doc.snapshot()).
// Une entrée peut aussi regrouper plusieurs sous-entrées (entrée composite).

import { markDirty } from '../render/celcache.js';

export class History {
  constructor(app, { maxBytes = 384 * 1024 * 1024, maxEntries = 5000 } = {}) {
    this.app = app;
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
    this._group = null;
  }

  get doc() {
    return this.app.doc;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
    this.app.emit('history');
  }

  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }

  push(entry) {
    if (this._group) {
      this._group.push(entry);
      return;
    }
    this.undoStack.push(entry);
    this.bytes += entry.bytes || 64;
    for (const e of this.redoStack) this.bytes -= e.bytes || 64;
    this.redoStack = [];
    while ((this.bytes > this.maxBytes || this.undoStack.length > this.maxEntries) && this.undoStack.length > 1) {
      const old = this.undoStack.shift();
      this.bytes -= old.bytes || 64;
    }
    this.app.emit('history');
    this.app.emit('changed');
  }

  undo() {
    this.app.beforeHistoryJump?.();
    const e = this.undoStack.pop();
    if (!e) return false;
    e.undo();
    this.redoStack.push(e);
    this.app.toast?.(`Annulé : ${e.label}`, 900);
    this.app.emit('history');
    this.app.emit('changed');
    this.app.emit('structure');
    return true;
  }

  redo() {
    this.app.beforeHistoryJump?.();
    const e = this.redoStack.pop();
    if (!e) return false;
    e.redo();
    this.undoStack.push(e);
    this.app.toast?.(`Rétabli : ${e.label}`, 900);
    this.app.emit('history');
    this.app.emit('changed');
    this.app.emit('structure');
    return true;
  }

  /** Regroupe toutes les entrées poussées dans fn en une seule. */
  group(label, fn) {
    const outer = this._group;
    const list = [];
    this._group = list;
    let result;
    try {
      result = fn();
    } finally {
      this._group = outer;
    }
    if (list.length) {
      const bytes = list.reduce((s, e) => s + (e.bytes || 64), 0);
      this.push({
        label,
        bytes,
        undo: () => { for (let i = list.length - 1; i >= 0; i--) list[i].undo(); },
        redo: () => { for (const e of list) e.redo(); },
      });
    }
    return result;
  }

  // ---------- Transactions de structure ----------
  transact(label, fn) {
    const doc = this.doc;
    const before = doc.snapshot();
    let result;
    try {
      result = fn();
    } catch (err) {
      doc.restore(before);
      this.app.emit('structure');
      throw err;
    }
    if (result === false) return false; // opération annulée par fn
    const after = doc.snapshot();
    const app = this.app;
    const apply = (s) => {
      // un changement de taille ou de cels oblige à rafraîchir les caches
      doc.restore(s);
      app.renderer?.invalidateAll();
    };
    this.push({
      label,
      bytes: 256 + (before.nodes.length + after.nodes.length) * 160,
      undo: () => apply(before),
      redo: () => apply(after),
    });
    app.renderer?.invalidateAll();
    app.emit('structure');
    return result;
  }

  // ---------- Patchs de pixels ----------
  /** Démarre une modification de pixels sur un calque/frame : copie de sauvegarde. */
  beginPixels(layer, frame = this.doc.frame) {
    const cel = this.doc.cel(layer, frame);
    return { layerId: layer.id, frame, cel, before: cel.slice() };
  }

  /** Termine la modification : ne conserve que le rectangle modifié. */
  endPixels(token, label) {
    if (!token) return false;
    const { cel, before, layerId, frame } = token;
    const w = this.doc.width;
    const hgt = this.doc.height;
    if (cel.length !== before.length) return false;
    let x0 = w, y0 = hgt, x1 = -1, y1 = -1;
    for (let y = 0; y < hgt; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (cel[row + x] !== before[row + x]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
      }
    }
    if (x1 < 0) return false;
    const rw = x1 - x0 + 1;
    const rh = y1 - y0 + 1;
    const rb = new Uint32Array(rw * rh);
    const ra = new Uint32Array(rw * rh);
    for (let y = 0; y < rh; y++) {
      const src = (y0 + y) * w + x0;
      rb.set(before.subarray(src, src + rw), y * rw);
      ra.set(cel.subarray(src, src + rw), y * rw);
    }
    const doc = this.doc;
    const app = this.app;
    const apply = (data) => {
      const layer = doc.get(layerId);
      if (!layer) return;
      const c = doc.cel(layer, frame);
      if (c.length !== w * hgt || doc.width !== w) return; // taille changée entre-temps
      for (let y = 0; y < rh; y++) c.set(data.subarray(y * rw, (y + 1) * rw), (y0 + y) * w + x0);
      markDirty(c, x0, y0, x1 + 1, y1 + 1);
      app.renderer?.invalidate(x0, y0, x1 + 1, y1 + 1);
      if (doc.frame !== frame) {
        doc.frame = frame;
        app.emit('frame');
      }
    };
    this.push({
      label,
      bytes: rw * rh * 8 + 96,
      undo: () => apply(rb),
      redo: () => apply(ra),
    });
    return true;
  }

  /** Annule une modification en cours (ex. geste à deux doigts). */
  abortPixels(token) {
    if (!token) return;
    token.cel.set(token.before);
    markDirty(token.cel);
    this.app.renderer?.invalidateAll();
  }
}
