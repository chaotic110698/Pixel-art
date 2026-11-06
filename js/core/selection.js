// Sélection (masque) et contenu flottant (déplacement / collage / transformations).

import { maskBounds, rotateCW, rotateCCW, flipHGeneric, flipVGeneric } from './raster.js';

export class Selection {
  constructor(app) {
    this.app = app;
    this.mask = null; // Uint8Array w*h ou null (= tout)
    this.bounds = null;
    this.floating = null; // { data, mask, w, h, x, y, token }
    this.version = 0;
    this._edges = null;
  }

  get doc() {
    return this.app.doc;
  }

  get active() {
    return !!(this.mask || this.floating);
  }

  reset() {
    this.mask = null;
    this.bounds = null;
    this.floating = null;
    this.changed();
  }

  changed() {
    this.version++;
    this._edges = null;
    this.app.renderer?.invalidateOverlay();
    this.app.emit('selection');
  }

  /**
   * Exécute fn et enregistre le changement de masque dans l'historique
   * (annuler/rétablir s'applique aussi aux sélections).
   */
  _record(label, fn) {
    const before = this.mask ? this.mask.slice() : null;
    fn();
    const after = this.mask ? this.mask.slice() : null;
    if (!before && !after) return;
    if (before && after && before.length === after.length && before.every((v, i) => v === after[i])) return;
    const w = this.doc.width, h = this.doc.height;
    const set = (m) => {
      this.floating = null;
      if (!m || m.length !== this.doc.width * this.doc.height || this.doc.width !== w) {
        this.mask = null;
        this.bounds = null;
      } else {
        this.mask = m.slice();
        this.bounds = maskBounds(this.mask, w, h);
        if (!this.bounds) this.mask = null;
      }
      this.changed();
    };
    this.app.history.push({ label, bytes: ((before?.length || 0) + (after?.length || 0)) + 64, undo: () => set(before), redo: () => set(after) });
  }

  /** op : 'replace' | 'add' | 'subtract' */
  apply(newMask, op = 'replace') {
    this._record(op === 'subtract' ? 'Retirer de la sélection' : op === 'add' ? 'Ajouter à la sélection' : 'Sélection', () => this._apply(newMask, op));
  }

  _apply(newMask, op) {
    const n = this.doc.width * this.doc.height;
    if (op === 'replace' || !this.mask) {
      if (op === 'subtract') return;
      this.mask = newMask;
    } else if (op === 'add') {
      for (let i = 0; i < n; i++) if (newMask[i]) this.mask[i] = 1;
    } else if (op === 'subtract') {
      for (let i = 0; i < n; i++) if (newMask[i]) this.mask[i] = 0;
    }
    this.bounds = maskBounds(this.mask, this.doc.width, this.doc.height);
    if (!this.bounds) this.mask = null;
    this.changed();
  }

  rectMask(x0, y0, x1, y1) {
    const { width: w, height: h } = this.doc;
    const m = new Uint8Array(w * h);
    x0 = Math.max(0, Math.min(x0, x1)); x1 = Math.min(w - 1, Math.max(x0, x1));
    y0 = Math.max(0, Math.min(y0, y1)); y1 = Math.min(h - 1, Math.max(y0, y1));
    for (let y = y0; y <= y1; y++) m.fill(1, y * w + x0, y * w + x1 + 1);
    return m;
  }

  selectAll() {
    this.commitFloating();
    this.apply(this.rectMask(0, 0, this.doc.width - 1, this.doc.height - 1));
  }

  deselect() {
    this.commitFloating();
    this._record('Désélectionner', () => {
      this.mask = null;
      this.bounds = null;
    });
    this.changed();
  }

  invert() {
    this.commitFloating();
    const n = this.doc.width * this.doc.height;
    const m = new Uint8Array(n);
    for (let i = 0; i < n; i++) m[i] = this.mask ? 1 - this.mask[i] : 0;
    this.apply(m);
  }

