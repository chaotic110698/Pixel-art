// Outil Texte : un clic ouvre la saisie (polices pixel), le texte devient un contenu
// flottant à la position cliquée, à déplacer puis valider comme un collage.

import { Tool } from './paint-tools.js';
import { h, clear } from '../util/dom.js';
import { openDialog } from '../ui/dialogs.js';
import { FONTS, textPixels } from '../core/fonts.js';

export class TextTool extends Tool {
  id = 'text';
  name = 'Texte';
  key = 'Y';
  cursor = 'text';
  down(p) {
    const app = this.app;
    if (!app.editableLayer()) return;
    app.selection.commitFloating();
    openTextDialog(app, Math.max(0, p.ix), Math.max(0, p.iy));
  }
}

/** Options du texte enregistrées dans les préférences. */
export function textOptions(app) {
  const st = app.state;
  return { font: st.textFont || 'std', scale: st.textScale || 1, spacing: st.textSpacing ?? 1, align: st.textAlign || 'left', outline: !!st.textOutline };
}

/** Pixels du texte avec les couleurs A (lettres) et B (contour). */
export function buildText(app, text, o = textOptions(app)) {
  return textPixels(text, o.font, { scale: o.scale, spacing: o.spacing, align: o.align, color: app.colorU32('primary'), outline: o.outline ? app.colorU32('secondary') : null });
}

/** Fenêtre de saisie avec aperçu ; pose le texte en (x, y) sur le calque actif. */
export function openTextDialog(app, x, y) {
  const o = textOptions(app);
  const area = h('textarea', { class: 'input', rows: 3, style: { width: '100%', fontSize: '16px' }, 'aria-label': 'Texte', placeholder: 'Votre texte (plusieurs lignes possibles)', translate: 'no' });
  area.value = app.state.lastText || '';
  const preview = h('canvas', { class: 'text-preview', width: 8, height: 8, style: { imageRendering: 'pixelated', maxWidth: '100%', background: 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 16px 16px', borderRadius: '6px' } });
  const fontSel = h('select', { class: 'input', 'aria-label': 'Police', onchange: (e) => { o.font = e.target.value; draw(); } },
    FONTS.map((f) => h('option', { value: f.id, selected: f.id === o.font }, f.name)));
  const num = (label, key, min, max) => h('label', { class: 'small' }, label, ' ',
    h('input', { type: 'number', class: 'input num', min, max, value: o[key], 'aria-label': label, oninput: (e) => { o[key] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); draw(); } }));
  const alignSeg = h('div', { class: 'seg' });
  const renderAlign = () => {
    clear(alignSeg);
    for (const [v, l, t] of [['left', '⇤', 'Aligner à gauche'], ['center', '↔', 'Centrer'], ['right', '⇥', 'Aligner à droite']]) {
      alignSeg.append(h('button', { class: o.align === v ? 'on' : '', title: t, 'aria-label': t, onclick: () => { o.align = v; renderAlign(); draw(); } }, l));
    }
  };
  renderAlign();
  const outline = h('label', { class: 'chk', title: 'Contour d\'un pixel dans la couleur B, pour rester lisible sur tous les fonds' },
    h('input', { type: 'checkbox', checked: o.outline, onchange: (e) => { o.outline = e.target.checked; draw(); } }), 'Contour (couleur B)');
  function draw() {
    const t = buildText(app, area.value || ' ', o);
    const k = Math.max(1, Math.min(6, Math.floor(420 / Math.max(1, t.w))));
    preview.width = t.w * k; preview.height = t.h * k;
    const g = preview.getContext('2d');
    g.imageSmoothingEnabled = false;
    const c = document.createElement('canvas');
    c.width = t.w; c.height = t.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(t.data.buffer.slice(0)), t.w, t.h), 0, 0);
    g.drawImage(c, 0, 0, t.w * k, t.h * k);
  }
  area.addEventListener('input', draw);
  draw();
  openDialog({
    title: 'Texte',
    body: [
      area,
      h('div', { class: 'row', style: { marginTop: '8px' } }, fontSel, num('Taille ×', 'scale', 1, 8), num('Espacement', 'spacing', 0, 4), alignSeg, outline),
      h('div', { style: { marginTop: '8px', overflow: 'auto' } }, preview),
      h('p', { class: 'hint' }, 'Le texte est posé à l\'endroit cliqué avec la couleur A, comme un collage : déplacez-le, puis validez (Entrée).'),
    ],
    buttons: [
      { label: 'Annuler', value: null },
      {
        label: 'Poser le texte', primary: true, value: true, action: () => {
          const text = area.value;
          if (!text.trim()) return false;
          app.setState({ lastText: text, textFont: o.font, textScale: o.scale, textSpacing: o.spacing, textAlign: o.align, textOutline: o.outline });
          const t = buildText(app, text, o);
          const mask = new Uint8Array(t.w * t.h);
          for (let i = 0; i < mask.length; i++) mask[i] = t.data[i] >>> 24 ? 1 : 0;
          if (app.tools.current.id !== 'move') app.tools.select('move');
          app.selection.paste(t.data, t.w, t.h, Math.min(x, Math.max(0, app.doc.width - t.w)), Math.min(y, Math.max(0, app.doc.height - t.h)), mask);
          return true;
        },
      },
    ],
  });
}
