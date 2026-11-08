// Carte de tuiles (tilemap) : le dessin, découpé en tuiles (taille de la grille), sert de jeu
// de tuiles ; on peint une carte avec ces tuiles. Les cartes sont dans doc.tilemaps et tout
// est annulable (le tableau `cells` est remplacé à chaque trait, jamais modifié en place).
// Export : PNG de la carte (exact) et ZIP « Tiled » (carte .tmj + jeu de tuiles .png).

import { h, clear, debounce, downloadBlob, slugify } from '../util/dom.js';
import { openDialog, promptDialog, confirmDialog } from './dialogs.js';
import { icon } from './icons.js';
import { uid } from '../core/doc.js';
import { composePixels } from '../render/compose.js';
import { encodePNG, upscale } from '../export/png.js';
import { makeZip } from '../export/zip.js';

const MAX = 256;

/** Taille de tuile par défaut : celle de la grille si elle est raisonnable, sinon 16. */
function defaultTile(doc) {
  const g = doc.grid || {};
  const ok = (v) => v >= 4 && v <= 128 && v <= Math.max(doc.width, doc.height);
  return [ok(g.cellW) ? g.cellW : Math.min(16, doc.width), ok(g.cellH) ? g.cellH : Math.min(16, doc.height)];
}

export function newTilemap(doc, { name = null, cols = 20, rows = 12, tw = null, th = null } = {}) {
  const [dw, dh] = defaultTile(doc);
  return { id: uid('m'), name: name || `Carte ${doc.tilemaps.length + 1}`, tw: tw || dw, th: th || dh, cols, rows, cells: new Array(cols * rows).fill(-1) };
}

/** Jeu de tuiles : pixels composés du dessin, découpés en tuiles tw×th. */
export function tileset(doc, tw, th, frame = doc.frame) {
  const px = composePixels(doc, { frame });
  const cols = Math.max(1, Math.floor(doc.width / tw)), rows = Math.max(1, Math.floor(doc.height / th));
  const empty = [];
  for (let i = 0; i < cols * rows; i++) {
    const x0 = (i % cols) * tw, y0 = Math.floor(i / cols) * th;
    let any = false;
    for (let y = 0; y < th && !any; y++) for (let x = 0; x < tw; x++) if (px[(y0 + y) * doc.width + x0 + x] >>> 24) { any = true; break; }
    empty.push(!any);
  }
  return { px, cols, rows, count: cols * rows, empty, tw, th, w: doc.width };
}

/** Pixels exacts de la carte (Uint32Array cols*tw × rows*th). */
export function renderTilemap(doc, map, ts = tileset(doc, map.tw, map.th)) {
  const W = map.cols * map.tw, Hh = map.rows * map.th;
  const out = new Uint32Array(W * Hh);
  for (let c = 0; c < map.cells.length; c++) {
    const t = map.cells[c];
    if (t < 0 || t >= ts.count) continue;
    const sx = (t % ts.cols) * map.tw, sy = Math.floor(t / ts.cols) * map.th;
    const dx = (c % map.cols) * map.tw, dy = Math.floor(c / map.cols) * map.th;
    for (let y = 0; y < map.th; y++) {
      const s = (sy + y) * ts.w + sx, d = (dy + y) * W + dx;
      out.set(ts.px.subarray(s, s + map.tw), d);
    }
  }
  return { px: out, w: W, h: Hh };
}

function toCanvas(px, w, hh) {
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer.slice(px.byteOffset, px.byteOffset + px.byteLength)), w, hh), 0, 0);
  return c;
}

/** Carte au format Tiled (JSON .tmj), tuiles numérotées à partir de 1 (0 = vide). */
export function tiledJSON(doc, map, ts, imageName) {
  return {
    type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width: map.cols, height: map.rows, tilewidth: map.tw, tileheight: map.th, nextlayerid: 2, nextobjectid: 1,
    layers: [{ id: 1, name: map.name, type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: map.cols, height: map.rows, data: map.cells.map((t) => (t < 0 ? 0 : t + 1)) }],
    tilesets: [{ firstgid: 1, name: doc.name, image: imageName, imagewidth: ts.cols * map.tw, imageheight: ts.rows * map.th, tilewidth: map.tw, tileheight: map.th, tilecount: ts.count, columns: ts.cols, margin: 0, spacing: 0 }],
  };
}

