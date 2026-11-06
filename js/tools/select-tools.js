// Sélection rectangulaire, lasso, baguette magique, déplacement, main.

import { Tool } from './paint-tools.js';
import { polygonMask, floodMask } from '../core/raster.js';
import { pixelAt } from '../render/compose.js';

function selOp(app, p) {
  if (p.shift) return 'add';
  if (p.alt) return 'subtract';
  return app.state.selectMode;
}

/** Comportement commun : glisser à l'intérieur de la sélection = déplacer. */
class SelectBase extends Tool {
  cursor = 'crosshair';
  tryStartMove(p) {
    const sel = this.app.selection;
    if (p.shift || p.alt || this.app.state.selectMode !== 'replace') return false;
    if (!sel.contains(p.ix, p.iy)) return false;
    if (!sel.floating && !sel.lift(p.ctrl)) return false;
    this.moving = { last: [p.ix, p.iy] };
    return true;
  }
  moveDrag(p) {
    const m = this.moving;
    const dx = p.ix - m.last[0], dy = p.iy - m.last[1];
    if (dx || dy) {
      this.app.selection.moveFloating(dx, dy);
      m.last = [p.ix, p.iy];
    }
  }
  cancel() {
    this.moving = null;
    this.drag = null;
    this.app.renderer.requestRender();
  }
}

export class RectSelectTool extends SelectBase {
  id = 'select';
  name = 'Sélection rectangle';
  key = 'M';
  down(p) {
    if (this.tryStartMove(p)) return;
    this.app.selection.commitFloating();
    const snap = this.app.gridSnapOn();
    this.drag = { start: snap ? this.app.snapPoint(p.x, p.y) : [p.ix, p.iy], end: null, op: selOp(this.app, p), snap };
  }
  move(p) {
    if (this.moving) return this.moveDrag(p);
    if (!this.drag) return;
    this.drag.end = this.drag.snap ? this.app.snapPoint(p.x, p.y) : [p.ix, p.iy];
    if (p.shift && this.drag.op !== 'add') {
      const [sx, sy] = this.drag.start;
      const d = Math.max(Math.abs(this.drag.end[0] - sx), Math.abs(this.drag.end[1] - sy));
      this.drag.end = [sx + Math.sign(this.drag.end[0] - sx || 1) * d, sy + Math.sign(this.drag.end[1] - sy || 1) * d];
    }
    this.app.renderer.requestRender();
  }
  rect() {
    const { start, end, snap } = this.drag;
    let [x0, y0] = start, [x1, y1] = end;
    if (snap) {
      if (x0 === x1 || y0 === y1) return null;
      return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1) - 1, Math.max(y0, y1) - 1];
    }
    return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
  }
  up() {
    if (this.moving) {
      this.moving = null;
      return;
    }
    if (!this.drag) return;
    const sel = this.app.selection;
    if (!this.drag.end || (this.drag.end[0] === this.drag.start[0] && this.drag.end[1] === this.drag.start[1] && !this.drag.snap)) {
      if (this.drag.op === 'replace') sel.deselect();
    } else {
      const r = this.rect();
      if (r) sel.apply(sel.rectMask(...r), this.drag.op);
    }
    this.drag = null;
    this.app.renderer.requestRender();
  }
  drawOverlay(ctx, { ox, oy, zd, dpr }) {
    if (!this.drag || !this.drag.end) return;
    const r = this.rect();
    if (!r) return;
    const [x0, y0, x1, y1] = r;
    ctx.lineWidth = dpr;
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.strokeRect(Math.round(ox + x0 * zd) + 0.5, Math.round(oy + y0 * zd) + 0.5, Math.round((x1 - x0 + 1) * zd), Math.round((y1 - y0 + 1) * zd));
    ctx.setLineDash([]);
  }
}

export class LassoTool extends SelectBase {
  id = 'lasso';
  name = 'Lasso';
  key = 'Q';
  down(p) {
    if (this.tryStartMove(p)) return;
    this.app.selection.commitFloating();
    this.drag = { pts: [[p.ix, p.iy]], op: selOp(this.app, p) };
  }
  move(p) {
    if (this.moving) return this.moveDrag(p);
    if (!this.drag) return;
    const last = this.drag.pts[this.drag.pts.length - 1];
    if (last[0] !== p.ix || last[1] !== p.iy) this.drag.pts.push([p.ix, p.iy]);
    this.app.renderer.requestRender();
  }
  up() {
    if (this.moving) {
      this.moving = null;
      return;
    }
    if (!this.drag) return;
    const sel = this.app.selection;
    const { pts, op } = this.drag;
    this.drag = null;
    if (pts.length < 3) {
      if (op === 'replace') sel.deselect();
    } else sel.apply(polygonMask(pts, this.doc.width, this.doc.height), op);
    this.app.renderer.requestRender();
  }
  drawOverlay(ctx, { ox, oy, zd, dpr }) {
    if (!this.drag) return;
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = '#ff5ab4';
    ctx.beginPath();
    this.drag.pts.forEach(([x, y], i) => {
      const sx = ox + (x + 0.5) * zd, sy = oy + (y + 0.5) * zd;
      if (i) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    });
    ctx.stroke();
  }
}

export class WandTool extends SelectBase {
  id = 'wand';
  name = 'Baguette magique';
  key = 'W';
  down(p) {
    if (this.tryStartMove(p)) return;
    const app = this.app;
    const doc = this.doc;
    app.selection.commitFloating();
    const { width: w, height: h } = doc;
    if (p.ix < 0 || p.iy < 0 || p.ix >= w || p.iy >= h) return;
    let src;
    if (app.state.wandSampleAll) {
      src = new Uint32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) src[y * w + x] = pixelAt(doc, x, y);
    } else {
      const l = doc.activeLayer;
      if (!l) return;
      src = doc.cel(l);
    }
    const m = floodMask(src, w, h, p.ix, p.iy, { contiguous: app.state.wandContiguous, tolerance: app.state.fillTolerance / 100 });
    app.selection.apply(m, selOp(app, p));
  }
  move(p) {
    if (this.moving) this.moveDrag(p);
  }
  up() {
    this.moving = null;
  }
}

export class MoveTool extends Tool {
  id = 'move';
  name = 'Déplacer';
  key = 'V';
  cursor = 'move';
  down(p) {
    const sel = this.app.selection;
    if (!sel.floating && !sel.lift(p.ctrl || p.alt)) return;
    this.last = [p.ix, p.iy];
  }
  move(p) {
    if (!this.last) return;
    const dx = p.ix - this.last[0], dy = p.iy - this.last[1];
    if (dx || dy) {
      this.app.selection.moveFloating(dx, dy);
      this.last = [p.ix, p.iy];
    }
  }
  up() {
    this.last = null;
  }
  cancel() {
    this.last = null;
  }
}

export class HandTool extends Tool {
  id = 'hand';
  name = 'Main (déplacer la vue)';
  key = 'H';
  cursor = 'grab';
  down(p) {
    this.last = [p.sx, p.sy];
  }
  move(p) {
    if (!this.last) return;
    this.app.viewport.panBy(p.sx - this.last[0], p.sy - this.last[1]);
    this.last = [p.sx, p.sy];
  }
  up() {
    this.last = null;
  }
}
