// Crayon, gomme, remplissage, pipette.

import { Painter, paintOptions } from './painter.js';
import { floodMask, ditherFn } from '../core/raster.js';
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
  down(p) {
    const app = this.app;
    const layer = app.editableLayer();
    if (!layer) return;
    app.selection.commitFloating();
    this.token = app.history.beginPixels(layer);
    this.painter = new Painter(app, this.token.cel, paintOptions(app, { erase: this.erase, secondary: p.button === 2 }));
    this.last = [p.ix, p.iy];
    this.lineStart = p.shift && this.prevEnd ? this.prevEnd : null;
    if (this.lineStart) this.painter.line(this.lineStart[0], this.lineStart[1], p.ix, p.iy);
    else this.painter.dab(p.ix, p.iy);
    this.painter.flush();
  }
  move(p) {
    if (!this.painter) return;
    const [lx, ly] = this.last;
    if (lx === p.ix && ly === p.iy) return;
    this.painter.line(lx, ly, p.ix, p.iy);
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