// =========================================================================
// Fenêtre
// =========================================================================
export function openTilemap(app) {
  const doc = app.doc;
  if (!doc.tilemaps.length) {
    app.history.transact('Nouvelle carte de tuiles', () => { doc.tilemaps = [...doc.tilemaps, newTilemap(doc)]; });
  }
  let mapId = app.state.tilemapId && doc.tilemaps.some((m) => m.id === app.state.tilemapId) ? app.state.tilemapId : doc.tilemaps[0].id;
  let tool = 'brush';
  let sel = [0]; // tuiles choisies (plusieurs = tirage au hasard)
  let zoom = app.state.tilemapZoom || 3;
  let showGrid = true;
  let ts = null;
  const map = () => app.doc.tilemaps.find((m) => m.id === mapId) || app.doc.tilemaps[0];

  const tsCanvas = h('canvas', { class: 'tm-tileset', 'aria-label': 'Jeu de tuiles' });
  const mapCanvas = h('canvas', { class: 'tm-map', 'aria-label': 'Carte' });
  const mapWrap = h('div', { class: 'tm-mapwrap' }, mapCanvas);
  const head = h('div', { class: 'tm-head' });
  const info = h('div', { class: 'small muted tm-info' });

  // ---------- rendu ----------
  function drawTileset() {
    const m = map();
    ts = tileset(app.doc, m.tw, m.th);
    const k = Math.max(1, Math.min(6, Math.floor(260 / Math.max(app.doc.width, 1))));
    tsCanvas.width = app.doc.width * k;
    tsCanvas.height = app.doc.height * k;
    tsCanvas.dataset.k = k;
    const g = tsCanvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, tsCanvas.width, tsCanvas.height);
    g.drawImage(toCanvas(ts.px, app.doc.width, app.doc.height), 0, 0, tsCanvas.width, tsCanvas.height);
    for (let i = 0; i < ts.count; i++) {
      const x = (i % ts.cols) * m.tw * k, y = Math.floor(i / ts.cols) * m.th * k;
      if (ts.empty[i]) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y, m.tw * k, m.th * k); }
      g.strokeStyle = 'rgba(127,140,255,.55)';
      g.strokeRect(x + 0.5, y + 0.5, m.tw * k - 1, m.th * k - 1);
    }
    g.lineWidth = 2;
    for (const i of sel) {
      if (i >= ts.count) continue;
      g.strokeStyle = '#ff5ab4';
      g.strokeRect((i % ts.cols) * m.tw * k + 1, Math.floor(i / ts.cols) * m.th * k + 1, m.tw * k - 2, m.th * k - 2);
    }
    g.lineWidth = 1;
  }
  function drawMap() {
    const m = map();
    if (!ts || ts.tw !== m.tw || ts.th !== m.th) ts = tileset(app.doc, m.tw, m.th);
    const r = renderTilemap(app.doc, m, ts);
    mapCanvas.width = r.w * zoom;
    mapCanvas.height = r.h * zoom;
    const g = mapCanvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    g.drawImage(toCanvas(r.px, r.w, r.h), 0, 0, mapCanvas.width, mapCanvas.height);
    if (showGrid) {
      g.strokeStyle = 'rgba(127,140,255,.35)';
      g.beginPath();
      for (let x = 0; x <= m.cols; x++) { g.moveTo(x * m.tw * zoom + 0.5, 0); g.lineTo(x * m.tw * zoom + 0.5, mapCanvas.height); }
      for (let y = 0; y <= m.rows; y++) { g.moveTo(0, y * m.th * zoom + 0.5); g.lineTo(mapCanvas.width, y * m.th * zoom + 0.5); }
      g.stroke();
    }
    const used = m.cells.filter((t) => t >= 0).length;
    info.textContent = `${m.cols} × ${m.rows} tuiles de ${m.tw} × ${m.th} px · ${m.cols * m.tw} × ${m.rows * m.th} px · ${used} case(s) remplie(s)`;
  }
  const redraw = debounce(() => { drawTileset(); drawMap(); }, 60);

  // ---------- choix des tuiles ----------
  tsCanvas.addEventListener('pointerdown', (e) => {
    const m = map(), k = +tsCanvas.dataset.k;
    const r = tsCanvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) * (tsCanvas.width / r.width)) / k / m.tw);
    const y = Math.floor(((e.clientY - r.top) * (tsCanvas.height / r.height)) / k / m.th);
    if (x < 0 || y < 0 || x >= ts.cols || y >= ts.rows) return;
    const i = y * ts.cols + x;
    if (e.shiftKey || e.ctrlKey || e.metaKey) sel = sel.includes(i) ? (sel.length > 1 ? sel.filter((v) => v !== i) : sel) : [...sel, i];
    else sel = [i];
    if (tool === 'erase' || tool === 'pick') tool = 'brush';
    renderHead();
    drawTileset();
  });

  // ---------- peinture de la carte ----------
  let stroke = null;
  const pick = () => sel[Math.floor(Math.random() * sel.length)];
  const cellAt = (e) => {
    const m = map(), r = mapCanvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) * (mapCanvas.width / r.width)) / zoom / m.tw);
    const y = Math.floor(((e.clientY - r.top) * (mapCanvas.height / r.height)) / zoom / m.th);
    return x >= 0 && y >= 0 && x < m.cols && y < m.rows ? [x, y] : null;
  };
  function applyPreview(cells) {
    // aperçu pendant le trait (la carte est modifiée en une seule transaction au relâchement)
    const m = map();
    const saved = m.cells;
    m.cells = cells;
    drawMap();
    m.cells = saved;
  }
  function fillArea(cells, m, x, y, value) {
    const target = cells[y * m.cols + x];
    if (sel.length === 1 && target === value) return;
    const stack = [[x, y]], seen = new Uint8Array(cells.length);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= m.cols || cy >= m.rows) continue;
      const i = cy * m.cols + cx;
      if (seen[i] || cells[i] !== target) continue;
      seen[i] = 1;
      cells[i] = value === -1 ? -1 : pick();
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  mapCanvas.addEventListener('pointerdown', (e) => {
    const c = cellAt(e);
    if (!c) return;
    e.preventDefault();
    mapCanvas.setPointerCapture(e.pointerId);
    const m = map();
    const erase = tool === 'erase' || e.button === 2;
    if (tool === 'pick' || e.altKey) {
      const t = m.cells[c[1] * m.cols + c[0]];
      if (t >= 0) { sel = [t]; tool = 'brush'; renderHead(); drawTileset(); }
      return;
    }
    stroke = { start: c, last: c, erase, cells: m.cells.slice(), base: m.cells.slice() };
    paint(c);
  });
  mapCanvas.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    const c = cellAt(e);
    if (!c || (c[0] === stroke.last[0] && c[1] === stroke.last[1])) return;
    stroke.last = c;
    paint(c);
  });
  const end = () => {
    if (!stroke) return;
    const cells = stroke.cells;
    const changed = cells.some((v, i) => v !== stroke.base[i]);
    stroke = null;
    if (changed) {
      app.history.transact('Peindre la carte de tuiles', () => {
        app.doc.tilemaps = app.doc.tilemaps.map((m) => (m.id === mapId ? { ...m, cells } : m));
      });
    }
    drawMap();
  };
  mapCanvas.addEventListener('pointerup', end);
  mapCanvas.addEventListener('pointercancel', end);
  mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  function paint([x, y]) {
    const m = map();
    const value = stroke.erase ? -1 : 0;
    const set = (cx, cy) => { stroke.cells[cy * m.cols + cx] = stroke.erase ? -1 : pick(); };
    if (tool === 'fill' && !stroke.erase) {
      stroke.cells = stroke.base.slice();
      fillArea(stroke.cells, m, x, y, value);
    } else if (tool === 'rect') {
      stroke.cells = stroke.base.slice();
      const [x0, y0] = stroke.start;
      for (let cy = Math.min(y0, y); cy <= Math.max(y0, y); cy++) for (let cx = Math.min(x0, x); cx <= Math.max(x0, x); cx++) set(cx, cy);
    } else set(x, y);
    applyPreview(stroke.cells);
  }

  // ---------- en-tête : cartes, taille, outils, export ----------
  const TOOLS = [['brush', 'brush', 'Pinceau à tuiles'], ['rect', 'rect', 'Rectangle de tuiles'], ['fill', 'fill', 'Remplir la zone'], ['erase', 'eraser', 'Gomme (ou clic droit)'], ['pick', 'picker', 'Pipette (ou Alt + clic)']];
  function update(label, patch) {
    app.history.transact(label, () => {
      app.doc.tilemaps = app.doc.tilemaps.map((m) => (m.id === mapId ? { ...m, ...patch } : m));
    });
    ts = null;
    renderHead();
    redraw();
  }
  function resize(cols, rows) {
    const m = map();
    cols = Math.max(1, Math.min(MAX, cols | 0)); rows = Math.max(1, Math.min(MAX, rows | 0));
    if (cols === m.cols && rows === m.rows) return;
    const cells = new Array(cols * rows).fill(-1);
    for (let y = 0; y < Math.min(rows, m.rows); y++) for (let x = 0; x < Math.min(cols, m.cols); x++) cells[y * cols + x] = m.cells[y * m.cols + x];
    update('Taille de la carte', { cols, rows, cells });
  }
  function renderHead() {
    const m = map();
    clear(head);
    const num = (value, onChange, label, max = MAX) => {
      const inp = h('input', { type: 'number', class: 'input', min: 1, max, value, 'aria-label': label, title: label, style: { width: '64px' } });
      inp.addEventListener('change', () => onChange(+inp.value));
      return inp;
    };
    head.append(
      h('div', { class: 'row' },
        h('select', { class: 'input', 'aria-label': 'Carte', onchange: (e) => { mapId = e.target.value; app.setState({ tilemapId: mapId }); ts = null; renderHead(); redraw(); } },
          app.doc.tilemaps.map((x) => h('option', { value: x.id, selected: x.id === mapId, translate: 'no' }, x.name))),
        h('button', { class: 'icon-btn', title: 'Nouvelle carte', 'aria-label': 'Nouvelle carte', onclick: () => {
          const nm = newTilemap(app.doc, { tw: m.tw, th: m.th, cols: m.cols, rows: m.rows });
          app.history.transact('Nouvelle carte de tuiles', () => { app.doc.tilemaps = [...app.doc.tilemaps, nm]; });
          mapId = nm.id; renderHead(); redraw();
        } }, icon('plus')),
        h('button', { class: 'icon-btn', title: 'Renommer la carte', 'aria-label': 'Renommer la carte', onclick: async () => {
          const n = await promptDialog('Nom de la carte', m.name);
          if (n && n.trim()) update('Renommer la carte', { name: n.trim() });
        } }, icon('pencil')),
        h('button', { class: 'icon-btn', title: 'Supprimer la carte', 'aria-label': 'Supprimer la carte', onclick: async () => {
          if (!(await confirmDialog(`Supprimer la carte « ${m.name} » ?`, { danger: true, ok: 'Supprimer' }))) return;
          app.history.transact('Supprimer la carte de tuiles', () => {
            app.doc.tilemaps = app.doc.tilemaps.filter((x) => x.id !== m.id);
            if (!app.doc.tilemaps.length) app.doc.tilemaps = [newTilemap(app.doc, { tw: m.tw, th: m.th })];
          });
          mapId = app.doc.tilemaps[0].id; ts = null; renderHead(); redraw();
        } }, icon('trash')),
        h('span', { class: 'small muted' }, 'Carte'), num(m.cols, (v) => resize(v, m.rows), 'Colonnes'), h('span', { class: 'small' }, '×'), num(m.rows, (v) => resize(m.cols, v), 'Lignes'),
        h('span', { class: 'small muted' }, 'Tuile (px)'), num(m.tw, (v) => update('Taille des tuiles', { tw: Math.max(2, Math.min(app.doc.width, v)) }), 'Largeur des tuiles', 256),
        h('span', { class: 'small' }, '×'), num(m.th, (v) => update('Taille des tuiles', { th: Math.max(2, Math.min(app.doc.height, v)) }), 'Hauteur des tuiles', 256)),
      h('div', { class: 'row' },
        h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Outil de carte' }, TOOLS.map(([id, ic, label]) => h('button', {
          class: tool === id ? 'on' : '', title: label, 'aria-label': label, role: 'radio', 'aria-checked': String(tool === id),
          onclick: () => { tool = id; renderHead(); },
        }, icon(ic)))),
        h('button', { class: 'icon-btn', title: 'Annuler (Ctrl+Z)', 'aria-label': 'Annuler', onclick: () => app.history.undo() }, icon('undo')),
        h('button', { class: 'icon-btn', title: 'Rétablir (Ctrl+Y)', 'aria-label': 'Rétablir', onclick: () => app.history.redo() }, icon('redo')),
        h('button', { class: 'icon-btn', title: 'Zoom arrière', 'aria-label': 'Zoom arrière', onclick: () => setZoom(zoom - 1) }, icon('zoomOut')),
        h('span', { class: 'small' }, `×${zoom}`),
        h('button', { class: 'icon-btn', title: 'Zoom avant', 'aria-label': 'Zoom avant', onclick: () => setZoom(zoom + 1) }, icon('zoomIn')),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: showGrid, onchange: (e) => { showGrid = e.target.checked; drawMap(); } }), 'Grille'),
        h('button', { class: 'btn small', onclick: () => exportPNG() }, icon('download'), 'PNG'),
        h('button', { class: 'btn small', onclick: () => exportTiled() }, icon('download'), 'Tiled (ZIP)'),
        h('button', { class: 'btn small', onclick: async () => {
          if (!(await confirmDialog('Vider toute la carte ?', { danger: true, ok: 'Vider' }))) return;
          update('Vider la carte de tuiles', { cells: new Array(m.cols * m.rows).fill(-1) });
        } }, 'Vider')),
      h('p', { class: 'hint tm-hint' }, sel.length > 1
        ? `${sel.length} tuiles choisies : le pinceau en pose une au hasard (idéal pour varier herbe, sol, briques).`
        : 'Cliquez une tuile, puis peignez la carte. Maj + clic sur d\'autres tuiles : pose au hasard. Clic droit : gomme. Les tuiles se mettent à jour quand vous modifiez le dessin.'));
  }
  function setZoom(z) {
    zoom = Math.max(1, Math.min(12, z));
    app.setState({ tilemapZoom: zoom });
    renderHead();
    drawMap();
  }
  mapWrap.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  async function exportPNG() {
    const m = map();
    const r = renderTilemap(app.doc, m);
    const s = Math.max(1, Math.min(8, zoom >= 4 ? 4 : 1));
    const big = s > 1 ? upscale(r.px, r.w, r.h, s) : r.px;
    downloadBlob(new Blob([await encodePNG(big, r.w * s, r.h * s)], { type: 'image/png' }), `${slugify(app.doc.name)}_${slugify(m.name)}${s > 1 ? '_x' + s : ''}.png`);
    app.toast('Carte exportée en PNG');
  }
  async function exportTiled() {
    const m = map();
    const t = tileset(app.doc, m.tw, m.th);
    const tsW = t.cols * m.tw, tsH = t.rows * m.th;
    const crop = new Uint32Array(tsW * tsH);
    for (let y = 0; y < tsH; y++) crop.set(t.px.subarray(y * app.doc.width, y * app.doc.width + tsW), y * tsW);
    const img = `${slugify(app.doc.name)}_tuiles.png`;
    const files = [
      { name: img, data: await encodePNG(crop, tsW, tsH) },
      { name: `${slugify(m.name)}.tmj`, data: JSON.stringify(tiledJSON(app.doc, m, t, img), null, 1) },
      { name: `${slugify(m.name)}.png`, data: await encodePNG(renderTilemap(app.doc, m, t).px, m.cols * m.tw, m.rows * m.th) },
    ];
    downloadBlob(makeZip(files), `${slugify(app.doc.name)}_${slugify(m.name)}_tiled.zip`);
    app.toast('Carte exportée pour Tiled (ZIP)');
  }

  // le dessin change : les tuiles suivent ; annuler/rétablir : la carte aussi
  const offs = ['pixels', 'structure', 'meta', 'frame', 'doc', 'history'].map((ev) => app.on(ev, () => { if (!stroke) { ts = null; redraw(); } }));

  // annuler / rétablir au clavier dans la fenêtre
  const onKey = (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest?.('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); app.history.undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); app.history.redo(); }
  };
  window.addEventListener('keydown', onKey, true);
  const d = openDialog({
    title: 'Carte de tuiles',
    wide: true,
    className: 'tm-dlg',
    body: h('div', { class: 'tm' }, head,
      h('div', { class: 'tm-main' },
        h('div', { class: 'tm-side' }, h('div', { class: 'small muted' }, 'Jeu de tuiles (votre dessin)'), tsCanvas),
        mapWrap),
      info),
    onClose: () => { for (const off of offs) off?.(); window.removeEventListener('keydown', onKey, true); },
  });
  renderHead();
  drawTileset();
  drawMap();
  return d;
}
