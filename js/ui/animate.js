// « Animer le calque » : génère des images d'animation à partir du contenu du calque actif
// (image courante) : déplacement interpolé avec accélération, flottement, respiration,
// tremblement, clignotement, apparition / disparition en fondu tramé. Les autres calques
// restent identiques (images liées). Une seule entrée d'historique.

import { h, clear } from '../util/dom.js';
import { openDialog } from './dialogs.js';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const EASINGS = [
  ['linear', 'Constante'],
  ['in', 'Accélère'],
  ['out', 'Ralentit'],
  ['inout', 'Accélère puis ralentit'],
  ['bounce', 'Rebond à l\'arrivée'],
];
const ease = (k, t) => {
  if (k === 'in') return t * t;
  if (k === 'out') return 1 - (1 - t) * (1 - t);
  if (k === 'inout') return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  if (k === 'bounce') {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  }
  return t;
};

export const EFFECTS = [
  ['move', 'Déplacement (de A à B)'],
  ['float', 'Flottement (haut / bas)'],
  ['breathe', 'Respiration (le haut s\'abaisse)'],
  ['shake', 'Tremblement'],
  ['blink', 'Clignotement'],
  ['fadein', 'Apparition (fondu tramé)'],
  ['fadeout', 'Disparition (fondu tramé)'],
];

/** Contenu décalé de (dx, dy) ; rows : décalage par ligne (respiration) ; keep : seuil de fondu. */
function frameOf(base, w, hh, { dx = 0, dy = 0, rowShift = null, keep = 1, hide = false }) {
  const out = new Uint32Array(w * hh);
  if (hide) return out;
  for (let y = 0; y < hh; y++) {
    const sy = y - dy - (rowShift ? rowShift(y) : 0);
    if (sy < 0 || sy >= hh) continue;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= w) continue;
      const v = base[sy * w + sx];
      if (!(v >>> 24)) continue;
      if (keep < 1 && BAYER4[(y & 3) * 4 + (x & 3)] >= keep * 16) continue;
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Les n images produites par l'effet (tableaux w×h). */
export function animateFrames(base, w, hh, o) {
  const n = Math.max(2, o.frames | 0);
  const amp = o.amp ?? 2;
  // bas du contenu (respiration : le bas reste en place)
  let top = hh, bottom = -1;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (base[y * w + x] >>> 24) { if (y < top) top = y; bottom = y; break; }
  const pivot = top + Math.round((bottom - top) * 0.62);
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const c = (Math.sin((k / n) * Math.PI * 2 - Math.PI / 2) + 1) / 2; // boucle 0 → 1 → 0
    let p = {};
    if (o.effect === 'move') {
      const e = o.pingpong ? ease(o.easing, t < 0.5 ? t * 2 : 2 - t * 2) : ease(o.easing, t);
      p = { dx: Math.round(o.dx * e), dy: Math.round(o.dy * e) };
    } else if (o.effect === 'float') p = { dy: -Math.round(c * amp) };
    else if (o.effect === 'breathe') {
      const s = Math.round(c * amp);
      p = { rowShift: (y) => (y < pivot ? s : y < pivot + s ? s - (y - pivot) : 0) };
    } else if (o.effect === 'shake') {
      const r = (i) => { const v = Math.sin((k + 1) * 12.9898 * (i + 1)) * 43758.5453; return v - Math.floor(v); };
      p = k === n - 1 ? {} : { dx: Math.round((r(0) * 2 - 1) * amp), dy: Math.round((r(1) * 2 - 1) * amp) };
    } else if (o.effect === 'blink') p = { hide: k % 2 === 1 };
    else if (o.effect === 'fadein') p = { keep: t };
    else if (o.effect === 'fadeout') p = { keep: 1 - t };
    out.push(frameOf(base, w, hh, p));
  }
  return out;
}

/** Applique l'effet au calque actif à partir de l'image courante. */
export function applyAnimation(app, o) {
  const doc = app.doc;
  const layer = app.editableLayer();
  if (!layer) return false;
  app.selection.commitFloating();
  const start = doc.frame;
  const base = (layer.cels[start] || doc.newCel()).slice();
  const frames = animateFrames(base, doc.width, doc.height, o);
  app.history.transact('Animer le calque', () => {
    const dur = o.duration || doc.frames[start]?.duration || Math.round(1000 / doc.fps);
    // images manquantes ajoutées à la fin : les autres calques y restent identiques (images liées)
    while (doc.frames.length < start + frames.length) {
      doc.frames.push({ duration: dur });
      for (const l of doc.allLayers()) l.cels.push(l === layer ? doc.newCel() : l.cels[l.cels.length - 1]);
    }
    // nouveaux tableaux : l'instantané de structure partage les anciens
    frames.forEach((px, k) => {
      layer.cels[start + k] = px;
      if (o.duration) doc.frames[start + k].duration = o.duration;
    });
  });
  app.renderer.invalidateAll();
  app.emit('frame');
  return true;
}

