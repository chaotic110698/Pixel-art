// Actions de haut niveau partagées par le menu, les raccourcis et les panneaux.

import { h, pickFile, loadImageFromFile, imageToRGBA } from '../util/dom.js';
import { openDialog, confirmDialog } from './dialogs.js';
import { Doc } from '../core/doc.js';
import { hexToU32, u32ToHex, normHex } from '../util/color.js';
import { scaleNearest, outlineMask } from '../core/raster.js';
import { composePixels } from '../render/compose.js';
import { extractPalette } from '../core/palettes.js';
import * as ops from '../core/layer-ops.js';
import * as img from '../core/image-ops.js';

export const SIZE_PRESETS = [16, 32, 64, 128, 256, 512];

/** Position et échelle pour que l'image tienne dans le canevas, centrée. */
export function fitReference(doc, w, h) {
  const scale = Math.min(doc.width / w, doc.height / h);
  return { scale, x: (doc.width - w * scale) / 2, y: (doc.height - h * scale) / 2 };
}

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
    if (as === 'reference') return A.addReference(image, file.name);
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
    app.history.group('Importer une image', () => {
      const layer = ops.addLayer(app, name);
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
    });
    app.toast('Image importée comme calque');
  };

  /**
   * Calque de référence « net » : l'image est conservée en pleine résolution
   * (réduite à 2048 px au plus) et affichée par-dessus la grille de pixels,
   * jamais exportée. Elle se déplace avec l'outil Déplacer.
   */
  A.addReference = (image, filename = 'Image') => {
    const max = 2048;
    const k = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const w = Math.max(1, Math.round(image.naturalWidth * k));
    const hh = Math.max(1, Math.round(image.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, 0, 0, w, hh);
    let src = c.toDataURL('image/webp', 0.9);
    if (!src.startsWith('data:image/webp')) src = c.toDataURL('image/png');
    const doc = app.doc;
    const ref = { src, w, h: hh, ...fitReference(doc, w, hh) };
    const name = `Réf. ${filename.replace(/\.[^.]+$/, '') || 'image'}`;
    app.selection.commitFloating();
    app.history.transact('Importer une référence', () => {
      const layer = doc.createLayer(name, { reference: true, opacity: 0.5, locked: true, refImg: ref });
      doc.insert(layer, 'root', 0); // tout en bas : visible sous le dessin
      doc.activeId = layer.id;
    });
    app.toast('Référence ajoutée (nette, non exportée). Outil Déplacer pour la placer ; taille dans le panneau Calques.', 3500);
  };

  /** Met à jour l'image d'un calque de référence (annulable). `live` : déjà appliqué. */
  A.setReference = (layer, patch, startRef = null) => {
    const node = app.doc.get(layer.id);
    if (!node) return;
    const before = startRef || node.refImg;
    const after = { ...node.refImg, ...patch };
    node.refImg = before;
    app.history.transact('Référence', () => {
      app.doc.get(layer.id).refImg = after;
    });
    app.renderer.requestRender();
  };

  A.fitReference = (layer) => {
    const r = layer.refImg;
    if (r) A.setReference(layer, fitReference(app.doc, r.w, r.h));
  };

  // ---------- Transformation libre de la sélection ----------
  A.startTransform = () => {
    if (app.freeTransform) return;
    if (!app.editableLayer()) return;
    if (!app.selection.beginFreeTransform()) return;
    app.freeTransform = { angle: 0, sx: 100, sy: 100, lock: true, smooth: true };
    if (!['select', 'lasso', 'wand', 'move'].includes(app.tools.current.id)) app.tools.select('move');
    app.emit('tool', app.tools.current);
  };
  A.updateTransform = (patch) => {
    const t = app.freeTransform;
    if (!t) return;
    Object.assign(t, patch);
    app.selection.previewFreeTransform(t.angle, t.sx / 100, t.sy / 100, t.smooth);
  };
  A.endTransform = (cancel = false) => {
    if (!app.freeTransform) return;
    app.selection.endFreeTransform(cancel);
    app.freeTransform = null;
    if (!cancel) app.selection.commitFloating('Rotation / échelle');
    app.emit('tool', app.tools.current);
  };

  // ---------- Contour automatique ----------
  A.outlineDialog = async () => {
    const layer = app.editableLayer();
    if (!layer) return;
    const pos = h('select', { class: 'input wide' }, h('option', { value: 'out' }, 'Extérieur (autour du dessin)'), h('option', { value: 'in' }, 'Intérieur (sur le bord du dessin)'));
    const corners = h('input', { type: 'checkbox' });
    const v = await openDialog({
      title: 'Contour automatique',
      body: [
        h('p', {}, 'Ajoute un contour d\'un pixel avec la couleur A autour du contenu du calque actif (ou de la sélection).'),
        h('div', { class: 'row' }, h('span', { class: 'swatch', style: { background: app.state.primary, width: '32px', display: 'inline-block' } }), h('code', {}, app.state.primary)),
        h('label', { class: 'field' }, h('span', {}, 'Position'), pos),
        h('label', { class: 'chk' }, corners, 'Inclure les coins (contour plus épais en diagonale)'),
      ],
      buttons: [{ label: 'Annuler', value: false }, { label: 'Appliquer', value: true, primary: true }],
    }).result;
    if (!v) return;
    app.selection.commitFloating();
    const doc = app.doc;
    const token = app.history.beginPixels(layer);
    const m = outlineMask(token.before, doc.width, doc.height, { inside: pos.value === 'in', diagonal: corners.checked });
    const sel = app.selection.mask;
    const c = app.colorU32('primary');
    for (let i = 0; i < m.length; i++) if (m[i] && (!sel || sel[i])) token.cel[i] = c;
    app.markLayerDirty(token.cel);
    app.history.endPixels(token, 'Contour automatique');
    app.useColor();
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
  // En cas d'échec (réseau, ancienne version en cache…), on prévient l'utilisateur
  // au lieu d'échouer en silence.
  const lazy = (label, load) => async (...args) => {
    try {
      return await load(...args);
    } catch (err) {
      console.error(`[${label}]`, err);
      app.toast(`Impossible d'ouvrir « ${label} » : ${err?.message || err}. Rechargez la page.`, 5000);
      return undefined;
    }
  };
  A.exportDialog = lazy('Exporter', async (preset) => (await import('../export/export-ui.js')).openExportDialog(app, preset));
  A.openLibrary = lazy('Bibliothèque', async (cat) => (await import('../library/library-ui.js')).openLibrary(app, cat));
  A.newCharacter = lazy('Nouveau personnage', async () => (await import('../library/library-ui.js')).openNewCharacter(app));
  A.saveToLibrary = lazy('Ma bibliothèque', async () => (await import('../library/library-ui.js')).saveActiveToLibrary(app));
  A.recolor = lazy('Recolorer', async () => (await import('../library/library-ui.js')).openRecolor(app));
  A.openPngtuber = lazy('Mode PNGtuber', async () => (await import('../pngtuber/pngtuber.js')).openPngtuber(app));
  A.openProjects = lazy('Mes projets', async () => (await import('../storage/projects-ui.js')).openProjects(app));
  A.saveProjectFile = lazy('Fichier projet', async () => (await import('../storage/project-file.js')).downloadProject(app));
  A.openProjectFile = lazy('Fichier projet', async () => (await import('../storage/project-file.js')).openProjectFile(app));
  A.toggleAnimation = lazy('Animation', async () => (await import('./timeline.js')).toggleTimeline(app));

  A.confirmDiscard = (msg) => confirmDialog(msg, { danger: true, ok: 'Continuer' });
  A.u32ToHex = u32ToHex;

  return A;
}
