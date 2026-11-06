// Gestion unifiée souris / tactile / stylet (Pointer Events).
// 1 doigt = dessiner, 2 doigts = zoom + déplacement, tape à 2 doigts = annuler,
// tape à 3 doigts = rétablir. Souris : molette = zoom, clic milieu ou
// espace+glisser = déplacer, clic droit = couleur secondaire, Alt = pipette.

export class Input {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;
    this.pointers = new Map();
    this.drawingId = null;
    this.gesture = null;
    this.panning = null;
    this.spaceDown = false;
    this.altPick = false;
    this.lastP = null;
    this.bind();
  }

  makeP(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const [x, y] = this.app.viewport.toDoc(sx, sy);
    return {
      x, y, sx, sy,
      ix: Math.floor(x), iy: Math.floor(y),
      button: e.button === 2 || (e.buttons & 2 && e.button !== 0) ? 2 : 0,
      shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey,
      pointerType: e.pointerType,
      pressure: e.pressure,
    };
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('pointerleave', () => {
      if (this.drawingId === null) {
        this.app.renderer.hover = null;
        this.app.renderer.requestRender();
      }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    // Safari : gestes natifs
    c.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !isTyping(e)) {
        if (!this.spaceDown) {
          this.spaceDown = true;
          this.updateCursor();
        }
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        this.updateCursor();
      }
    });
    window.addEventListener('blur', () => {
      this.spaceDown = false;
      this.updateCursor();
    });
  }

  updateCursor() {
    const t = this.app.tools.current;
    this.canvas.style.cursor = this.spaceDown || this.panning ? (this.panning ? 'grabbing' : 'grab') : t.cursor || 'crosshair';
  }

  onDown(e) {
    const app = this.app;
    this.canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    app.closeTransient?.();
    const info = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), type: e.pointerType };
    this.pointers.set(e.pointerId, info);

    if (e.pointerType === 'touch') {
      const touches = [...this.pointers.values()].filter((p) => p.type === 'touch');
      if (touches.length >= 2) {
        // passage en geste : on annule le tracé en cours
        if (this.drawingId !== null) {
          app.tools.current.cancel();
          this.drawingId = null;
        }
        this.startGesture();
        return;
      }
    }
    if (this.gesture) return;

    // déplacement de la vue : clic milieu, espace, outil main
    if (e.pointerType === 'mouse' && (e.button === 1 || this.spaceDown)) {
      this.panning = { x: e.clientX, y: e.clientY, id: e.pointerId };
      this.updateCursor();
      return;
    }
    if (e.button > 2) return;
    const p = this.makeP(e);
    const tool = app.tools.current;
    if (e.altKey && tool.showBrush) {
      this.altPick = true;
      app.tools.get('picker').pick(p);
      this.drawingId = e.pointerId;
      return;
    }
    this.drawingId = e.pointerId;
    this.lastP = p;
    tool.down(p);
    app.renderer.requestRender();
  }

  onMove(e) {
    const app = this.app;
    const info = this.pointers.get(e.pointerId);
    if (info) {
      info.x = e.clientX;
      info.y = e.clientY;
    }
    if (this.gesture) {
      this.updateGesture();
      return;
    }
    if (this.panning && this.panning.id === e.pointerId) {
      app.viewport.panBy(e.clientX - this.panning.x, e.clientY - this.panning.y);
      this.panning.x = e.clientX;
      this.panning.y = e.clientY;
      return;
    }
    const p = this.makeP(e);
    if (e.pointerType !== 'touch' || this.drawingId !== null) {
      app.renderer.hover = [p.ix, p.iy];
      app.emit('hover', p);
    }
    if (this.drawingId === e.pointerId) {
      if (this.altPick) {
        app.tools.get('picker').pick(p);
        return;
      }
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      const tool = app.tools.current;
      if (events.length > 1) for (const ce of events) tool.move(this.makeP(ce));
      else tool.move(p);
      this.lastP = p;
    }
    app.renderer.requestRender();
  }

  onUp(e, cancelled = false) {
    const app = this.app;
    const info = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.gesture) {
      const g = this.gesture;
      if (info) g.maxMove = Math.max(g.maxMove, Math.hypot(info.x - info.sx, info.y - info.sy));
      if (this.pointers.size === 0) {
        const dt = performance.now() - g.t;
        if (!cancelled && dt < 320 && g.maxMove < 14 && !g.moved) {
          if (g.count === 2) app.history.undo();
          else if (g.count >= 3) app.history.redo();
        }
        this.gesture = null;
      }
      return;
    }
    if (this.panning && this.panning.id === e.pointerId) {
      this.panning = null;
      this.updateCursor();
      return;
    }
    if (this.drawingId === e.pointerId) {
      this.drawingId = null;
      if (this.altPick) {
        this.altPick = false;
        return;
      }
      const tool = app.tools.current;
      if (cancelled) tool.cancel();
      else tool.up(this.makeP(e));
      if (e.pointerType === 'touch') app.renderer.hover = null;
      app.renderer.requestRender();
    }
  }

  startGesture() {
    const pts = [...this.pointers.values()];
    const [a, b] = pts;
    this.gesture = {
      count: pts.length,
      t: Math.min(...pts.map((p) => p.t)),
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: [(a.x + b.x) / 2, (a.y + b.y) / 2],
      zoom: this.app.viewport.zoom,
      maxMove: 0,
      moved: false,
    };
    for (const p of pts) {
      p.sx = p.x;
      p.sy = p.y;
    }
    this.app.renderer.hover = null;
  }

  updateGesture() {
    const g = this.gesture;
    const pts = [...this.pointers.values()];
    g.count = Math.max(g.count, pts.length);
    if (pts.length < 2) return;
    const [a, b] = pts;
    for (const p of pts) g.maxMove = Math.max(g.maxMove, Math.hypot(p.x - p.sx, p.y - p.sy));
    if (g.maxMove > 14) g.moved = true;
    if (!g.moved) return;
    const vp = this.app.viewport;
    const r = this.canvas.getBoundingClientRect();
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    // pan
    vp.ox += mid[0] - g.mid[0];
    vp.oy += mid[1] - g.mid[1];
    // zoom autour du milieu
    const z = Math.max(0.1, Math.min(160, g.zoom * (dist / g.dist)));
    const sx = mid[0] - r.left, sy = mid[1] - r.top;
    const [dx, dy] = vp.toDoc(sx, sy);
    vp.zoom = z;
    vp.ox = sx - dx * z;
    vp.oy = sy - dy * z;
    g.mid = mid;
    vp.changed();
  }

  onWheel(e) {
    e.preventDefault();
    const vp = this.app.viewport;
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (e.ctrlKey) {
      // pincement trackpad : zoom continu
      vp.zoomAt(vp.zoom * Math.exp(-e.deltaY * 0.01), sx, sy);
    } else if (this.app.state.wheelPans && !e.altKey) {
      vp.panBy(-e.deltaX, -e.deltaY);
    } else {
      if (Math.abs(e.deltaY) < 1 && Math.abs(e.deltaX) > 0) {
        vp.panBy(-e.deltaX, 0);
        return;
      }
      // accumulation : une molette classique = 1 cran, un trackpad = plusieurs petits deltas
      const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      this.wheelAcc = (this.wheelAcc || 0) + d;
      if (Math.abs(this.wheelAcc) < 40) return;
      vp.stepZoom(this.wheelAcc < 0 ? 1 : -1, sx, sy);
      this.wheelAcc = 0;
    }
  }
}

export function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}