/** Fenêtre de réglage avec aperçu animé. */
export function openAnimateDialog(app) {
  const doc = app.doc;
  const layer = app.editableLayer();
  if (!layer) return;
  const o = { effect: 'float', frames: 8, amp: 2, dx: 16, dy: 0, easing: 'inout', pingpong: false, duration: Math.round(1000 / (doc.fps || 8)) };
  const base = (layer.cels[doc.frame] || doc.newCel()).slice();
  const preview = h('canvas', { style: { imageRendering: 'pixelated', background: 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 16px 16px', borderRadius: '6px', maxWidth: '100%' } });
  const params = h('div', {});
  let frames = [], k = 0, timer = null;
  const tmp = document.createElement('canvas');
  tmp.width = doc.width; tmp.height = doc.height;
  const draw = () => {
    const s = Math.max(1, Math.floor(220 / Math.max(doc.width, doc.height)));
    preview.width = doc.width * s; preview.height = doc.height * s;
    const g = preview.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, preview.width, preview.height);
    const px = frames[k % frames.length];
    if (px) {
      tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer.slice(0)), doc.width, doc.height), 0, 0);
      g.drawImage(tmp, 0, 0, preview.width, preview.height);
    }
  };
  const rebuild = () => { frames = animateFrames(base, doc.width, doc.height, o); k = 0; draw(); };
  const tick = () => { k = (k + 1) % Math.max(1, frames.length); draw(); timer = setTimeout(tick, o.duration); };
  const num = (label, key, min, max) => h('label', { class: 'small' }, label, ' ',
    h('input', { type: 'number', class: 'input num', min, max, value: o[key], 'aria-label': label, oninput: (e) => { o[key] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || 0)); rebuild(); } }));
  const renderParams = () => {
    clear(params);
    const row = h('div', { class: 'row' }, num('Images', 'frames', 2, 48), num('Durée (ms)', 'duration', 10, 2000));
    if (o.effect === 'move') {
      row.append(num('Vers la droite (px)', 'dx', -256, 256), num('Vers le bas (px)', 'dy', -256, 256));
      params.append(row,
        h('div', { class: 'row' }, h('span', { class: 'small' }, 'Mouvement'),
          h('select', { class: 'input', 'aria-label': 'Mouvement', onchange: (e) => { o.easing = e.target.value; rebuild(); } }, EASINGS.map(([v, l]) => h('option', { value: v, selected: o.easing === v }, l))),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: o.pingpong, onchange: (e) => { o.pingpong = e.target.checked; rebuild(); } }), 'Aller-retour (boucle)')));
    } else {
      if (['float', 'breathe', 'shake'].includes(o.effect)) row.append(num('Amplitude (px)', 'amp', 1, 16));
      params.append(row);
    }
  };
  const effSel = h('select', { class: 'input', 'aria-label': 'Effet', onchange: (e) => { o.effect = e.target.value; if (o.effect === 'shake' && o.frames > 6) o.frames = 6; renderParams(); rebuild(); } },
    EFFECTS.map(([v, l]) => h('option', { value: v, selected: o.effect === v }, l)));
  renderParams();
  rebuild();
  timer = setTimeout(tick, o.duration);
  openDialog({
    title: 'Animer le calque',
    body: [
      h('p', { class: 'hint' }, 'Le contenu du calque actif, à l\'image courante, est animé sur les images suivantes (ajoutées si besoin). Les autres calques ne bougent pas. Une seule étape à annuler.'),
      h('div', { class: 'row' }, h('span', { class: 'small' }, 'Effet'), effSel),
      params,
      preview,
    ],
    buttons: [
      { label: 'Annuler', value: null },
      { label: 'Animer', primary: true, value: true, action: () => { applyAnimation(app, o); if (!app.timelineOpen) app.actions.toggleAnimation?.(); } },
    ],
    onClose: () => clearTimeout(timer),
  });
}