  contains(x, y) {
    const { width: w, height: h } = this.doc;
    if (this.floating) {
      const f = this.floating;
      const lx = x - f.x, ly = y - f.y;
      return lx >= 0 && ly >= 0 && lx < f.w && ly < f.h && !!f.mask[ly * f.w + lx];
    }
    if (!this.mask) return false;
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return !!this.mask[y * w + x];
  }

  // ---------- Contenu flottant ----------
  /** Soulève les pixels sélectionnés du calque actif. copy=true : laisse l'original. */
  lift(copy = false) {
    if (this.floating) return true;
    const app = this.app;
    const doc = this.doc;
    const layer = app.editableLayer();
    if (!layer) return false;
    const { width: w, height: h } = doc;
    if (!this.mask) this.apply(this.rectMask(0, 0, w - 1, h - 1));
    const b = this.bounds;
    if (!b) return false;
    const fw = b.x1 - b.x0 + 1, fh = b.y1 - b.y0 + 1;
    const data = new Uint32Array(fw * fh);
    const fmask = new Uint8Array(fw * fh);
    const token = app.history.beginPixels(layer);
    const cel = doc.cel(layer);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const i = (b.y0 + y) * w + b.x0 + x;
        if (!this.mask[i]) continue;
        fmask[y * fw + x] = 1;
        data[y * fw + x] = cel[i];
        if (!copy) cel[i] = 0;
      }
    }
    app.markLayerDirty(cel, b.x0, b.y0, b.x1 + 1, b.y1 + 1);
    this.floating = { data, mask: fmask, w: fw, h: fh, x: b.x0, y: b.y0, token, layerId: layer.id };
    this.changed();
    return true;
  }

  /** Crée un flottant à partir d'un tampon (collage). */
  paste(data, w, h, x, y, mask = null) {
    this.commitFloating();
    const layer = this.app.editableLayer();
    if (!layer) return false;
    const token = this.app.history.beginPixels(layer);
    if (!mask) {
      mask = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) mask[i] = data[i] >>> 24 ? 1 : 0;
      // un collage rectangulaire reste sélectionné même sur pixels transparents
      mask.fill(1);
    }
    this.floating = { data: data.slice(), mask: mask.slice(), w, h, x, y, token, layerId: layer.id };
    this.changed();
    this.app.renderer?.invalidateAll();
    return true;
  }

  moveFloating(dx, dy) {
    if (!this.floating) return;
    this.floating.x += dx;
    this.floating.y += dy;
    this.changed();
    this.app.renderer?.invalidateAll();
  }

  transformFloating(kind) {
    if (!this.floating && !this.lift()) return;
    const f = this.floating;
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    if (kind === 'flipH') {
      f.data = flipHGeneric(f.data, f.w, f.h);
      f.mask = flipHGeneric(f.mask, f.w, f.h);
    } else if (kind === 'flipV') {
      f.data = flipVGeneric(f.data, f.w, f.h);
      f.mask = flipVGeneric(f.mask, f.w, f.h);
    } else if (kind === 'cw' || kind === 'ccw') {
      const rot = kind === 'cw' ? rotateCW : rotateCCW;
      const [d, nw, nh] = rot(f.data, f.w, f.h);
      const [m] = rot(f.mask, f.w, f.h);
      f.data = d; f.mask = m; f.w = nw; f.h = nh;
      f.x = Math.round(cx - nw / 2);
      f.y = Math.round(cy - nh / 2);
    } else if (kind === 'r180') {
      this.transformFloating('flipH');
      this.transformFloating('flipV');
      return;
    }
    this.changed();
    this.app.renderer?.invalidateAll();
  }

  /** Pose le contenu flottant sur le calque et enregistre UNE entrée d'historique. */
  commitFloating(label = 'Transformer la sélection') {
    const f = this.floating;
    if (!f) return;
    const doc = this.doc;
    const layer = doc.get(f.layerId);
    this.floating = null;
    const { width: w, height: h } = doc;
    // pixels + nouvelle position de la sélection = une seule entrée d'historique
    this.app.history.group(label, () => {
      if (layer && layer.cels[doc.frame] === f.token.cel) {
        const cel = f.token.cel;
        for (let y = 0; y < f.h; y++) {
          const ty = f.y + y;
          if (ty < 0 || ty >= h) continue;
          for (let x = 0; x < f.w; x++) {
            const tx = f.x + x;
            if (tx < 0 || tx >= w) continue;
            const c = f.data[y * f.w + x];
            if (f.mask[y * f.w + x] && c >>> 24) cel[ty * w + tx] = c;
          }
        }
        this.app.markLayerDirty(cel);
        this.app.history.endPixels(f.token, label);
      }
      // la sélection suit le contenu déplacé
      const m = new Uint8Array(w * h);
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const tx = f.x + x, ty = f.y + y;
          if (tx >= 0 && ty >= 0 && tx < w && ty < h && f.mask[y * f.w + x]) m[ty * w + tx] = 1;
        }
      }
      this._record(label, () => {
        this.mask = m;
        this.bounds = maskBounds(m, w, h);
        if (!this.bounds) this.mask = null;
      });
    });
    this.changed();
    this.app.renderer?.invalidateAll();
  }

  /** Annule le flottant (rétablit les pixels d'origine). */
  cancelFloating() {
    const f = this.floating;
    if (!f) return;
    this.floating = null;
    this.app.history.abortPixels(f.token);
    this.changed();
  }

  /** Tampon courant pour copier : flottant ou zone sélectionnée du calque actif. */
  extract() {
    const doc = this.doc;
    if (this.floating) {
      const f = this.floating;
      return { data: f.data.slice(), mask: f.mask.slice(), w: f.w, h: f.h, x: f.x, y: f.y };
    }
    const layer = doc.activeLayer;
    if (!layer) return null;
    const { width: w, height: h } = doc;
    const cel = doc.cel(layer);
    const b = this.mask ? this.bounds : { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
    if (!b) return null;
    const fw = b.x1 - b.x0 + 1, fh = b.y1 - b.y0 + 1;
    const data = new Uint32Array(fw * fh);
    const mask = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const i = (b.y0 + y) * w + b.x0 + x;
        if (this.mask && !this.mask[i]) continue;
        mask[y * fw + x] = 1;
        data[y * fw + x] = cel[i];
      }
    }
    return { data, mask, w: fw, h: fh, x: b.x0, y: b.y0 };
  }

  /** Segments du contour de la sélection, en coordonnées document. */
  edges() {
    if (this._edges) return this._edges;
    const segs = [];
    let m, w, h, ox = 0, oy = 0;
    if (this.floating) {
      ({ mask: m, w, h } = this.floating);
      ox = this.floating.x; oy = this.floating.y;
    } else if (this.mask) {
      m = this.mask; w = this.doc.width; h = this.doc.height;
    } else return (this._edges = segs);
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
    // segments horizontaux fusionnés
    for (let y = 0; y <= h; y++) {
      let start = -1, kind = 0;
      for (let x = 0; x <= w; x++) {
        const a = at(x, y - 1) ? 1 : 0, b = at(x, y) ? 1 : 0;
        const k = a !== b ? 1 : 0;
        if (k && start < 0) { start = x; kind = 1; }
        if (!k && start >= 0) { segs.push([ox + start, oy + y, ox + x, oy + y]); start = -1; }
      }
      void kind;
    }
    for (let x = 0; x <= w; x++) {
      let start = -1;
      for (let y = 0; y <= h; y++) {
        const a = at(x - 1, y) ? 1 : 0, b = at(x, y) ? 1 : 0;
        const k = a !== b;
        if (k && start < 0) start = y;
        if (!k && start >= 0) { segs.push([ox + x, oy + start, ox + x, oy + y]); start = -1; }
      }
    }
    return (this._edges = segs);
  }
}
