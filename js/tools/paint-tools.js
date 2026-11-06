// Crayon, gomme, remplissage, pipette.

import { Painter, paintOptions } from './painter.js';
import { floodMask, ditherFn, bresenham } from '../core/raster.js';
import { hexToU32, toRgba, rgbToHsl } from '../util/color.js';
import { pixelAt } from '../render/compose.js';
import { u32ToHex } from '../util/color.js';

export class Tool {
  constructor(app) {
    this.app = app;
  }
  get doc() {
    return this.app.doc;
  }
  down() {}
  move() {}
  up() {}
  cancel() {}
  hover() {}
  deactivate() {}
}

export class PencilTool extends Tool {
  id = 'pencil';
  name = 'Crayon';
  key = 'B';
  showBrush = true;
  cursor = 'crosshair';
  erase = false;
  brushSize() {
    return this.app.state.brushSize;
  }
  /** Options propres à l'outil (remplacement, ombrage) — surchargé par les sous-classes. */
  extraOptions(p, token) {
    const st = this.app.state;
    if (!this.erase && st.pencilMode === 'replace') {
      // ne peint que sur la couleur présente sous le premier point du trait
      const i = p.iy * this.doc.width + p.ix;
      return { onlyColor: p.ix >= 0 && p.iy >= 0 && p.ix < this.doc.width && p.iy < this.doc.height ? token.before[i] : null };
    }
    return {};
  }
  pixelPerfect() {
    const st = this.app.state;
    return st.pixelPerfect && st.brushSize === 1;
  }
  down(p) {
    const app = this.app;
    const layer = app.editableLayer();
    if (!layer) return;
    app.selection.commitFloating();
    this.token = app.history.beginPixels(layer);
    const extra = this.extraOptions(p, this.token);
    if (extra === null) {
      this.token = null;
      return;
    }
    this.painter = new Painter(app, this.token.cel, { ...paintOptions(app, { erase: this.erase, secondary: p.button === 2 }), before: this.token.before, ...extra });
    this.last = [p.ix, p.iy];
    this.trail = [[p.ix, p.iy]];
    this.lineStart = p.shift && this.prevEnd ? this.prevEnd : null;
    if (this.lineStart) this.painter.line(this.lineStart[0], this.lineStart[1], p.ix, p.iy);
    else this.painter.dab(p.ix, p.iy);
    this.painter.flush();
  }
  move(p) {
    if (!this.painter) return;
    const [lx, ly] = this.last;
    if (lx === p.ix && ly === p.iy) return;
    if (this.pixelPerfect()) {
      // pixel perfect : on retire le pixel du milieu des « coins en L »
      bresenham(lx, ly, p.ix, p.iy, (x, y) => {
        const t = this.trail;
        const prev = t[t.length - 1];
        if (prev && prev[0] === x && prev[1] === y) return;
        this.painter.dab(x, y);
        t.push([x, y]);
        if (t.length >= 3) {
          const [a, b, c] = t.slice(-3);
          if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1 &&
            (b[0] === a[0] || b[0] === c[0]) && (b[1] === a[1] || b[1] === c[1])) {
            this.painter.restore(b[0], b[1]);
            t.splice(t.length - 2, 1);
          }
        }
        if (t.length > 8) t.splice(0, t.length - 8);
      });
    } else this.painter.line(lx, ly, p.ix, p.iy);
    this.painter.flush();
    this.last = [p.ix, p.iy];
  }
  up() {
    if (!this.painter) return;
    this.prevEnd = this.last;
    this.app.history.endPixels(this.token, this.erase ? 'Gomme' : 'Crayon');
    if (!this.erase) this.app.useColor();
    this.painter = null;
    this.token = null;
  }
  cancel() {
    if (!this.token) return;
    this.app.history.abortPixels(this.token);
    this.painter = null;
    this.token = null;
  }
}

export class EraserTool extends PencilTool {
  id = 'eraser';
  name = 'Gomme';
  key = 'E';
  erase = true;
}

export class FillTool extends Tool {
  id = 'fill';
  name = 'Remplissage';
  key = 'G';
  cursor = 'crosshair';
  down(p) {
    const app = this.app;
    const doc = this.doc;
    const layer = app.editableLayer();
    if (!layer) return;
    app.selection.commitFloating();
    const { width: w, height: h } = doc;
    if (p.ix < 0 || p.iy < 0 || p.ix >= w || p.iy >= h) return;
    const st = app.state;
    const token = app.history.beginPixels(layer);
    const cel = token.cel;
    let source = cel;
    if (st.fillSampleAll) {
      source = new Uint32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) source[y * w + x] = pixelAt(doc, x, y);
    }
    const mask = floodMask(source, w, h, p.ix, p.iy, {
      contiguous: st.fillContiguous,
      limit: app.selection.mask,
      tolerance: st.fillTolerance / 100,
    });
    const opts = paintOptions(app, { secondary: p.button === 2 });
    const pat = opts.dither ? ditherFn(opts.dither) : null;
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      if (pat) {
        const x = i % w, y = (i / w) | 0;
        if (pat(x, y)) cel[i] = opts.color;
        else if (opts.color2 !== null) cel[i] = opts.color2;
      } else cel[i] = opts.color;
    }
    app.markLayerDirty(cel);
    app.history.endPixels(token, 'Remplissage');
    app.useColor();
  }
}

