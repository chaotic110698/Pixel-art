// Transformation écran <-> document (zoom, déplacement).

export const ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128];

export class Viewport {
  constructor(app) {
    this.app = app;
    this.zoom = 8;
    this.ox = 0; // position écran (px CSS) de l'origine du document
    this.oy = 0;
    this.cw = 300; // taille du canvas vue (px CSS)
    this.ch = 300;
  }

  setSize(w, h) {
    this.cw = w;
    this.ch = h;
  }

  toDoc(sx, sy) {
    return [(sx - this.ox) / this.zoom, (sy - this.oy) / this.zoom];
  }

  toScreen(dx, dy) {
    return [this.ox + dx * this.zoom, this.oy + dy * this.zoom];
  }

  zoomAt(z, sx = this.cw / 2, sy = this.ch / 2) {
    z = Math.max(0.1, Math.min(160, z));
    const [dx, dy] = this.toDoc(sx, sy);
    this.zoom = z;
    this.ox = sx - dx * z;
    this.oy = sy - dy * z;
    this.changed();
  }

  stepZoom(dir, sx, sy) {
    const z = this.zoom;
    let next;
    if (dir > 0) next = ZOOM_STEPS.find((s) => s > z + 1e-6) ?? z * 1.25;
    else next = [...ZOOM_STEPS].reverse().find((s) => s < z - 1e-6) ?? z / 1.25;
    this.zoomAt(next, sx, sy);
  }

  panBy(dx, dy) {
    this.ox += dx;
    this.oy += dy;
    this.changed();
  }

  fit(margin = 24) {
    const doc = this.app.doc;
    const tile = this.app.state.tileMode ? 3 : 1;
    const zw = (this.cw - margin * 2) / (doc.width * tile);
    const zh = (this.ch - margin * 2) / (doc.height * tile);
    let z = Math.min(zw, zh);
    // zoom entier quand c'est possible : pixels réguliers
    z = z >= 1 ? Math.floor(z) : ZOOM_STEPS.filter((s) => s <= z).pop() || z;
    this.zoom = Math.max(0.1, z);
    this.center();
  }

  center() {
    const doc = this.app.doc;
    this.ox = Math.round((this.cw - doc.width * this.zoom) / 2);
    this.oy = Math.round((this.ch - doc.height * this.zoom) / 2);
    this.changed();
  }

  actualSize() {
    this.zoom = 1;
    this.center();
  }

  changed() {
    this.app.renderer?.requestRender();
    this.app.emit('viewport');
  }
}
