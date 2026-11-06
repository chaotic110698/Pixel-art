// Painter : écrit des pixels dans un tampon en appliquant taille de pinceau,
// forme, symétrie, tramage, masque de sélection et enroulement (mode tuiles).

import { bresenham, ditherFn } from '../core/raster.js';

export class Painter {
  constructor(app, target, opts = {}) {
    const doc = app.doc;
    this.app = app;
    this.target = target;
    this.w = doc.width;
    this.h = doc.height;
    this.color = opts.color ?? 0;
    this.color2 = opts.color2 ?? null; // null = ne rien peindre hors motif
    this.erase = !!opts.erase;
    this.size = Math.max(1, opts.size | 0 || 1);
    this.shape = opts.shape || 'square';
    this.dither = opts.dither ? ditherFn(opts.dither) : null;
    this.mask = opts.mask || null;
    this.symmetry = opts.symmetry || 'none';
    this.symX = opts.symX ?? this.w / 2;
    this.symY = opts.symY ?? this.h / 2;
    this.wrap = !!opts.wrap;
    this.dirty = null;
    this.footprint = this._footprint();
  }

  _footprint() {
    const n = this.size;
    const off = Math.floor((n - 1) / 2);
    const pts = [];
    for (let dy = 0; dy < n; dy++) {
      for (let dx = 0; dx < n; dx++) {
        if (this.shape === 'round' && n > 2) {
          const cx = dx + 0.5 - n / 2, cy = dy + 0.5 - n / 2;
          if (cx * cx + cy * cy > (n / 2) * (n / 2) + 0.15 * n) continue;
        }
        pts.push(dx - off, dy - off);
      }
    }
    return pts;
  }

  touch(x, y) {
    if (!this.dirty) this.dirty = [x, y, x + 1, y + 1];
    else {
      const d = this.dirty;
      if (x < d[0]) d[0] = x;
      if (y < d[1]) d[1] = y;
      if (x + 1 > d[2]) d[2] = x + 1;
      if (y + 1 > d[3]) d[3] = y + 1;
    }
  }

  /** Écrit un pixel final (sans symétrie). */
  put(x, y) {
    if (this.wrap) {
      x = ((x % this.w) + this.w) % this.w;
      y = ((y % this.h) + this.h) % this.h;
    } else if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.mask && !this.mask[i]) return;
    let c;
    if (this.dither) {
      if (this.dither(x, y)) c = this.erase ? 0 : this.color;
      else {
        if (this.color2 === null) return;
        c = this.erase ? this.target[i] : this.color2;
      }
    } else c = this.erase ? 0 : this.color;
    if (this.target[i] === c) return;
    this.target[i] = c;
    this.touch(x, y);
  }

  /** Pixel + copies symétriques. */
  plot(x, y) {
    this.put(x, y);
    const s = this.symmetry;
    if (s === 'none') return;
    const mx = Math.floor(2 * this.symX) - 1 - x;
    const my = Math.floor(2 * this.symY) - 1 - y;
    if (s === 'v' || s === 'both') this.put(mx, y);
    if (s === 'h' || s === 'both') this.put(x, my);
    if (s === 'both') this.put(mx, my);
  }

  dab(x, y) {
    const fp = this.footprint;
    for (let k = 0; k < fp.length; k += 2) this.plot(x + fp[k], y + fp[k + 1]);
  }

  line(x0, y0, x1, y1) {
    bresenham(x0, y0, x1, y1, (x, y) => this.dab(x, y));
  }

  flush() {
    if (!this.dirty) return;
    const d = this.dirty;
    this.dirty = null;
    if (this.wrap) this.app.markLayerDirty(this.target);
    else this.app.markLayerDirty(this.target, d[0], d[1], d[2], d[3]);
  }
}

/** Options de peinture communes, depuis l'état de l'éditeur. */
export function paintOptions(app, { erase = false, secondary = false, shapes = false } = {}) {
  const st = app.state;
  const primary = secondary ? app.colorU32('secondary') : app.colorU32('primary');
  const other = secondary ? app.colorU32('primary') : app.colorU32('secondary');
  return {
    color: primary,
    color2: st.dither ? (st.ditherSecond === 'secondary' ? other : null) : null,
    erase,
    size: shapes ? st.shapeSize : st.brushSize,
    shape: st.brushShape,
    dither: st.dither ? st.ditherPattern : null,
    mask: app.selection.floating ? null : app.selection.mask,
    symmetry: st.symmetry,
    symX: st.symX,
    symY: st.symY,
    wrap: st.tileMode && st.tileWrap,
  };
}