export class PickerTool extends Tool {
  id = 'picker';
  name = 'Pipette';
  key = 'I';
  cursor = 'copy';
  down(p) {
    this.pick(p);
  }
  move(p) {
    this.pick(p, true);
  }
  pick(p, quiet = false) {
    const app = this.app;
    const doc = this.doc;
    // hors du dessin : on ignore simplement
    if (p.ix < 0 || p.iy < 0 || p.ix >= doc.width || p.iy >= doc.height) return;
    let c;
    if (app.state.pickerSampleAll) c = pixelAt(doc, p.ix, p.iy);
    else {
      const l = doc.activeLayer;
      if (!l) return;
      c = doc.cel(l)[p.iy * doc.width + p.ix];
    }
    if (!(c >>> 24)) {
      if (!quiet) app.toast('Pixel transparent', 700);
      return;
    }
    app.setColor(p.button === 2 ? 'secondary' : 'primary', u32ToHex(c));
  }
  up() {
    if (this.app.state.pickerReturn && this.app.tools.previous) this.app.tools.select(this.app.tools.previous);
  }
}

// ---------- Ombrage : éclaircir / assombrir en suivant la palette ----------
function colorInfo(c) {
  const [r, g, b] = toRgba(c);
  const [hh, s, l] = rgbToHsl(r, g, b);
  return { c, h: hh, s, l };
}

/** Couleur voisine dans la palette : un cran plus claire (dir > 0) ou plus foncée. */
export function makeShadeMap(palette, dir) {
  const cols = [...new Set(palette.map((x) => hexToU32(x) | 0xff000000).map((x) => x >>> 0))].map(colorInfo);
  const cache = new Map();
  return (c) => {
    if (!(c >>> 24)) return null;
    if (cache.has(c)) return cache.get(c);
    const a = colorInfo((c | 0xff000000) >>> 0);
    let best = null, bestScore = Infinity;
    for (const b of cols) {
      const dl = (b.l - a.l) * dir;
      if (dl < 0.02) continue; // doit aller dans le bon sens
      let dh = Math.abs(b.h - a.h);
      if (dh > 180) dh = 360 - dh;
      const sat = Math.min(a.s, b.s);
      const score = dl + (dh / 180) * sat * 0.9 + Math.abs(b.s - a.s) * 0.25;
      if (score < bestScore) { bestScore = score; best = b.c; }
    }
    // l'alpha d'origine est conservé
    const out = best === null ? null : ((best & 0x00ffffff) | (c & 0xff000000)) >>> 0;
    cache.set(c, out);
    return out;
  };
}

export class ShadeTool extends PencilTool {
  id = 'shade';
  name = 'Ombrage';
  key = 'K';
  extraOptions(p) {
    const app = this.app;
    const pal = app.doc.palette || [];
    if (pal.length < 2) {
      app.toast('L\'ombrage parcourt la palette : ajoutez-y des teintes claires et foncées');
      return null;
    }
    let dir = app.state.shadeMode === 'darken' ? -1 : 1;
    if (p.button === 2) dir = -dir;
    return { mapColor: makeShadeMap(pal, dir), dither: null, color2: null };
  }
  up() {
    if (!this.painter) return;
    this.prevEnd = this.last;
    this.app.history.endPixels(this.token, 'Ombrage');
    this.painter = null;
    this.token = null;
  }
}

// ---------- Dégradé tramé ----------
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class GradientTool extends Tool {
  id = 'gradient';
  name = 'Dégradé';
  key = 'J';
  cursor = 'crosshair';
  down(p) {
    const layer = this.app.editableLayer();
    if (!layer) return;
    this.app.selection.commitFloating();
    this.layer = layer;
    this.start = [p.x, p.y];
    this.secondary = p.button === 2;
    this.area = this.computeArea(p);
    this.drawInto(this.app.renderer.usePreview(), [p.x, p.y]);
  }
  computeArea(p) {
    const app = this.app;
    const doc = this.doc;
    const { width: w, height: h } = doc;
    if (app.selection.mask) return app.selection.mask;
    if (app.state.gradientArea === 'region' && p.ix >= 0 && p.iy >= 0 && p.ix < w && p.iy < h) {
      return floodMask(doc.cel(this.layer), w, h, p.ix, p.iy, { contiguous: true });
    }
    return null; // tout le calque
  }
  drawInto(buf, end) {
    const app = this.app;
    const doc = this.doc;
    const { width: w, height: h } = doc;
    let a = app.colorU32('primary'), b = app.colorU32('secondary');
    if (this.secondary) [a, b] = [b, a];
    const [x0, y0] = this.start;
    const dx = end[0] - x0, dy = end[1] - y0;
    const len2 = dx * dx + dy * dy || 1;
    const len = Math.sqrt(len2);
    const radial = app.state.gradientShape === 'radial';
    const dithered = app.state.gradientDither !== false;
    const levels = 16;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (this.area && !this.area[i]) continue;
        const px = x + 0.5 - x0, py = y + 0.5 - y0;
        let t = radial ? Math.sqrt(px * px + py * py) / len : (px * dx + py * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const thr = dithered ? (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / levels : 0.5;
        buf[i] = t > thr ? b : a;
      }
    }
  }
  move(p) {
    if (!this.start) return;
    this.end = [p.x, p.y];
    this.drawInto(this.app.renderer.usePreview(), this.end);
    this.app.renderer.invalidate();
  }
  up(p) {
    if (!this.start) return;
    const app = this.app;
    app.renderer.clearPreview();
    const token = app.history.beginPixels(this.layer);
    const tmp = new Uint32Array(token.cel.length);
    this.drawInto(tmp, [p.x, p.y]);
    for (let i = 0; i < tmp.length; i++) if (!this.area || this.area[i]) token.cel[i] = tmp[i];
    app.markLayerDirty(token.cel);
    app.history.endPixels(token, 'Dégradé');
    app.useColor();
    this.start = null;
  }
  cancel() {
    this.app.renderer.clearPreview();
    this.start = null;
  }
}
