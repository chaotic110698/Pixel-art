// Fenêtres d'import : « Image en pixel art » (conversion avec aperçu) et « Planche de
// sprites » (découpe d'une image en images d'animation).

import { h, pickFile, loadImageFromFile, imageToRGBA, debounce } from '../util/dom.js';
import { openDialog } from './dialogs.js';
import { pixelize } from '../core/pixelize.js';
import { Doc } from '../core/doc.js';
import { tr } from './i18n.js';

/** Canvas d'aperçu agrandi sans lissage. */
function drawPixels(canvas, pixels, w, hh, box = 260) {
  const k = Math.max(1, Math.floor(box / Math.max(w, hh)));
  canvas.width = w * k; canvas.height = hh * k;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + w * hh * 4)), w, hh), 0, 0);
  g.drawImage(c, 0, 0, w * k, hh * k);
}

const CHECKER = 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 16px 16px';

/** Image (photo, dessin) -> pixel art, en nouveau dessin ou nouveau calque. */
export async function openPixelizeDialog(app, file = null) {
  file = file || (await pickFile('image/*'));
  if (!file) return;
  const image = await loadImageFromFile(file);
  const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
  const k = Math.min(1, 800 / Math.max(iw, ih)); // source limitée pour rester rapide
  const src = imageToRGBA(image, Math.max(1, Math.round(iw * k)), Math.max(1, Math.round(ih * k)));
  const ratio = ih / iw;
  const o = { width: Math.min(64, iw), mode: 'dominant', palette: 'extract', colors: 16, dither: 'none', strength: 1, saturation: 1.15, contrast: 1.05, clean: true };
  // image d'origine (copie : l'adresse du fichier n'est plus valable après le chargement)
  const before = h('canvas', { width: src.width, height: src.height, style: { maxWidth: '260px', maxHeight: '260px', borderRadius: '6px' } });
  before.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(src.data), src.width, src.height), 0, 0);
  const after = h('canvas', { style: { maxWidth: '100%', imageRendering: 'pixelated', background: CHECKER, borderRadius: '6px' } });
  const info = h('span', { class: 'small muted' });
  let result = null;
  const run = () => {
    o.height = Math.max(1, Math.round(o.width * ratio));
    result = pixelize(src, { ...o, projectPalette: app.doc.palette });
    drawPixels(after, result.pixels, result.w, result.h);
    info.textContent = `${result.w} × ${result.h}`;
  };
  const later = debounce(run, 120);
  const field = (label, el) => h('label', { class: 'row nowrap' }, h('span', { class: 'small', style: { width: '130px' } }, label), el);
  const range = (key, min, max, step) => h('input', { type: 'range', min, max, step, value: o[key], class: 'grow', oninput: (e) => { o[key] = +e.target.value; later(); } });
  const select = (key, opts) => h('select', { class: 'input grow', onchange: (e) => { o[key] = e.target.value; later(); } },
    opts.map(([v, l]) => h('option', { value: v, selected: o[key] === v }, l)));
  const widthIn = h('input', { type: 'number', class: 'input num', min: 8, max: 512, value: o.width, 'aria-label': 'Largeur (px)', oninput: (e) => { o.width = Math.max(8, Math.min(512, parseInt(e.target.value, 10) || 64)); later(); } });
  run();
  openDialog({
    title: 'Image en pixel art',
    wide: true,
    body: [
      h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px' } }, before, h('div', {}, after, h('div', {}, info))),
      field('Largeur (px)', h('span', { class: 'row nowrap' }, widthIn, ...[32, 48, 64, 96, 128].map((v) => h('button', { class: 'btn small', onclick: () => { widthIn.value = v; o.width = v; run(); } }, String(v))))),
      field('Réduction', select('mode', [['dominant', 'Nette (couleur dominante)'], ['average', 'Douce (moyenne)']])),
      field('Couleurs', select('palette', [['extract', 'Extraire les meilleures couleurs'], ['project', 'Palette du projet'], ['none', 'Toutes les couleurs']])),
      field('Nombre de couleurs', range('colors', 2, 64, 1)),
      field('Tramage', select('dither', [['none', 'Aucun (aplats)'], ['ordered', 'Ordonné (motif régulier)'], ['diffusion', 'Diffusion (dégradés fins)']])),
      field('Saturation', range('saturation', 0.5, 2, 0.05)),
      field('Contraste', range('contrast', 0.5, 2, 0.05)),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: o.clean, onchange: (e) => { o.clean = e.target.checked; later(); } }), 'Nettoyer les pixels isolés'),
      h('p', { class: 'hint' }, 'Astuce : une image recadrée sur le sujet, sur fond uni, donne le meilleur résultat. Retouchez ensuite les contours et les yeux à la main.'),
    ],
    buttons: [
      { label: 'Annuler', value: null },
      { label: 'Nouveau calque', value: true, action: () => {
        run();
        const doc = app.doc;
        app.history.transact('Image en pixel art', () => {
          const l = doc.createLayer(tr('Image convertie'));
          for (let y = 0; y < Math.min(result.h, doc.height); y++) for (let x = 0; x < Math.min(result.w, doc.width); x++) l.cels[doc.frame][y * doc.width + x] = result.pixels[y * result.w + x];
          const act = doc.active;
          doc.insert(l, act && act.type === 'group' ? act.id : act ? act.parent : 'root', act && act.type === 'layer' ? doc.get(act.parent).children.indexOf(act.id) + 1 : undefined);
          doc.activeId = l.id;
        });
        if (result.w > doc.width || result.h > doc.height) app.toast('Image plus grande que le dessin : agrandissez le canevas ou créez un nouveau dessin');
        return true;
      } },
      { label: 'Nouveau dessin', primary: true, value: true, action: async () => {
        run();
        await app.storage?.saveNow();
        const doc = new Doc(result.w, result.h, (file.name || 'Image').replace(/\.[^.]+$/, ''));
        doc.palette = result.palette.length ? [...result.palette] : [...app.doc.palette];
        const l = doc.createLayer(tr('Image convertie'));
        l.cels[0].set(result.pixels);
        doc.insert(l, 'root');
        doc.activeId = l.id;
        app.setDoc(doc);
        return true;
      } },
    ],
  });
}

