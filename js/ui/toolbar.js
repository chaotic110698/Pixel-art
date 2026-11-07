// Barre d'outils + barre d'options contextuelle.

import { h, clear } from '../util/dom.js';
import { icon } from './icons.js';
import { DITHER_PATTERNS, ditherFn } from '../core/raster.js';

const TOOL_ICONS = {
  pencil: 'pencil', eraser: 'eraser', fill: 'fill', picker: 'picker', line: 'line', rect: 'rect',
  ellipse: 'ellipse', select: 'select', lasso: 'lasso', wand: 'wand', move: 'move', hand: 'hand', shade: 'shade', gradient: 'gradient',
};
// Outils regroupés par famille : un bouton par groupe (dernier outil utilisé),
// les autres outils du groupe dans un petit menu.
export const TOOL_GROUPS = [
  { id: 'draw', name: 'Dessin', tools: ['pencil', 'eraser', 'shade'] },
  { id: 'fill', name: 'Remplissage', tools: ['fill', 'gradient'] },
  { id: 'picker', name: 'Pipette', tools: ['picker'] },
  { id: 'shapes', name: 'Formes', tools: ['line', 'rect', 'ellipse'] },
  { id: 'select', name: 'Sélection', tools: ['select', 'lasso', 'wand'] },
  { id: 'nav', name: 'Déplacer', tools: ['move', 'hand'] },
];

export function groupOf(toolId) {
  return TOOL_GROUPS.find((g) => g.tools.includes(toolId));
}

function openFlyout(app, group, anchor) {
  closeFlyout();
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const fly = h('div', { class: 'tool-flyout', role: 'menu', 'aria-label': group.name },
    h('div', { class: 'menu-heading' }, group.name),
    group.tools.map((id) => {
      const t = app.tools.get(id);
      return h('button', {
        class: 'menu-item' + (app.tools.current.id === id ? ' checked' : ''),
        role: 'menuitem',
        onclick: () => { closeFlyout(); app.tools.select(id); },
      }, icon(TOOL_ICONS[id]), h('span', { class: 'lbl' }, t.name), h('kbd', {}, t.key));
    }));
  document.body.append(fly);
  const r = anchor.getBoundingClientRect();
  const fw = fly.offsetWidth, fh = fly.offsetHeight;
  let x, y;
  if (mobile) {
    x = Math.min(window.innerWidth - fw - 8, Math.max(8, r.left));
    y = r.top - fh - 6;
  } else {
    x = r.right + 6;
    y = Math.min(window.innerHeight - fh - 8, Math.max(8, r.top));
  }
  fly.style.left = x + 'px';
  fly.style.top = Math.max(8, y) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
  function onOutside(e) {
    if (!fly.contains(e.target)) closeFlyout();
  }
  fly._cleanup = () => document.removeEventListener('pointerdown', onOutside, true);
}

export function closeFlyout() {
  for (const f of document.querySelectorAll('.tool-flyout')) {
    f._cleanup?.();
    f.remove();
  }
}

