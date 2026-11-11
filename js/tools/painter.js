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
    // état d'origine du calque (début du trait) : pixel perfect, remplacement, ombrage
    this.before = opts.before || null;
    this.onlyColor = opts.onlyColor ?? null; // ne peindre que sur cette couleur d'origine
    this.mapColor = opts.mapColor || null; // couleur finale = mapColor(couleur d'origine)
    this.alphaLock = !!opts.alphaLock; // verrou de transparence : ne peindre que sur les pixels existants
    // pinceau personnalisé (tampon) : { data, w, h, tint } ; tint = prendre la couleur active
    this.stamp = opts.stamp || null;
    this.cur = null; // couleur du pixel de tampon en cours
    this.lastDab = null;
    this.dirty = null;
    this.footprint = this._footprint();
  }

  /** Change la taille du pinceau en cours de trait (pression du stylet). */
  setSize(n) {
    n = Math.max(1, n | 0);
    if (n === this.size) return;
    this.size = n;
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
    const orig = this.before ? this.before[i] : this.target[i];
    if (this.onlyColor !== null && orig !== this.onlyColor) return;
    let c;
    if (this.mapColor) {
      c = this.mapColor(orig);
      if (c === null || c === undefined) return;
    } else if (this.dither) {
      if (this.dither(x, y)) c = this.erase ? 0 : this.cur ?? this.color;
      else {
        if (this.color2 === null) return;
        c = this.erase ? this.target[i] : this.color2;
      }
    } else c = this.erase ? 0 : this.cur ?? this.color;
    if (this.alphaLock) {
      const a0 = (this.before ? this.before[i] : this.target[i]) >>> 24;
      if (!a0 || !(c >>> 24)) return; // pas de nouveau pixel, pas d'effacement
      c = ((c & 0x00ffffff) | (a0 << 24)) >>> 0;
    }
    if (this.target[i] === c) return;
    this.target[i] = c;
    this.touch(x, y);
  }

  /** Appelle fn pour le pixel et ses copies symétriques. */
  forSym(x, y, fn) {
    fn(x, y);
    const s = this.symmetry;
    if (s === 'none') return;
    const mx = Math.floor(2 * this.symX) - 1 - x;
    const my = Math.floor(2 * this.symY) - 1 - y;
    if (s === 'v' || s === 'both') fn(mx, y);
    if (s === 'h' || s === 'both') fn(x, my);
    if (s === 'both') fn(mx, my);
  }

  /** Pixel + copies symétriques. */
  plot(x, y) {
    this.forSym(x, y, (a, b) => this.put(a, b));
  }

  /** Rétablit la couleur d'origine (pixel perfect). */
  restore(x, y) {
    if (!this.before) return;
    this.forSym(x, y, (a, b) => {
      if (this.wrap) {
        a = ((a % this.w) + this.w) % this.w;
        b = ((b % this.h) + this.h) % this.h;
      } else if (a < 0 || b < 0 || a >= this.w || b >= this.h) return;
      const i = b * this.w + a;
      if (this.target[i] !== this.before[i]) {
        this.target[i] = this.before[i];
        this.touch(a, b);
      }
    });
  }

  dab(x, y) {
    if (this.stamp) {
      // tampon centré sur le point, pixels d'origine ou teintés de la couleur active
      const s = this.stamp, ox = x - Math.floor(s.w / 2), oy = y - Math.floor(s.h / 2);
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
        const v = s.data[j * s.w + i];
        if (!(v >>> 24)) continue;
        this.cur = s.tint ? ((this.color & 0x00ffffff) | (v & 0xff000000)) >>> 0 : v;
        this.plot(ox + i, oy + j);
      }
      this.cur = null;
      this.lastDab = [x, y];
      return;
    }
    const fp = this.footprint;
    for (let k = 0; k < fp.length; k += 2) this.plot(x + fp[k], y + fp[k + 1]);
  }

  line(x0, y0, x1, y1) {
    if (this.stamp) {
      // tampon : un dépôt tous les ¾ de sa taille, sinon le motif se brouille
      const sp = Math.max(1, Math.ceil(Math.max(this.stamp.w, this.stamp.h) * 0.75));
      bresenham(x0, y0, x1, y1, (x, y) => {
        const l = this.lastDab;
        if (l && Math.max(Math.abs(x - l[0]), Math.abs(y - l[1])) < sp) return;
        this.dab(x, y);
      });
      return;
    }
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
    alphaLock: !!app.doc.activeLayer?.alphaLock,
    stamp: !shapes && st.brushShape === 'stamp' ? customBrush(st) : null,
  };
}

let brushCache = null;
/** Pinceau personnalisé enregistré dans les préférences ({ w, h, b64, tint }) -> tampon. */
export function customBrush(st) {
  const b = st.customBrush;
  if (!b || !b.b64) return null;
  if (!brushCache || brushCache.b64 !== b.b64) {
    const bin = atob(b.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    brushCache = { b64: b.b64, data: new Uint32Array(bytes.buffer), w: b.w, h: b.h };
  }
  return { data: brushCache.data, w: brushCache.w, h: brushCache.h, tint: st.brushTint !== false };
}

/** Enregistre un tampon (Uint32Array w×h) comme pinceau personnalisé. */
export function brushFromPixels(data, w, h) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, w * h * 4);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return { w, h, b64: btoa(bin) };
}
