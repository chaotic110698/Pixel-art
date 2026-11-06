// Actions de haut niveau partagées par le menu, les raccourcis et les panneaux.

import { h, pickFile, loadImageFromFile, imageToRGBA } from '../util/dom.js';
import { openDialog, confirmDialog } from './dialogs.js';
import { Doc } from '../core/doc.js';
import { hexToU32, u32ToHex, normHex } from '../util/color.js';
import { scaleNearest } from '../core/raster.js';
import { composePixels } from '../render/compose.js';
import { extractPalette } from '../core/palettes.js';
import * as ops from '../core/layer-ops.js';
import * as img from '../core/image-ops.js';

export const SIZE_PRESETS = [16, 32, 64, 128, 256, 512];

export function createActions(app) {
  const A = {};

  // ---------- Presse-papiers ----------
  A.copy = (cut = false) => {
    const data = app.selection.extract();
    if (!data) return app.toast('Rien à copier');
    app.clipboard = data;
    if (cut) A.deleteSelection();
    app.toast(cut ? 'Coupé' : 'Copié');
    // copie aussi dans le presse-papiers du système (PNG), si possible
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const c = document.createElement('canvas');
        c.width = data.w; c.height = data.h;
        const masked = new Uint32Array(data.w * data.h);
        for (let i = 0; i < masked.length; i++) masked[i] = data.mask[i] ? data.data[i] : 0;
        c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(masked.buffer), data.w, data.h), 0, 0);
        c.toBlob((b) => b && navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}));
      }
    } catch (_) { /* facultatif */ }
  };

  A.paste = () => {
    const cb = app.clipboard;
    if (!cb) return app.toast('Presse-papiers vide');
    if (app.tools.current.id !== 'move' && !['select', 'lasso', 'wand'].includes(app.tools.current.id)) app.tools.select('move');
    const doc = app.doc;
    let { x, y } = cb;
    if (x + cb.w > doc.width || y + cb.h > doc.height) {
      x = Math.max(0, Math.floor((doc.width - cb.w) / 2));
      y = Math.max(0, Math.floor((doc.height - cb.h) / 2));
    }
    app.selection.paste(cb.data, cb.w, cb.h, x, y, cb.mask);
  };

  A.pasteImage = async (file) => {
    const image = await loadImageFromFile(file);
    const d = imageToRGBA(image);
    const data = new Uint32Array(d.data.buffer.slice(0));
    app.clipboard = { data, mask: new Uint8Array(d.width * d.height).fill(1), w: d.width, h: d.height, x: 0, y: 0 };
    A.paste();
  };

  A.deleteSelection = () => {
    const sel = app.selection;
    if (sel.floating) {
      // supprimer le flottant = valider la suppression des pixels soulevés
      const f = sel.floating;
      f.data = new Uint32Array(f.data.length);
      sel.commitFloating('Supprimer');
      return;
    }
    ops.clearLayer(app);
  };

  // ---------- Documents ----------
  A.newDocument = async () => {
    const wIn = h('input', { type: 'number', class: 'input wide', value: app.doc.width, min: 1, max: 2048 });
    const hIn = h('input', { type: 'number', class: 'input wide', value: app.doc.height, min: 1, max: 2048 });
    const nameIn = h('input', { type: 'text', class: 'input wide', value: 'Sans titre' });
    const presets = h('div', { class: 'row' }, SIZE_PRESETS.map((s) =>
      h('button', { class: 'btn small', onclick: () => { wIn.value = s; hIn.value = s; } }, `${s}×${s}`)));
    const bg = h('select', { class: 'input wide' },
      h('option', { value: 'transparent' }, 'Transparent'),
      h('option', { value: 'white' }, 'Blanc'),
      h('option', { value: 'secondary' }, 'Couleur B'));
    const v = await openDialog({
      title: 'Nouveau dessin',
      body: [
        h('label', { class: 'field' }, h('span', {}, 'Nom'), nameIn),
        h('p', { class: 'small muted' }, 'Préréglages :'), presets,
        h('div', { class: 'fields', style: { marginTop: '8px' } },
          h('label', { class: 'field' }, h('span', {}, 'Largeur (px)'), wIn),
          h('label', { class: 'field' }, h('span', {}, 'Hauteur (px)'), hIn)),
        h('label', { class: 'field' }, h('span', {}, 'Fond'), bg),
      ],
      buttons: [{ label: 'Annuler', value: false }, { label: 'Créer', value: true, primary: true }],
    }).result;
    if (!v) return;
    const w = Math.max(1, Math.min(2048, parseInt(wIn.value, 10) || 32));
    const hh = Math.max(1, Math.min(2048, parseInt(hIn.value, 10) || 32));
    await app.storage?.saveNow();
    const doc = new Doc(w, hh, nameIn.value.trim() || 'Sans titre');
    doc.palette = [...app.doc.palette];
    if (bg.value !== 'transparent') {
      const fond = doc.createLayer('Fond');
      fond.cels[0].fill(bg.value === 'white' ? hexToU32('#ffffff') : app.colorU32('secondary'));
      doc.insert(fond, 'root');
    }
    const l = doc.createLayer('Calque 1');
    doc.insert(l, 'root');
    doc.activeId = l.id;
    app.setDoc(doc);
    app.toast(`Nouveau dessin ${w}×${hh}`);
  };

  A.resizeDialog = async () => {
    const doc = app.doc;
    const wIn = h('input', { type: 'number', class: 'input wide', value: doc.width, min: 1, max: 4096 });
    const hIn = h('input', { type: 'number', class: 'input wide', value: doc.height, min: 1, max: 4096 });
    const mode = h('select', { class: 'input wide' },
      h('option', { value: 'canvas' }, 'Agrandir/réduire le canevas (sans déformer)'),
      h('option', { value: 'scale' }, 'Mettre l\'image à l\'échelle (plus proche voisin)'));
    let anchor = 'c';
    const anchors = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: '4px' } });
    const drawAnchors = () => {
      grid.replaceChildren(...anchors.map((a) => h('button', { class: 'btn small' + (a === anchor ? ' primary' : ''), onclick: () => { anchor = a; drawAnchors(); } }, a === anchor ? '●' : '·')));
    };
    drawAnchors();
    const presets = h('div', { class: 'row' }, SIZE_PRESETS.map((s) => h('button', { class: 'btn small', onclick: () => { wIn.value = s; hIn.value = s; } }, `${s}`)),
      h('button', { class: 'btn small', onclick: () => { wIn.value = doc.width * 2; hIn.value = doc.height * 2; } }, '×2'),
      h('button', { class: 'btn small', onclick: () => { wIn.value = Math.max(1, Math.round(doc.width / 2)); hIn.value = Math.max(1, Math.round(doc.height / 2)); } }, '÷2'));
    const v = await openDialog({
      title: 'Taille de l\'image',
      body: [
        h('label', { class: 'field' }, h('span', {}, 'Mode'), mode),
        presets,
        h('div', { class: 'fields', style: { marginTop: '8px' } },
          h('label', { class: 'field' }, h('span', {}, 'Largeur'), wIn),
          h('label', { class: 'field' }, h('span', {}, 'Hauteur'), hIn)),
        h('div', { class: 'field' }, h('span', {}, 'Ancrage (mode canevas)'), grid),
      ],
      buttons: [{ label: 'Annuler', value: false }, { label: 'Appliquer', value: true, primary: true }],
    }).result;
    if (!v) return;
    const nw = parseInt(wIn.value, 10), nh = parseInt(hIn.value, 10);
    if (!(nw > 0 && nh > 0)) return;
    if (mode.value === 'scale') img.scaleImage(app, nw, nh);
    else img.resizeCanvas(app, nw, nh, anchor);
  };

  // ---------- Import d'image ----------
  A.importImage = async (as = 'layer', file = null) => {
    file = file || (await pickFile('image/png,image/jpeg,image/gif,image/webp'));
    if (!file) return;
    let image;
    try {
      image = await loadImageFromFile(file);
    } catch (_) {
      return app.toast('Image illisible');
    }
    const doc = app.doc;
    const iw = image.naturalWidth, ih = image.naturalHeight;
    let fit = 'center';
    if (as === 'layer' && (iw > doc.width || ih > doc.height) && iw <= 4096 && ih <= 4096) {
      const choice = await openDialog({
        title: 'Image plus grande que le canevas',
        body: h('p', {}, `L'image fait ${iw}×${ih} px, le canevas ${doc.width}×${doc.height} px.`),
        buttons: [
          { label: 'Réduire pour tenir', value: 'fit' },
          { label: 'Taille réelle (rogner)', value: 'center' },
          { label: 'Agrandir le canevas', value: 'grow', primary: true },
        ],
      }).result;
      if (!choice) return;
      fit = choice;
    }
    if (as === 'reference') fit = 'fit';
    if (fit === 'grow') img.resizeCanvas(app, Math.max(doc.width, iw), Math.max(doc.height, ih), 'tl');
    const W = app.doc.width, H = app.doc.height;
    const raw = imageToRGBA(image);
    let src = new Uint32Array(raw.data.buffer.slice(0));
    let sw = iw, sh = ih;
    if (fit === 'fit') {
      const k = Math.min(W / iw, H / ih);
      sw = Math.max(1, Math.round(iw * k));
      sh = Math.max(1, Math.round(ih * k));
      src = scaleNearest(src, iw, ih, sw, sh);
    }
    const name = file.name.replace(/\.[^.]+$/, '') || 'Image';
    app.history.group(as === 'reference' ? 'Importer une référence' : 'Importer une image', () => {
      const layer = ops.addLayer(app, as === 'reference' ? `Réf. ${name}` : name);
      const token = app.history.beginPixels(layer);
      const dx = Math.floor((W - sw) / 2), dy = Math.floor((H - sh) / 2);
      for (let y = 0; y < sh; y++) {
        const ty = y + dy;
        if (ty < 0 || ty >= H) continue;
        for (let x = 0; x < sw; x++) {
          const tx = x + dx;
          if (tx >= 0 && tx < W) token.cel[ty * W + tx] = src[y * sw + x];
        }
      }
      app.markLayerDirty(token.cel);
      app.history.endPixels(token, 'Image');
      if (as === 'reference') {
        app.history.transact('Calque de référence', () => {
          layer.reference = true;
          layer.opacity = 0.45;
          layer.locked = true;
        });
        // la référence va tout en bas
        ops.dropNode(app, layer.id, app.doc.root.children[0], 'below');
      }
    });
    app.toast(as === 'reference' ? 'Référence importée (verrouillée, non exportée)' : 'Image importée comme calque');
  };

  // ---------- Couleurs ----------
  A.replaceColorDialog = async () => {
    const from = normHex(app.state.primary), to = normHex(app.state.secondary);
    const scope = h('select', { class: 'input wide' },
      h('option', { value: 'layer' }, 'Calque actif'),
      h('option', { value: 'all' }, 'Tous les calques (toutes les images)'));
    const v = await openDialog({
      title: 'Remplacer une couleur',
      body: [
        h('p', {}, 'Remplace la couleur A par la couleur B.'),
        h('div', { class: 'row' }, h('span', { class: 'swatch', style: { background: from, width: '36px', display: 'inline-block' } }), '→', h('span', { class: 'swatch', style: { background: to, width: '36px', display: 'inline-block' } }), h('code', {}, `${from} → ${to}`)),
        h('label', { class: 'field' }, h('span', {}, 'Portée'), scope),
      ],
      buttons: [{ label: 'Annuler', value: false }, { label: 'Remplacer', value: true, primary: true }],
    }).result;
    if (!v) return;
    A.replaceColors(new Map([[hexToU32(from), hexToU32(to)]]), scope.value === 'all' ? null : [app.doc.activeLayer].filter(Boolean), 'Remplacer une couleur');
  };

  /** Échange de palette : map Uint32 -> Uint32 sur une liste de calques (null = tous). */
  A.replaceColors = (map, layers = null, label = 'Recolorer') => {
    const doc = app.doc;
    app.selection.commitFloating();
    layers = layers || doc.allLayers();
    let changed = 0;
    app.history.group(label, () => {
      for (const l of layers) {
        for (let f = 0; f < doc.frames.length; f++) {
          const cel = l.cels[f];
          if (!cel) continue;
          let any = false;
          for (let i = 0; i < cel.length; i++) if (map.has(cel[i])) { any = true; break; }
          if (!any) continue;
          const token = app.history.beginPixels(l, f);
          for (let i = 0; i < cel.length; i++) {
            const n = map.get(cel[i]);
            if (n !== undefined) { cel[i] = n; changed++; }
          }
          app.markLayerDirty(cel);
          app.history.endPixels(token, label);
        }
      }
    });
    app.renderer.invalidateAll();
    return changed;
  };

  A.paletteFromDrawing = (cb) => {
    const doc = app.doc;
    const px = composePixels(doc, { includeReference: false });
    const colors = extractPalette({ data: new Uint8ClampedArray(px.buffer) }, 256);
    if (!colors.length) return app.toast('Dessin vide');
    cb(colors);
  };

  // ---------- Modules chargés à la demande ----------
  A.exportDialog = async (preset) => (await import('../export/export-ui.js')).openExportDialog(app, preset);
  A.openLibrary = async (cat) => (await import('../library/library-ui.js')).openLibrary(app, cat);
  A.newCharacter = async () => (await import('../library/library-ui.js')).openNewCharacter(app);
  A.saveToLibrary = async () => (await import('../library/library-ui.js')).saveActiveToLibrary(app);
  A.recolor = async () => (await import('../library/library-ui.js')).openRecolor(app);
  A.openPngtuber = async () => (await import('../pngtuber/pngtuber.js')).openPngtuber(app);
  A.openProjects = async () => (await import('../storage/projects-ui.js')).openProjects(app);
  A.saveProjectFile = async () => (await import('../storage/project-file.js')).downloadProject(app);
  A.openProjectFile = async () => (await import('../storage/project-file.js')).openProjectFile(app);
  A.toggleAnimation = async () => (await import('./timeline.js')).toggleTimeline(app);

  A.confirmDiscard = (msg) => confirmDialog(msg, { danger: true, ok: 'Continuer' });
  A.u32ToHex = u32ToHex;

  return A;
}
