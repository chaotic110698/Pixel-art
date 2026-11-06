// Ligne, rectangle, ellipse (plein ou contour), avec aperçu en direct.

import { Tool } from './paint-tools.js';
import { Painter, paintOptions } from './painter.js';
import { constrainLine, rectPixels, ellipsePixels } from '../core/raster.js';

class ShapeTool extends Tool {
  showBrush = true;
  cursor = 'crosshair';
  brushSize() {
    return this.app.state.shapeSize;
  }
  down(p) {
    const layer = this.app.editableLayer();
    if (!layer) return;
    this.app.selection.commitFloating();
    this.layer = layer;
    this.secondary = p.button === 2;
    this.start = this.startPoint(p);
    this.end = this.start;
    this.drawPreview(p);
  }
  move(p) {
    if (!this.start) return;
    this.drawPreview(p);
  }
  drawPreview(p) {
    const app = this.app;
    const buf = app.renderer.usePreview();
    this.end = this.endPoint(p);
    const painter = new Painter(app, buf, paintOptions(app, { secondary: this.secondary, shapes: true }));
    this.shape(painter, this.start, this.end, p);
    app.renderer.invalidate();
  }
  up(p) {
    if (!this.start) return;
    const app = this.app;
    app.renderer.clearPreview();
    const token = app.history.beginPixels(this.layer);
    const painter = new Painter(app, token.cel, paintOptions(app, { secondary: this.secondary, shapes: true }));
    this.shape(painter, this.start, this.endPoint(p), p);
    painter.flush();
    app.history.endPixels(token, this.name);
    app.useColor();
    this.start = null;
  }
  cancel() {
    this.app.renderer.clearPreview();
    this.start = null;
  }
  startPoint(p) {
    return [p.ix, p.iy];
  }
  endPoint(p) {
    return [p.ix, p.iy];
  }
}

export class LineTool extends ShapeTool {
  id = 'line';
  name = 'Ligne';
  key = 'L';
  // avec l'aimantation, les extrémités se calent sur les intersections de la grille
  snapped(p) {
    const [x, y] = this.app.snapPoint(p.x, p.y);
    const d = this.app.doc;
    return [Math.max(0, Math.min(d.width - 1, x)), Math.max(0, Math.min(d.height - 1, y))];
  }
  startPoint(p) {
    return this.app.gridSnapOn() ? this.snapped(p) : [p.ix, p.iy];
  }
  endPoint(p) {
    const [x, y] = this.app.gridSnapOn() ? this.snapped(p) : [p.ix, p.iy];
    if (p.shift) return constrainLine(this.start[0], this.start[1], x, y);
    return [x, y];
  }
  shape(painter, a, b) {
    painter.line(a[0], a[1], b[0], b[1]);
  }
}

class BoxTool extends ShapeTool {
  // coins en coordonnées continues pour l'aimantation à la grille
  startPoint(p) {
    if (this.app.gridSnapOn()) return this.app.snapPoint(p.x, p.y);
    return [p.ix, p.iy];
  }
  endPoint(p) {
    const app = this.app;
    let ex, ey;
    if (app.gridSnapOn()) {
      const [sx, sy] = app.snapPoint(p.x, p.y);
      ex = sx; ey = sy;
    } else {
      ex = p.ix; ey = p.iy;
    }
    if (p.shift) {
      const dx = ex - this.start[0], dy = ey - this.start[1];
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      ex = this.start[0] + Math.sign(dx || 1) * d;
      ey = this.start[1] + Math.sign(dy || 1) * d;
    }
    return [ex, ey];
  }
  box(a, b) {
    let [x0, y0] = a, [x1, y1] = b;
    if (this.app.gridSnapOn()) {
      // avec aimantation, les points sont des bords de cellules : bornes exclusives
      if (x1 === x0) x1 = x0 + 1;
      if (y1 === y0) y1 = y0 + 1;
      return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1) - 1, Math.max(y0, y1) - 1];
    }
    return [x0, y0, x1, y1];
  }
}

export class RectTool extends BoxTool {
  id = 'rect';
  name = 'Rectangle';
  key = 'U';
  shape(painter, a, b) {
    const [x0, y0, x1, y1] = this.box(a, b);
    const filled = this.app.state.shapeFill;
    if (filled || painter.size === 1) rectPixels(x0, y0, x1, y1, filled, (x, y) => painter.plot(x, y));
    else rectPixels(x0, y0, x1, y1, false, (x, y) => painter.dab(x, y));
  }
}

export class EllipseTool extends BoxTool {
  id = 'ellipse';
  name = 'Ellipse';
  key = 'O';
  shape(painter, a, b) {
    const [x0, y0, x1, y1] = this.box(a, b);
    const filled = this.app.state.shapeFill;
    if (filled || painter.size === 1) ellipsePixels(x0, y0, x1, y1, filled, (x, y) => painter.plot(x, y));
    else ellipsePixels(x0, y0, x1, y1, false, (x, y) => painter.dab(x, y));
  }
}
