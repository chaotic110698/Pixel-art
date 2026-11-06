// Barre d'outils + barre d'options contextuelle.

import { h, clear } from '../util/dom.js';
import { icon } from './icons.js';
import { DITHER_PATTERNS, ditherFn } from '../core/raster.js';

const TOOL_ICONS = {
  pencil: 'pencil', eraser: 'eraser', fill: 'fill', picker: 'picker', line: 'line', rect: 'rect',
  ellipse: 'ellipse', select: 'select', lasso: 'lasso', wand: 'wand', move: 'move', hand: 'hand',
};
const ORDER = ['pencil', 'eraser', 'fill', 'picker', '|', 'line', 'rect', 'ellipse', '|', 'select', 'lasso', 'wand', 'move', '|', 'hand'];

export function initToolbar(app, { openColorEditor }) {
  const bar = document.getElementById('toolbar');
  const buttons = new Map();
  for (const id of ORDER) {
    if (id === '|') {
      bar.append(h('div', { class: 'tb-sep' }));
      continue;
    }
    const t = app.tools.get(id);
    const b = h('button', {
      class: 'icon-btn',
      title: `${t.name} (${t.key})`,
      'aria-label': t.name,
      dataset: { tool: id },
      onclick: () => app.tools.select(id),
    }, icon(TOOL_ICONS[id]));
    buttons.set(id, b);
    bar.append(b);
  }
  bar.append(h('div', { class: 'tb-sep' }));
  const sym = h('button', { class: 'icon-btn', title: 'Symétrie (S)', 'aria-label': 'Symétrie', onclick: () => cycleSymmetry(app) }, icon('symmetry'));
  const dith = h('button', { class: 'icon-btn', title: 'Tramage / dithering (D)', 'aria-label': 'Tramage', onclick: () => app.setState({ dither: !app.state.dither }) }, icon('dither'));
  bar.append(sym, dith);
  bar.append(h('div', { class: 'tb-sep' }));

  // pastilles couleur primaire / secondaire
  const c1 = h('button', { class: 'c1', title: 'Couleur principale (clic : modifier)', 'aria-label': 'Couleur principale', onclick: () => openColorEditor('primary') }, h('i'));
  const c2 = h('button', { class: 'c2', title: 'Couleur secondaire (clic : modifier)', 'aria-label': 'Couleur secondaire', onclick: () => openColorEditor('secondary') }, h('i'));
  const chip = h('div', { class: 'color-chip' }, c1, c2);
  const swap = h('button', { class: 'icon-btn small', title: 'Échanger les couleurs (X)', 'aria-label': 'Échanger les couleurs', onclick: () => app.swapColors() }, icon('swap'));
  bar.append(chip, swap);

  const refresh = () => {
    for (const [id, b] of buttons) b.classList.toggle('active', app.tools.current.id === id);
    sym.classList.toggle('active', app.state.symmetry !== 'none');
    dith.classList.toggle('active', app.state.dither);
    c1.querySelector('i').style.background = app.state.primary;
    c2.querySelector('i').style.background = app.state.secondary;
    app.input?.updateCursor();
  };
  app.on('tool', () => {
    refresh();
    renderOptions(app);
  });
  app.on('state', () => {
    refresh();
    renderOptions(app);
  });
  app.on('color', refresh);
  refresh();
  renderOptions(app);
}

export function cycleSymmetry(app) {
  const order = ['none', 'v', 'h', 'both'];
  const next = order[(order.indexOf(app.state.symmetry) + 1) % order.length];
  app.setState({ symmetry: next });
  app.toast(`Symétrie : ${{ none: 'aucune', v: 'verticale (gauche/droite)', h: 'horizontale (haut/bas)', both: 'les deux' }[next]}`);
}

// ---------- Barre d'options ----------
function seg(options, value, onChange) {
  return h('div', { class: 'seg' }, options.map(([v, label, title]) =>
    h('button', { class: v === value ? 'on' : '', title: title || '', onclick: () => onChange(v) }, label)));
}

function check(label, value, onChange, title = '') {
  return h('label', { class: 'chk', title }, h('input', { type: 'checkbox', checked: value, onchange: (e) => onChange(e.target.checked) }), label);
}

function numberStepper(label, value, min, max, onChange) {
  const inp = h('input', {
    type: 'number', class: 'input num', min, max, value,
    onchange: (e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min))),
  });
  return h('span', { class: 'opt-group' }, h('span', { class: 'lbl' }, label),
    h('button', { class: 'icon-btn small', 'aria-label': 'Moins', onclick: () => onChange(Math.max(min, value - 1)) }, '−'),
    inp,
    h('button', { class: 'icon-btn small', 'aria-label': 'Plus', onclick: () => onChange(Math.min(max, value + 1)) }, '+'));
}

function ditherPreview(id) {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  const fn = ditherFn(id);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 8, 8);
  g.fillStyle = '#000';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (fn(x, y)) g.fillRect(x, y, 1, 1);
  c.style.cssText = 'width:24px;height:24px;image-rendering:pixelated;border-radius:3px;vertical-align:middle';
  return c;
}