/** Planche de sprites -> animation (une case = une image). */
export async function openSpritesheetDialog(app, file = null) {
  file = file || (await pickFile('image/*'));
  if (!file) return;
  const image = await loadImageFromFile(file);
  const W = image.naturalWidth || image.width, H = image.naturalHeight || image.height;
  const rgba = imageToRGBA(image, W, H);
  const px = new Uint32Array(rgba.data.buffer.slice(0));
  // taille de case devinée : cases carrées de la hauteur si la largeur en est un multiple
  const guess = W % H === 0 ? H : H % W === 0 ? W : Math.min(W, H);
  const o = { cw: guess, ch: guess, ox: 0, oy: 0, gap: 0, skip: true, duration: 100 };
  const canvas = h('canvas', { style: { maxWidth: '100%', imageRendering: 'pixelated', background: CHECKER, borderRadius: '6px' } });
  const info = h('p', { class: 'small' });
  const cells = () => {
    const out = [];
    for (let y = o.oy; y + o.ch <= H; y += o.ch + o.gap) for (let x = o.ox; x + o.cw <= W; x += o.cw + o.gap) {
      let empty = true;
      for (let j = 0; j < o.ch && empty; j++) for (let i = 0; i < o.cw; i++) if (px[(y + j) * W + x + i] >>> 24) { empty = false; break; }
      if (!(o.skip && empty)) out.push([x, y]);
    }
    return out;
  };
  const draw = () => {
    const k = Math.max(1, Math.min(8, Math.floor(560 / W)));
    canvas.width = W * k; canvas.height = H * k;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(image, 0, 0, W * k, H * k);
    const list = cells();
    g.lineWidth = 2;
    list.forEach(([x, y], n) => {
      g.strokeStyle = '#ff5ab4';
      g.strokeRect(x * k + 1, y * k + 1, o.cw * k - 2, o.ch * k - 2);
      g.fillStyle = '#ff5ab4';
      g.font = `${Math.max(10, Math.min(14, o.cw * k / 3))}px sans-serif`;
      g.fillText(String(n + 1), x * k + 4, y * k + 14);
    });
    info.textContent = `${list.length} image(s) de ${o.cw} × ${o.ch} pixels`;
  };
  const num = (label, key, min, max) => h('label', { class: 'small' }, label, ' ',
    h('input', { type: 'number', class: 'input num', min, max, value: o[key], 'aria-label': label, oninput: (e) => { o[key] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); draw(); } }));
  draw();
  openDialog({
    title: 'Importer une planche de sprites',
    wide: true,
    body: [
      h('div', { class: 'row' }, num('Largeur d\'une case', 'cw', 1, W), num('Hauteur d\'une case', 'ch', 1, H), num('Décalage X', 'ox', 0, W - 1), num('Décalage Y', 'oy', 0, H - 1), num('Espacement', 'gap', 0, 64), num('Durée (ms)', 'duration', 10, 5000)),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: o.skip, onchange: (e) => { o.skip = e.target.checked; draw(); } }), 'Ignorer les cases vides'),
      h('div', { style: { overflow: 'auto', maxHeight: '50vh' } }, canvas),
      info,
    ],
    buttons: [
      { label: 'Annuler', value: null },
      { label: 'Créer l\'animation', primary: true, value: true, action: async () => {
        const list = cells();
        if (!list.length) { app.toast('Aucune case à importer'); return false; }
        await app.storage?.saveNow();
        const doc = new Doc(o.cw, o.ch, (file.name || 'Animation').replace(/\.[^.]+$/, ''));
        doc.frames = list.map(() => ({ duration: o.duration }));
        doc.palette = [...app.doc.palette];
        const l = doc.createLayer(tr('Calque 1'));
        list.forEach(([x, y], f) => {
          const cel = l.cels[f];
          for (let j = 0; j < o.ch; j++) for (let i = 0; i < o.cw; i++) cel[j * o.cw + i] = px[(y + j) * W + x + i];
        });
        doc.insert(l, 'root');
        doc.activeId = l.id;
        app.setDoc(doc);
        if (!app.timelineOpen) app.actions.toggleAnimation?.();
        app.toast(`${list.length} image(s) importée(s)`);
        return true;
      } },
    ],
  });
}
