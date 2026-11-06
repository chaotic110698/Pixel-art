// Rendu de la vue : damier, composition (cache par calque, redessin partiel),
// mosaïque (mode tuiles), onion skin, grilles, symétrie, sélection, curseur.

import { celCanvas, markDirty, createCanvas } from './celcache.js';
import { composeOnCtx } from './compose.js';
import { pixelsToCanvas } from './compose.js';

export class Renderer {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.composite = null;
    this.compCtx = null;
    this.dirty = null; // rectangle à recomposer
    this.pending = false;
    this.preview = null; // Uint32Array taille document (aperçus de formes)
    this.previewUsed = false;
    this.floatingCanvas = null;
    this.floatingVersion = -1;
    this.onion = { prev: null, next: null, version: -1 };
    this.version = 0;
    this.hover = null; // [x, y] doc
    this.checker = null;
    this._antsTimer = null;
  }

  get doc() {
    return this.app.doc;
  }

  ensureBuffers() {
    const { width: w, height: h } = this.doc;
    if (!this.composite || this.composite.width !== w || this.composite.height !== h) {
      this.composite = createCanvas(w, h);
      this.compCtx = this.composite.getContext('2d');
      this.preview = new Uint32Array(w * h);
      this.previewUsed = false;
      this.dirty = [0, 0, w, h];
    }
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.app.viewport.setSize(w, h);
    this.requestRender();
  }

  invalidate(x0 = 0, y0 = 0, x1 = Infinity, y1 = Infinity) {
    this.version++;
    if (!this.dirty) this.dirty = [x0, y0, x1, y1];
    else {
      const d = this.dirty;
      d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0);
      d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1);
    }
    this.requestRender();
  }

  invalidateAll() {
    this.invalidate(0, 0, Infinity, Infinity);
    this.onion.version = -1;
  }

  invalidateOverlay() {
    this.requestRender();
  }

  requestRender() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      try {
        this.render();
      } catch (err) {
        console.error('[render]', err);
      }
    });
  }

  // ---------- Aperçu (formes en cours) ----------
  clearPreview() {
    if (!this.preview) return;
    if (this.previewUsed) {
      this.preview.fill(0);
      markDirty(this.preview);
      this.previewUsed = false;
      this.invalidate();
    }
  }

  usePreview() {
    this.ensureBuffers();
    this.preview.fill(0);
    markDirty(this.preview);
    this.previewUsed = true;
    return this.preview;
  }

  // ---------- Composition ----------
  compose() {
    this.ensureBuffers();
    const doc = this.doc;
    const W = doc.width, H = doc.height;
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const x0 = Math.max(0, Math.floor(d[0])), y0 = Math.max(0, Math.floor(d[1]));
    const x1 = Math.min(W, Math.ceil(d[2])), y1 = Math.min(H, Math.ceil(d[3]));
    if (x1 <= x0 || y1 <= y0) return;
    const ctx = this.compCtx;
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    const sel = this.app.selection;
    const active = doc.activeLayer;
    const overlay = (c, opacity) => {
      if (this.previewUsed) {
        c.globalAlpha = opacity;
        c.drawImage(celCanvas(this.preview, W, H), 0, 0);
      }
      if (sel.floating) {
        const f = sel.floating;
        if (this.floatingVersion !== sel.version || !this.floatingCanvas) {
          const masked = new Uint32Array(f.w * f.h);
          for (let i = 0; i < masked.length; i++) masked[i] = f.mask[i] ? f.data[i] : 0;
          this.floatingCanvas = pixelsToCanvas(masked, f.w, f.h);
          this.floatingVersion = sel.version;
        }
        c.globalAlpha = opacity;
        c.drawImage(this.floatingCanvas, f.x, f.y);
      }
      c.globalAlpha = 1;
    };
    const shown = active && doc.isShown(active);
    composeOnCtx(ctx, doc, {
      rect: [x0, y0, x1, y1],
      after: shown ? { layerId: active.id, draw: overlay } : null,
    });
    if (!shown && (this.previewUsed || sel.floating)) overlay(ctx, 1);
    ctx.restore();
  }

  composeOnion() {
    const doc = this.doc;
    const st = this.app.state;
    if (!st.onion || doc.frames.length < 2) return;
    const key = this.version + ':' + doc.frame;
    if (this.onion.version === key) return;
    const mk = (f) => {
      if (f < 0 || f >= doc.frames.length) {
        if (!st.loopOnion) return null;
        f = (f + doc.frames.length) % doc.frames.length;
      }
      const c = createCanvas(doc.width, doc.height);
      composeOnCtx(c.getContext('2d'), doc, { frame: f, includeReference: false });
      return c;
    };
    this.onion.prev = mk(doc.frame - 1);
    this.onion.next = doc.frames.length > 2 || !st.loopOnion ? mk(doc.frame + 1) : null;
    this.onion.version = key;
  }

  checkerPattern(ctx) {
    const s = 8;
    if (!this.checker) {
      const c = document.createElement('canvas');
      c.width = c.height = s * 2;
      const g = c.getContext('2d');
      const dark = this.app.state.theme === 'dark';
      g.fillStyle = dark ? '#6a6a78' : '#ffffff';
      g.fillRect(0, 0, s * 2, s * 2);
      g.fillStyle = dark ? '#575764' : '#d9dbe4';
      g.fillRect(0, 0, s, s);
      g.fillRect(s, s, s, s);
      this.checker = c;
    }
    return ctx.createPattern(this.checker, 'repeat');
  }

  resetTheme() {
    this.checker = null;
    this.requestRender();
  }

  // ---------- Vue ----------
  render() {
    const app = this.app;
    const doc = this.doc;
    if (!doc) return;
    this.ensureBuffers();
    this.compose();
    const st = app.state;
    const vp = app.viewport;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const z = vp.zoom;
    const W = doc.width, H = doc.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;

    // position en pixels physiques, arrondie pour des pixels nets
    const ox = Math.round(vp.ox * dpr);
    const oy = Math.round(vp.oy * dpr);
    const zd = z * dpr;
    const dw = Math.round(W * zd), dh = Math.round(H * zd);

    const tiles = st.tileMode ? [-1, 0, 1] : [0];
    const pattern = this.checkerPattern(ctx);
    for (const ty of tiles) {
      for (const tx of tiles) {
        const x = ox + tx * dw, y = oy + ty * dh;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, dw, dh);
        ctx.restore();
      }
    }
    // images de référence nettes (pleine résolution) : sous ou sur le dessin
    const refs = this.referenceImages();
    this.drawRefs(ctx, refs.below, ox, oy, zd, dw, dh);
    if (st.onion && doc.frames.length > 1) {
      this.composeOnion();
      if (this.onion.prev) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(this.onion.prev, ox, oy, dw, dh);
      }
      if (this.onion.next) {
        ctx.globalAlpha = 0.16;
        ctx.drawImage(this.onion.next, ox, oy, dw, dh);
      }
      ctx.globalAlpha = 1;
    }
    for (const ty of tiles) {
      for (const tx of tiles) {
        ctx.globalAlpha = tx || ty ? st.tileDim : 1;
        ctx.drawImage(this.composite, ox + tx * dw, oy + ty * dh, dw, dh);
      }
    }
    ctx.globalAlpha = 1;
    this.drawRefs(ctx, refs.above, ox, oy, zd, dw, dh);
    if (st.tileMode) {
      ctx.strokeStyle = 'rgba(255,90,180,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox - 0.5, oy - 0.5, dw + 1, dh + 1);
    }

    // grille de pixels (zoom élevé)
    const grid = doc.grid;
    const view = { x0: 0, y0: 0, x1: this.canvas.width, y1: this.canvas.height };
    if (grid.pixelGrid && st.showPixelGrid && zd >= 10) {
      ctx.fillStyle = st.theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';
      this.drawLines(ctx, ox, oy, zd, W, H, 1, 1, 0, 0, 1, view, 0);
    }
    if (grid.visible && st.gridOn !== false) {
      ctx.globalAlpha = grid.opacity;
      const th = Math.max(1, Math.round(grid.thickness * dpr));
      const mth = Math.max(1, Math.round(grid.majorThickness * dpr));
      const N = Math.max(0, grid.majorEvery | 0);
      ctx.fillStyle = grid.color;
      this.drawLines(ctx, ox, oy, zd, W, H, grid.cellW, grid.cellH, grid.offsetX, grid.offsetY, th, view, N, false);
      if (N > 0) {
        ctx.fillStyle = grid.majorColor || grid.color;
        this.drawLines(ctx, ox, oy, zd, W, H, grid.cellW, grid.cellH, grid.offsetX, grid.offsetY, mth, view, N, true);
      }
      ctx.globalAlpha = 1;
    }

    // axes de symétrie
    const sym = st.symmetry;
    if (sym !== 'none') {
      ctx.fillStyle = 'rgba(0,200,255,0.8)';
      const ax = st.symX ?? W / 2, ay = st.symY ?? H / 2;
      if (sym === 'v' || sym === 'both') ctx.fillRect(Math.round(ox + ax * zd) - 1, oy, 2, dh);
      if (sym === 'h' || sym === 'both') ctx.fillRect(ox, Math.round(oy + ay * zd) - 1, dw, 2);
    }

    // contour de sélection (fourmis)
    const sel = app.selection;
    if (sel.active) {
      const segs = sel.edges();
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      for (const [ax, ay, bx, by] of segs) {
        ctx.moveTo(Math.round(ox + ax * zd) + 0.5, Math.round(oy + ay * zd) + 0.5);
        ctx.lineTo(Math.round(ox + bx * zd) + 0.5, Math.round(oy + by * zd) + 0.5);
      }
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.strokeStyle = '#000';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.lineDashOffset = -((performance.now() / 60) % (8 * dpr));
      ctx.stroke();
      ctx.setLineDash([]);
      this.startAnts();
    } else this.stopAnts();

    // surcouche de l'outil (lasso en cours, etc.)
    const tool = app.tools?.current;
    ctx.save();
    if (tool?.drawOverlay) tool.drawOverlay(ctx, { ox, oy, zd, dpr });
    ctx.restore();

    // curseur pinceau
    if (this.hover && tool?.showBrush && !app.input?.gesture) {
      const size = tool.brushSize ? tool.brushSize() : 1;
      const [hx, hy] = this.hover;
      const off = Math.floor((size - 1) / 2);
      const x = Math.round(ox + (hx - off) * zd), y = Math.round(oy + (hy - off) * zd);
      const s = Math.round(size * zd);
      ctx.lineWidth = Math.max(1, dpr);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeRect(x - 0.5, y - 0.5, s + 1, s + 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    }
    app.emit('rendered');
  }

  /**
   * Calques de référence portant une image (refImg) : ceux placés sous le premier
   * calque normal s'affichent sous le dessin, les autres par-dessus.
   */
  referenceImages() {
    const below = [], above = [];
    let seenNormal = false;
    for (const { layer, opacity } of this.doc.renderList({ includeReference: true })) {
      if (!layer.reference || !layer.refImg) {
        seenNormal = true;
        continue;
      }
      (seenNormal ? above : below).push({ ref: layer.refImg, opacity });
    }
    return { below, above };
  }

  refImage(src) {
    if (!this._refCache) this._refCache = new Map();
    let img = this._refCache.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => this.requestRender();
      img.src = src;
      this._refCache.set(src, img);
      if (this._refCache.size > 12) this._refCache.delete(this._refCache.keys().next().value);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  drawRefs(ctx, list, ox, oy, zd, dw, dh) {
    if (!list.length) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, dw, dh);
    ctx.clip();
    ctx.imageSmoothingEnabled = true; // une référence (photo, croquis) reste lisse
    for (const { ref, opacity } of list) {
      const img = this.refImage(ref.src);
      if (!img) continue;
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, ox + ref.x * zd, oy + ref.y * zd, ref.w * ref.scale * zd, ref.h * ref.scale * zd);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
  }

  /** Dessine les lignes d'une grille (fillRect = net) ; major : filtre sur lignes principales. */
  drawLines(ctx, ox, oy, zd, W, H, cw, ch, offX, offY, th, view, N, major = null) {
    cw = Math.max(1, cw);
    ch = Math.max(1, ch);
    const half = Math.floor(th / 2);
    const left = Math.max(ox, view.x0), right = Math.min(ox + W * zd, view.x1);
    const top = Math.max(oy, view.y0), bottom = Math.min(oy + H * zd, view.y1);
    if (right <= left || bottom <= top) return;
    // si trop dense, on n'affiche que les lignes principales
    const dense = cw * zd < 4 || ch * zd < 4;
    if (dense && major === false) return;
    const kx0 = Math.ceil((0 - offX) / cw), kx1 = Math.floor((W - offX) / cw);
    for (let k = kx0; k <= kx1; k++) {
      const isMajor = N > 0 && ((k % N) + N) % N === 0;
      if (major === true && !isMajor) continue;
      if (major === false && isMajor) continue;
      const x = Math.round(ox + (offX + k * cw) * zd);
      if (x < view.x0 - th || x > view.x1 + th) continue;
      ctx.fillRect(x - half, top, th, bottom - top);
    }
    const ky0 = Math.ceil((0 - offY) / ch), ky1 = Math.floor((H - offY) / ch);
    for (let k = ky0; k <= ky1; k++) {
      const isMajor = N > 0 && ((k % N) + N) % N === 0;
      if (major === true && !isMajor) continue;
      if (major === false && isMajor) continue;
      const y = Math.round(oy + (offY + k * ch) * zd);
      if (y < view.y0 - th || y > view.y1 + th) continue;
      ctx.fillRect(left, y - half, right - left, th);
    }
  }

  startAnts() {
    if (this._antsTimer) return;
    this._antsTimer = setInterval(() => this.requestRender(), 120);
  }

  stopAnts() {
    if (!this._antsTimer) return;
    clearInterval(this._antsTimer);
    this._antsTimer = null;
  }
}