export function renderOptions(app) {
  const bar = document.getElementById('optionsbar');
  if (!bar) return;
  const st = app.state;
  const t = app.tools.current;
  const set = (patch) => app.setState(patch);
  clear(bar);
  bar.append(h('span', { class: 'opt-title' }, t.name));
  const paint = ['pencil', 'eraser', 'line', 'rect', 'ellipse'].includes(t.id);
  if (['pencil', 'eraser'].includes(t.id)) {
    bar.append(numberStepper('Taille', st.brushSize, 1, 64, (v) => set({ brushSize: v })));
    bar.append(seg([['square', '■', 'Pinceau carré'], ['round', '●', 'Pinceau rond']], st.brushShape, (v) => set({ brushShape: v })));
  }
  if (['line', 'rect', 'ellipse'].includes(t.id)) {
    bar.append(numberStepper('Épaisseur', st.shapeSize, 1, 32, (v) => set({ shapeSize: v })));
  }
  if (['rect', 'ellipse'].includes(t.id)) {
    bar.append(seg([[false, 'Contour'], [true, 'Plein']], st.shapeFill, (v) => set({ shapeFill: v })));
  }
  if (t.id === 'fill') {
    bar.append(seg([[true, 'Contigu'], [false, 'Global']], st.fillContiguous, (v) => set({ fillContiguous: v })));
    bar.append(check('Tous les calques', st.fillSampleAll, (v) => set({ fillSampleAll: v }), 'Délimiter selon l\'image visible'));
    bar.append(h('span', { class: 'opt-group' }, h('span', { class: 'lbl' }, 'Tolérance'),
      h('input', { type: 'range', min: 0, max: 100, value: st.fillTolerance, oninput: (e) => { st.fillTolerance = +e.target.value; }, onchange: () => set({}) })));
  }
  if (t.id === 'picker') {
    bar.append(seg([[true, 'Image'], [false, 'Calque actif']], st.pickerSampleAll, (v) => set({ pickerSampleAll: v })));
    bar.append(check('Revenir à l\'outil précédent', st.pickerReturn, (v) => set({ pickerReturn: v })));
  }
  if (['select', 'lasso', 'wand'].includes(t.id)) {
    bar.append(seg([['replace', 'Nouvelle'], ['add', '+ Ajouter'], ['subtract', '− Retirer']], st.selectMode, (v) => set({ selectMode: v })));
    if (t.id === 'wand') {
      bar.append(seg([[true, 'Contigu'], [false, 'Même couleur partout']], st.wandContiguous, (v) => set({ wandContiguous: v })));
      bar.append(check('Image visible', st.wandSampleAll, (v) => set({ wandSampleAll: v })));
    }
  }
  if (['select', 'lasso', 'wand', 'move'].includes(t.id)) {
    const sel = app.selection;
    const has = sel.active;
    const tb = (ic, title, fn, dis = false) => h('button', { class: 'icon-btn small', title, 'aria-label': title, disabled: dis, onclick: fn }, icon(ic));
    bar.append(h('span', { class: 'opt-group' },
      tb('flipH', 'Miroir horizontal (Maj+H)', () => sel.transformFloating('flipH')),
      tb('flipV', 'Miroir vertical (Maj+V)', () => sel.transformFloating('flipV')),
      tb('rotate', 'Rotation 90° (Maj+R)', () => sel.transformFloating('cw')),
      tb('copy', 'Copier (Ctrl+C)', () => app.actions.copy(), !has),
      h('button', { class: 'btn small', onclick: () => app.actions.paste() }, 'Coller'),
      tb('trash', 'Effacer la sélection (Suppr)', () => app.actions.deleteSelection(), !has),
      h('button', { class: 'btn small', disabled: !sel.floating, onclick: () => sel.commitFloating() }, 'Valider'),
      h('button', { class: 'btn small', disabled: !has, onclick: () => sel.deselect() }, 'Désélectionner')));
  }
  if (paint || t.id === 'fill') {
    // tramage
    const dGroup = h('span', { class: 'opt-group' },
      check('Tramage', st.dither, (v) => set({ dither: v }), 'Dithering (D)'));
    if (st.dither) {
      const sel = h('select', { class: 'input', 'aria-label': 'Motif de tramage', onchange: (e) => set({ ditherPattern: e.target.value }) },
        DITHER_PATTERNS.map((p) => h('option', { value: p.id, selected: p.id === st.ditherPattern }, p.name)));
      dGroup.append(ditherPreview(st.ditherPattern), sel,
        seg([['transparent', 'A + vide'], ['secondary', 'A + B']], st.ditherSecond, (v) => set({ ditherSecond: v })));
    }
    bar.append(dGroup);
  }
  if (paint) {
    bar.append(h('span', { class: 'opt-group' }, h('span', { class: 'lbl' }, 'Symétrie'),
      seg([['none', 'Non'], ['v', '⇆'], ['h', '⇅'], ['both', '✛']], st.symmetry, (v) => set({ symmetry: v }))));
  }
  if (st.tileMode && (paint || t.id === 'fill')) {
    bar.append(check('Dessin enroulé', st.tileWrap, (v) => set({ tileWrap: v }), 'Le trait qui sort d\'un bord revient par l\'autre'));
  }
}