export function initToolbar(app, { openColorEditor }) {
  const bar = document.getElementById('toolbar');
  const buttons = new Map(); // groupId -> bouton
  const lastOf = () => ({ ...(app.state.toolGroupLast || {}) });
  const toolsBox = h('div', { class: 'tb-tools' });
  for (const g of TOOL_GROUPS) {
    const b = h('button', { class: 'icon-btn tb-group' + (g.tools.length > 1 ? ' multi' : ''), dataset: { group: g.id } });
    let timer = null, longPressed = false;
    b.addEventListener('pointerdown', (e) => {
      longPressed = false;
      if (g.tools.length > 1) timer = setTimeout(() => { longPressed = true; openFlyout(app, g, b); }, 450);
      void e;
    });
    const stop = () => clearTimeout(timer);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointerleave', stop);
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (g.tools.length > 1) openFlyout(app, g, b);
    });
    b.addEventListener('click', () => {
      if (longPressed) return;
      const cur = app.tools.current.id;
      // re-cliquer sur le groupe actif ouvre la liste de ses outils
      if (g.tools.includes(cur) && g.tools.length > 1) return openFlyout(app, g, b);
      app.tools.select(lastOf()[g.id] || g.tools[0]);
    });
    buttons.set(g.id, b);
    toolsBox.append(b);
  }
  bar.append(toolsBox);

  // pastilles couleur primaire / secondaire (en bas)
  const c1 = h('button', { class: 'c1', title: 'Couleur principale (clic : modifier)', 'aria-label': 'Couleur principale', onclick: () => openColorEditor('primary') }, h('i'));
  const c2 = h('button', { class: 'c2', title: 'Couleur secondaire (clic : modifier)', 'aria-label': 'Couleur secondaire', onclick: () => openColorEditor('secondary') }, h('i'));
  const chip = h('div', { class: 'color-chip' }, c1, c2);
  const swap = h('button', { class: 'icon-btn small', title: 'Échanger les couleurs (X)', 'aria-label': 'Échanger les couleurs', onclick: () => app.swapColors() }, icon('swap'));
  // guide complet, juste au-dessus des couleurs
  bar.append(h('div', { class: 'tb-help' },
    h('button', { class: 'icon-btn', title: 'Guide complet : outils, navigation, fonctionnalités (F1)', 'aria-label': 'Guide', onclick: () => app.openGuide?.() }, icon('book'))));
  bar.append(h('div', { class: 'tb-colors' }, chip, swap));

  const refresh = () => {
    const cur = app.tools.current.id;
    const last = lastOf();
    for (const g of TOOL_GROUPS) {
      const b = buttons.get(g.id);
      const shown = g.tools.includes(cur) ? cur : last[g.id] || g.tools[0];
      const t = app.tools.get(shown);
      b.replaceChildren(icon(TOOL_ICONS[shown]));
      b.classList.toggle('active', g.tools.includes(cur));
      const others = g.tools.length > 1 ? ' — clic droit ou appui long : autres outils' : '';
      b.title = `${t.name} (${t.key})${others}`;
      b.setAttribute('aria-label', g.tools.length > 1 ? `${g.name} : ${t.name}` : t.name);
      b.dataset.tool = shown;
    }
    c1.querySelector('i').style.background = app.state.primary;
    c2.querySelector('i').style.background = app.state.secondary;
    app.input?.updateCursor();
  };
  app.on('tool', (t) => {
    // mémoriser le dernier outil de chaque groupe
    const g = t && groupOf(t.id);
    if (g && (app.state.toolGroupLast || {})[g.id] !== t.id) {
      app.state.toolGroupLast = { ...(app.state.toolGroupLast || {}), [g.id]: t.id };
      app.savePrefs();
    }
    refresh();
    renderOptions(app);
  });
  // clés d'état qui n'affectent pas la barre d'options (évite de la reconstruire à chaque trait)
  const IGNORED = new Set(['primary', 'secondary', 'recent', 'charColors', 'libraryCat', 'exportScale', 'exportCrop', 'exportIncludeProject', 'lastExportKind', 'tutorialDone', 'lastPalette', 'theme', 'showMinimap', 'showVariantBar', 'showPixelGrid', 'wheelPans', 'onion', 'toolGroupLast', 'libFavorites', 'ui', 'guideChapter']);
  app.on('state', (patch) => {
    refresh();
    if (patch && Object.keys(patch).length && Object.keys(patch).every((k) => IGNORED.has(k))) return;
    if (!patch) return; // changement de couleur ou de couleurs récentes
    renderOptions(app);
  });
  app.on('color', refresh);
  app.on('keymap', refresh);
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
    type: 'number', class: 'input num', min, max, value, 'aria-label': label,
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
  const scroll = bar.scrollLeft;
  requestAnimationFrame(() => { bar.scrollLeft = scroll; });
  clear(bar);
  bar.append(h('span', { class: 'opt-title' }, t.name));
  const paint = ['pencil', 'eraser', 'line', 'rect', 'ellipse'].includes(t.id);
  if (['pencil', 'eraser', 'shade'].includes(t.id)) {
    bar.append(numberStepper('Taille', st.brushSize, 1, 64, (v) => set({ brushSize: v })));
    bar.append(seg([['square', '■', 'Pinceau carré'], ['round', '●', 'Pinceau rond']], st.brushShape, (v) => set({ brushShape: v })));
    bar.append(check('Pixel perfect', !!st.pixelPerfect, (v) => set({ pixelPerfect: v }), 'Supprime les doubles pixels dans les courbes (taille 1)'));
  }
  if (t.id === 'pencil') {
    bar.append(seg([['normal', 'Normal'], ['replace', 'Remplacer']], st.pencilMode || 'normal', (v) => set({ pencilMode: v })));
  }
  if (t.id === 'shade') {
    bar.append(seg([['lighten', '☀ Éclaircir'], ['darken', '☾ Assombrir']], st.shadeMode || 'lighten', (v) => set({ shadeMode: v })));
    bar.append(h('span', { class: 'small muted' }, 'Suit la palette · clic droit = inverse'));
  }
  if (t.id === 'gradient') {
    bar.append(seg([['linear', 'Linéaire'], ['radial', 'Radial']], st.gradientShape || 'linear', (v) => set({ gradientShape: v })));
    bar.append(seg([['layer', 'Tout le calque'], ['region', 'Zone touchée']], st.gradientArea || 'layer', (v) => set({ gradientArea: v })));
    bar.append(check('Tramé', st.gradientDither !== false, (v) => set({ gradientDither: v })));
    bar.append(h('span', { class: 'small muted' }, 'Glisser de A vers B · la sélection limite la zone'));
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
      h('input', { type: 'range', min: 0, max: 100, value: st.fillTolerance, 'aria-label': 'Tolérance', onchange: (e) => set({ fillTolerance: +e.target.value }) })));
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
  if (app.freeTransform) {
    // transformation libre en cours : réglages en direct
    const ft = app.freeTransform;
    const A = app.actions;
    const slider = (label, key, min, max, unit) => {
      const out = h('span', { class: 'small', style: { width: '46px' } }, ft[key] + unit);
      return h('span', { class: 'opt-group' }, h('span', { class: 'lbl' }, label),
        h('input', { type: 'range', min, max, value: ft[key], oninput: (e) => {
          const v = +e.target.value;
          const patch = { [key]: v };
          if (ft.lock && key === 'sx') patch.sy = v;
          if (ft.lock && key === 'sy') patch.sx = v;
          out.textContent = v + unit;
          A.updateTransform(patch);
        } }), out);
    };
    bar.append(
      h('span', { class: 'opt-group' }, h('strong', {}, 'Transformer')),
      slider('Angle', 'angle', -180, 180, '°'),
      h('span', { class: 'opt-group' }, ...[-90, -45, 0, 45, 90].map((a) => h('button', { class: 'btn small', onclick: () => { A.updateTransform({ angle: a }); renderOptions(app); } }, a + '°'))),
      slider('Largeur', 'sx', 10, 400, ' %'),
      slider('Hauteur', 'sy', 10, 400, ' %'),
      check('Proportions liées', ft.lock, (v) => { ft.lock = v; }),
      check('Lissage pixel art', ft.smooth, (v) => A.updateTransform({ smooth: v }), 'Rotation de type RotSprite : évite les pixels cassés'),
      h('button', { class: 'btn small primary', onclick: () => A.endTransform(false) }, 'Valider'),
      h('button', { class: 'btn small', onclick: () => A.endTransform(true) }, 'Annuler'));
    return;
  }
  if (['select', 'lasso', 'wand', 'move'].includes(t.id)) {
    const sel = app.selection;
    const has = sel.active;
    const tb = (ic, title, fn, dis = false) => h('button', { class: 'icon-btn small', title, 'aria-label': title, disabled: dis, onclick: fn }, icon(ic));
    bar.append(h('span', { class: 'opt-group' },
      tb('flipH', 'Miroir horizontal (Maj+H)', () => sel.transformFloating('flipH')),
      tb('flipV', 'Miroir vertical (Maj+V)', () => sel.transformFloating('flipV')),
      tb('rotate', 'Rotation 90° (Maj+R)', () => sel.transformFloating('cw')),
      tb('transform', 'Rotation libre / échelle (Ctrl+T)', () => app.actions.startTransform()),
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
  bar.append(h('button', { class: 'icon-btn small opt-help', title: 'Comment utiliser cet outil ? (F1)', 'aria-label': 'Aide sur cet outil', onclick: () => app.openToolGuide?.() }, icon('help')));
}
