// Fenêtres : Bibliothèque, Nouveau personnage, Recolorer, Ma bibliothèque.

import { h, clear, debounce, pickFile, downloadBlob, bytesToBase64, base64ToBytes, slugify } from '../util/dom.js';
import { openDialog, confirmDialog, promptDialog } from '../ui/dialogs.js';
import { icon } from '../ui/icons.js';
import { CATEGORIES, pieceById, insertPiece, previewPixels, docBodyType, templateOffset } from './library.js';
import { DEFAULT_COLORS, recolorMap, TEMPLATE } from './builder.js';
import { ACCESSORY_SUBS } from './parts/accessories.js';
import { buildCharacter, DEFAULT_CHARACTER, autoPngtuber } from './character.js';
import { db } from '../storage/db.js';
import { pixelsToCanvas } from '../render/compose.js';
import { uid } from '../core/doc.js';
import { normHex } from '../util/color.js';
import { resizeCanvas } from '../core/image-ops.js';

const COLOR_FIELDS = [
  ['skin', 'Peau'],
  ['hair', 'Cheveux'],
  ['eyes', 'Yeux'],
  ['clothes', 'Vêtements'],
  ['accent', 'Accessoires'],
];

export const SKIN_TONES = ['#ffe0cc', '#f5c6a5', '#e8a87c', '#d08b5b', '#a8653a', '#7a4428', '#4e2b1b', '#c9e3a0', '#a7c7ff', '#d9b8ff'];
export const HAIR_TONES = ['#1e1410', '#3d2314', '#6b3e26', '#a0602e', '#e0a040', '#f2d57a', '#e8e8f0', '#9a9aa8', '#e04a5a', '#ff8fc8', '#7a5cff', '#3fb5ff', '#3fcf8e'];

// mannequin pour les aperçus
const MANNEQUIN = ['body-moyen', 'head-round'];
const FACE = ['eyes-dots', 'mouth-simple'];

function cropFor(cat) {
  if (['eyes', 'brows', 'nose', 'mouth'].includes(cat)) return [16, 12, 48, 44];
  if (cat === 'hair' || cat === 'accessory') return [6, 0, 58, 52];
  if (cat === 'head') return [10, 4, 54, 48];
  return [0, 0, 64, 64];
}

function layered(ids, piece, colors, bodyType, state) {
  // composition dans l'ordre z des couches
  const entries = [];
  const add = (p, st = null) => {
    const px = previewPixels(p, { colors, bodyType, state: st });
    const z = Math.min(...p.build({ bodyType }).map((l) => l.z));
    entries.push({ z, px, p });
  };
  for (const id of ids) {
    const p = pieceById(id);
    if (p && p.category !== piece.category) add(p);
  }
  add(piece, state);
  entries.sort((a, b) => a.z - b.z);
  const out = new Uint32Array(TEMPLATE * TEMPLATE);
  for (const e of entries) for (let i = 0; i < out.length; i++) if (e.px[i] >>> 24) out[i] = e.px[i];
  // couches arrière des cheveux : composer correctement (arrière sous la tête)
  return out;
}

function previewCanvas(piece, colors, { bodyType = 'moyen', size = 96, state = null } = {}) {
  let px;
  if (piece.category === 'hair') {
    // arrière / tête / avant dans le bon ordre
    px = new Uint32Array(TEMPLATE * TEMPLATE);
    const parts = [];
    for (const L of piece.build({ bodyType })) parts.push({ z: L.z, px: previewPixels({ ...piece, build: () => [L], id: piece.id + L.z }, { colors }) });
    for (const id of MANNEQUIN) {
      const p = pieceById(id);
      parts.push({ z: p.build({})[0].z, px: previewPixels(p, { colors, bodyType }) });
    }
    parts.sort((a, b) => a.z - b.z);
    for (const e of parts) for (let i = 0; i < px.length; i++) if (e.px[i] >>> 24) px[i] = e.px[i];
  } else if (['body', 'top', 'head'].includes(piece.category)) {
    px = layered(piece.category === 'top' ? ['body-' + bodyType] : piece.category === 'head' ? ['body-moyen'] : [], piece, colors, bodyType, state);
  } else {
    px = layered([...MANNEQUIN, ...FACE], piece, colors, bodyType, state);
  }
  const [x0, y0, x1, y1] = cropFor(piece.category);
  const cw = x1 - x0, ch = y1 - y0;
  const crop = new Uint32Array(cw * ch);
  for (let y = 0; y < ch; y++) crop.set(px.subarray((y0 + y) * TEMPLATE + x0, (y0 + y) * TEMPLATE + x1), y * cw);
  const src = pixelsToCanvas(crop, cw, ch);
  const c = h('canvas', { width: size * 2, height: size * 2 });
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const k = Math.floor((size * 2) / Math.max(cw, ch));
  g.drawImage(src, (c.width - cw * k) / 2, (c.height - ch * k) / 2, cw * k, ch * k);
  return c;
}

function colorRow(colors, onChange) {
  return h('div', { class: 'row', style: { gap: '10px', marginBottom: '8px' } }, COLOR_FIELDS.map(([key, label]) => {
    const inp = h('input', { type: 'color', value: normHex(colors[key]).slice(0, 7), style: { width: '40px', height: '32px', border: 0, background: 'none', padding: 0 } });
    inp.addEventListener('change', () => onChange(key, inp.value));
    return h('label', { class: 'row nowrap', style: { gap: '4px' } }, inp, h('span', { class: 'small' }, label));
  }));
}

/** Recolore toutes les pièces du document (échange de palette, annulable). */
export function recolorDoc(app, newColors) {
  const doc = app.doc;
  const old = doc.charColors || DEFAULT_COLORS;
  const map = recolorMap(old, newColors);
  const layers = doc.allLayers().filter((l) => l.part || doc.ancestors(l).some((a) => a.part));
  app.history.group('Recolorer le personnage', () => {
    if (map.size) app.actions.replaceColors(map, layers, 'Recolorer le personnage');
    app.history.transact('Couleurs du personnage', () => {
      doc.charColors = { ...newColors };
    });
  });
}

// ---------- Bibliothèque ----------
export function openLibrary(app, initialCat = null) {
  const doc = app.doc;
  let colors = { ...DEFAULT_COLORS, ...(doc.charColors || app.state.charColors || {}) };
  let cat = initialCat || app.state.libraryCat || 'hair';
  let replace = true;
  const grid = h('div', { class: 'cards' });
  const tabs = h('div', { class: 'tabs-row' });
  const colorsBox = h('div');
  const warn = doc.width < TEMPLATE || doc.height < TEMPLATE
    ? h('p', { class: 'hint', style: { color: 'var(--accent)' } }, `Les pièces sont prévues pour un canevas d'au moins 64×64 px (actuel : ${doc.width}×${doc.height}) : il sera agrandi automatiquement à la première pièce ajoutée (annulable). Astuce : « Nouveau personnage » crée directement un personnage complet.`)
    : null;

  function renderColors() {
    clear(colorsBox);
    colorsBox.append(colorRow(colors, (key, val) => {
      colors = { ...colors, [key]: val };
      app.setState({ charColors: colors });
      if (doc.charColors && app.doc === doc) {
        recolorDoc(app, colors);
        app.toast('Personnage recoloré');
      }
      renderGrid();
    }));
  }

  function renderTabs() {
    clear(tabs);
    for (const c of CATEGORIES) tabs.append(h('button', { class: 'chip' + (c.id === cat ? ' on' : ''), onclick: () => { cat = c.id; app.setState({ libraryCat: cat }); renderTabs(); renderGrid(); } }, c.name));
    tabs.append(h('button', { class: 'chip' + (cat === 'user' ? ' on' : ''), onclick: () => { cat = 'user'; renderTabs(); renderGrid(); } }, '★ Ma bibliothèque'));
  }

  const insert = (piece) => {
    app.selection.commitFloating();
    const d0 = app.doc;
    if (d0.width < TEMPLATE || d0.height < TEMPLATE) {
      // les pièces sont dessinées sur un gabarit 64×64 : on agrandit le canevas (ancré en bas)
      resizeCanvas(app, Math.max(d0.width, TEMPLATE), Math.max(d0.height, TEMPLATE), 'b');
      warn?.remove();
      app.toast(`Canevas agrandi à ${app.doc.width}×${app.doc.height} pour accueillir les pièces`, 2600);
    }
    let addedBase = false;
    const node = app.history.transact(`Ajouter « ${piece.name} »`, () => {
      // sans tête ni corps, une coiffure ou des yeux « flottent » : on ajoute une base
      const has = (cat) => [...app.doc.nodes.values()].some((n) => n.part?.category === cat);
      if (!['body', 'head'].includes(piece.category)) {
        if (!has('body')) { insertPiece(app.doc, pieceById('body-moyen'), { colors }); addedBase = true; }
        if (!has('head') && piece.category !== 'top') { insertPiece(app.doc, pieceById('head-round'), { colors }); addedBase = true; }
      }
      const n = insertPiece(app.doc, piece, { colors, replace: replace && (CATEGORIES.find((c) => c.id === piece.category)?.exclusive || piece.exclusiveKey) });
      if (n) app.doc.activeId = n.type === 'group' ? n.children[n.children.length - 1] : n.id;
      autoPngtuber(app.doc);
      return n;
    });
    app.toast(node ? `« ${piece.name} » ajouté${addedBase ? ' (avec une tête et un corps de base)' : ''}` : `« ${piece.name} » : pièce retirée`, addedBase ? 2800 : 1800);
  };

  async function renderGrid() {
    clear(grid);
    if (cat === 'user') return renderUser();
    const c = CATEGORIES.find((x) => x.id === cat);
    const bodyType = docBodyType(app.doc);
    let lastSub = null;
    for (const p of c.pieces) {
      if (p.sub && p.sub !== lastSub) {
        grid.append(h('h3', { style: { gridColumn: '1 / -1', margin: '6px 0 0' } }, ACCESSORY_SUBS[p.sub] || p.sub));
        lastSub = p.sub;
      }
      grid.append(h('button', { class: 'card', title: `Ajouter « ${p.name} »`, onclick: () => insert(p) },
        previewCanvas(p, colors, { bodyType }),
        h('span', { class: 't' }, p.name)));
    }
  }

  async function renderUser() {
    const items = (await db.getAll('library').catch(() => [])).sort((a, b) => b.created - a.created);
    grid.append(h('div', { class: 'row', style: { gridColumn: '1 / -1' } },
      h('button', { class: 'btn small', onclick: () => { d.close(); saveActiveToLibrary(app); } }, icon('star'), 'Ajouter le calque actif'),
      h('button', { class: 'btn small', onclick: async () => { await importUserLibrary(app); renderGrid(); } }, icon('upload'), 'Importer'),
      h('button', { class: 'btn small', disabled: !items.length, onclick: () => exportUserLibrary(items) }, icon('download'), 'Exporter')));
    if (!items.length) grid.append(h('p', { class: 'hint', style: { gridColumn: '1 / -1' } }, 'Votre bibliothèque est vide. Sélectionnez un calque ou un groupe, puis « Ajouter à ma bibliothèque » (menu ⋯ du panneau Calques).'));
    for (const it of items) {
      const c = h('canvas', { width: 1, height: 1 });
      const pv = userPreview(it);
      if (pv) {
        c.width = pv.width; c.height = pv.height;
        const g = c.getContext('2d');
        g.drawImage(pv, 0, 0);
      }
      grid.append(h('div', { class: 'card' },
        h('button', { style: { border: 0, background: 'none', padding: 0 }, title: 'Insérer', onclick: () => { insertUserPiece(app, it); app.toast(`« ${it.name} » ajouté`); } }, c),
        h('span', { class: 't' }, it.name),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'icon-btn small', title: 'Renommer', 'aria-label': 'Renommer', onclick: async () => {
            const name = (await promptDialog('Nom de la pièce', it.name, { title: 'Renommer la pièce' }))?.trim();
            if (!name) return;
            await db.put('library', { ...it, name });
            renderGrid();
          } }, icon('pencil')),
        h('button', { class: 'icon-btn small', title: 'Supprimer', 'aria-label': 'Supprimer', onclick: async () => {
          if (!(await confirmDialog(`Supprimer « ${it.name} » de votre bibliothèque ?`, { danger: true, ok: 'Supprimer' }))) return;
          await db.delete('library', it.id);
          renderGrid();
        } }, icon('trash')))));
    }
  }

  const replaceChk = h('label', { class: 'chk', title: 'Remplace la pièce de même catégorie déjà présente' },
    h('input', { type: 'checkbox', checked: replace, onchange: (e) => { replace = e.target.checked; } }), 'Remplacer la pièce existante');

  const d = openDialog({
    title: 'Bibliothèque de pièces',
    wide: true,
    body: [
      h('p', { class: 'hint' }, 'Cliquez sur une pièce pour l\'ajouter comme calque (ou groupe de variantes). Tout reste modifiable pixel par pixel. Les couleurs ci-dessous recolorent aussi le personnage déjà en place.'),
      colorsBox,
      h('div', { class: 'row' }, replaceChk,
        h('button', { class: 'btn small', onclick: () => { d.close(); openNewCharacter(app); } }, icon('user'), 'Nouveau personnage…')),
      warn,
      tabs,
      grid,
    ],
  });
  renderColors();
  renderTabs();
  renderGrid();
}

// ---------- Nouveau personnage ----------
export function openNewCharacter(app) {
  let colors = { ...DEFAULT_COLORS, ...(app.state.charColors || {}) };
  const sel = { ...DEFAULT_CHARACTER, accessories: [...DEFAULT_CHARACTER.accessories] };
  const nameIn = h('input', { class: 'input wide', value: 'Mon personnage' });
  const sizeSel = h('select', { class: 'input wide' },
    h('option', { value: '64x64' }, '64 × 64 (recommandé)'),
    h('option', { value: '64x80' }, '64 × 80 (plus de place au-dessus)'),
    h('option', { value: '96x96' }, '96 × 96 (marges autour)'),
    h('option', { value: '128x128' }, '128 × 128 (grandes marges)'));
  const preview = h('canvas', { width: 256, height: 256, style: { width: '192px', height: '192px', imageRendering: 'pixelated', borderRadius: '10px', background: 'repeating-conic-gradient(#777 0% 25%, #aaa 0% 50%) 0 0 / 16px 16px' } });
  const pickers = h('div');
  const colorsBox = h('div');

  function drawPreview() {
    const doc = buildCharacter({ width: 64, height: 64, colors, sel });
    autoPngtuber(doc, true);
    import('../render/compose.js').then(({ composeToCanvas }) => {
      const g = preview.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, 256, 256);
      g.drawImage(composeToCanvas(doc, { includeReference: false }), 0, 0, 256, 256);
    });
  }
  const redraw = debounce(drawPreview, 60);

  function picker(catId, label, { optional = false } = {}) {
    const c = CATEGORIES.find((x) => x.id === catId);
    const s = h('select', { class: 'input wide' },
      optional ? h('option', { value: '' }, '— Aucun —') : null,
      c.pieces.map((p) => h('option', { value: p.id, selected: sel[catId] === p.id }, p.name)));
    s.addEventListener('change', () => { sel[catId] = s.value || null; redraw(); });
    return h('label', { class: 'field' }, h('span', {}, label), s);
  }

  function renderPickers() {
    clear(pickers);
    const acc = CATEGORIES.find((x) => x.id === 'accessory').pieces;
    pickers.append(h('div', { class: 'fields' },
      picker('body', 'Corps'), picker('head', 'Tête'), picker('hair', 'Coiffure'), picker('eyes', 'Yeux'),
      picker('brows', 'Sourcils', { optional: true }), picker('nose', 'Nez', { optional: true }), picker('mouth', 'Bouche'), picker('top', 'Vêtement', { optional: true })),
    h('h3', {}, 'Accessoires'),
    h('div', { class: 'chips' }, acc.map((p) => h('button', {
      class: 'chip' + (sel.accessories.includes(p.id) ? ' on' : ''),
      onclick: (e) => {
        const on = sel.accessories.includes(p.id);
        // un seul accessoire par sous-catégorie exclusive
        if (!on && p.exclusiveKey) sel.accessories = sel.accessories.filter((id) => pieceById(id).exclusiveKey !== p.exclusiveKey);
        sel.accessories = on ? sel.accessories.filter((id) => id !== p.id) : [...sel.accessories, p.id];
        renderPickers();
        redraw();
        void e;
      },
    }, p.name))));
  }

  function renderColors() {
    clear(colorsBox);
    colorsBox.append(colorRow(colors, (key, val) => { colors = { ...colors, [key]: val }; redraw(); }));
    colorsBox.append(h('div', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'small muted' }, 'Peau :'),
      SKIN_TONES.map((c) => h('button', { class: 'swatch', style: { background: c, width: '26px' }, title: c, onclick: () => { colors = { ...colors, skin: c }; renderColors(); redraw(); } }))));
    colorsBox.append(h('div', { class: 'row', style: { gap: '4px', marginTop: '4px' } }, h('span', { class: 'small muted' }, 'Cheveux :'),
      HAIR_TONES.map((c) => h('button', { class: 'swatch', style: { background: c, width: '26px' }, title: c, onclick: () => { colors = { ...colors, hair: c }; renderColors(); redraw(); } }))));
  }

  const randomize = () => {
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    for (const k of ['body', 'head', 'hair', 'eyes', 'brows', 'nose', 'mouth', 'top']) sel[k] = rnd(CATEGORIES.find((c) => c.id === k).pieces).id;
    colors = { ...colors, skin: rnd(SKIN_TONES.slice(0, 7)), hair: rnd(HAIR_TONES), eyes: rnd(['#3b7dd8', '#4ab06a', '#8a5a2b', '#9a5cff', '#e04a5a', '#2a2a3a']), clothes: rnd(['#4a7bd0', '#e04a5a', '#3fcf8e', '#f2a03d', '#7a5cff', '#2a2a3a', '#f0f0f4']) };
    renderPickers();
    renderColors();
    redraw();
  };

  openDialog({
    title: 'Nouveau personnage',
    wide: true,
    body: h('div', { class: 'fields newchar-grid' },
      h('div', { style: { display: 'grid', gap: '8px', justifyItems: 'center' } }, preview,
        h('button', { class: 'btn small', onclick: randomize }, '🎲 Au hasard'),
        h('p', { class: 'hint', style: { maxWidth: '200px' } }, 'Les yeux, la bouche et les sourcils sont créés en groupes de variantes, avec des expressions prêtes (Neutre, Parle, Content…).')),
      h('div', {},
        h('div', { class: 'fields' }, h('label', { class: 'field' }, h('span', {}, 'Nom'), nameIn), h('label', { class: 'field' }, h('span', {}, 'Taille du canevas'), sizeSel)),
        h('h3', {}, 'Couleurs'), colorsBox,
        h('h3', {}, 'Pièces'), pickers)),
    buttons: [
      { label: 'Annuler', value: null },
      {
        label: 'Créer le personnage', primary: true, value: true, action: async () => {
          const [w, hh] = sizeSel.value.split('x').map(Number);
          await app.storage?.saveNow();
          const doc = buildCharacter({ width: w, height: hh, colors, sel, name: nameIn.value.trim() || 'Mon personnage' });
          app.setState({ charColors: colors });
          app.setDoc(doc);
          app.toast('Personnage créé ! Essayez le mode PNGtuber 📺');
        },
      },
    ],
  });
  renderPickers();
  renderColors();
  drawPreview();
}

// ---------- Recolorer ----------
export function openRecolor(app) {
  const doc = app.doc;
  let colors = { ...DEFAULT_COLORS, ...(doc.charColors || {}) };
  const box = h('div');
  const render = () => {
    clear(box);
    box.append(colorRow(colors, (k, v) => { colors = { ...colors, [k]: v }; }));
    box.append(h('div', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'small muted' }, 'Peau :'),
      SKIN_TONES.map((c) => h('button', { class: 'swatch', style: { background: c, width: '26px' }, onclick: () => { colors = { ...colors, skin: c }; render(); } }))));
    box.append(h('div', { class: 'row', style: { gap: '4px', marginTop: '4px' } }, h('span', { class: 'small muted' }, 'Cheveux :'),
      HAIR_TONES.map((c) => h('button', { class: 'swatch', style: { background: c, width: '26px' }, onclick: () => { colors = { ...colors, hair: c }; render(); } }))));
  };
  render();
  openDialog({
    title: 'Recolorer le personnage',
    body: [
      h('p', {}, 'Change les couleurs de peau, cheveux, yeux, vêtements et accessoires des pièces de la bibliothèque (échange de palette). Vos retouches de mêmes couleurs suivent aussi.'),
      !doc.charColors ? h('p', { class: 'hint' }, 'Ce projet ne contient pas encore de pièces de la bibliothèque.') : null,
      box,
    ],
    buttons: [
      { label: 'Annuler', value: null },
      { label: 'Appliquer', primary: true, value: true, action: () => { recolorDoc(app, colors); app.setState({ charColors: colors }); } },
    ],
  });
}

// ---------- Ma bibliothèque (pièces de l'utilisateur) ----------
function serializeNode(doc, node) {
  if (node.type === 'layer') {
    return { type: 'layer', name: node.name, opacity: node.opacity, data: doc.cel(node).slice() };
  }
  return {
    type: 'group',
    name: node.name,
    variant: node.variant,
    role: node.role || null,
    opacity: node.opacity,
    activeIndex: node.children.indexOf(node.active),
    children: node.children.map((id) => serializeNode(doc, doc.get(id))),
  };
}

export async function saveActiveToLibrary(app) {
  const doc = app.doc;
  const node = doc.active;
  if (!node) return app.toast('Sélectionnez un calque ou un groupe');
  app.selection.commitFloating();
  const name = await promptDialog('Nom de la pièce', node.name, { title: 'Ajouter à ma bibliothèque', ok: 'Ajouter' });
  if (!name) return;
  const item = { id: uid('u'), name: name.trim(), created: Date.now(), width: doc.width, height: doc.height, tree: serializeNode(doc, node) };
  try {
    await db.put('library', item);
    app.toast(`« ${item.name} » ajouté à votre bibliothèque`);
  } catch (err) {
    app.toast('Impossible d\'enregistrer : ' + err.message);
  }
}

function firstLayerData(tree) {
  if (tree.type === 'layer') return tree.data;
  const i = tree.variant && tree.activeIndex >= 0 ? tree.activeIndex : tree.children.length - 1;
  return tree.children[i] ? firstLayerData(tree.children[i]) : null;
}

function userPreview(it) {
  const data = firstLayerData(it.tree);
  if (!data) return null;
  const src = pixelsToCanvas(data instanceof Uint32Array ? data : new Uint32Array(data), it.width, it.height);
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const k = Math.min(192 / it.width, 192 / it.height);
  g.drawImage(src, (192 - it.width * k) / 2, (192 - it.height * k) / 2, it.width * k, it.height * k);
  return c;
}

export function insertUserPiece(app, it) {
  app.selection.commitFloating();
  app.history.transact(`Ajouter « ${it.name} »`, () => {
    const doc = app.doc;
    const dx = Math.floor((doc.width - it.width) / 2), dy = doc.height - it.height;
    const copy = (src) => {
      const out = doc.newCel();
      const s = src instanceof Uint32Array ? src : new Uint32Array(src);
      for (let y = 0; y < it.height; y++) {
        const ty = y + (doc.height >= it.height ? dy : Math.floor((doc.height - it.height) / 2));
        if (ty < 0 || ty >= doc.height) continue;
        for (let x = 0; x < it.width; x++) {
          const tx = x + dx;
          if (tx >= 0 && tx < doc.width) out[ty * doc.width + tx] = s[y * it.width + x];
        }
      }
      return out;
    };
    const build = (t) => {
      if (t.type === 'layer') {
        const l = doc.createLayer(t.name, { opacity: t.opacity ?? 1 });
        l.cels = doc.frames.map(() => copy(t.data));
        return l;
      }
      const g = doc.createGroup(t.name, { variant: !!t.variant, role: t.role || null, opacity: t.opacity ?? 1 });
      for (const c of t.children) doc.adopt(g, build(c));
      if (g.variant) g.active = g.children[t.activeIndex >= 0 ? t.activeIndex : 0] || g.children[0];
      return g;
    };
    const node = build(it.tree);
    const a = doc.active;
    const parent = a ? doc.get(a.parent) : doc.root;
    doc.insert(node, parent.id, a ? parent.children.indexOf(a.id) + 1 : null);
    doc.activeId = node.id;
    void templateOffset;
  });
}

function encodeTree(t) {
  if (t.type === 'layer') {
    const d = t.data instanceof Uint32Array ? t.data : new Uint32Array(t.data);
    return { ...t, data: bytesToBase64(new Uint8Array(d.buffer, d.byteOffset, d.byteLength)) };
  }
  return { ...t, children: t.children.map(encodeTree) };
}

function decodeTree(t) {
  if (t.type === 'layer') {
    const b = base64ToBytes(t.data);
    return { ...t, data: new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2).slice() };
  }
  return { ...t, children: t.children.map(decodeTree) };
}

export function exportUserLibrary(items) {
  const json = JSON.stringify({ format: 'pixel-atelier-library', version: 1, items: items.map((it) => ({ ...it, tree: encodeTree(it.tree) })) });
  downloadBlob(new Blob([json], { type: 'application/json' }), `ma_bibliotheque_${slugify(new Date().toISOString().slice(0, 10))}.json`);
}

export async function importUserLibrary(app) {
  const f = await pickFile('.json,application/json');
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.format !== 'pixel-atelier-library') throw new Error('format inconnu');
    for (const it of j.items) await db.put('library', { ...it, id: uid('u'), tree: decodeTree(it.tree) });
    app.toast(`${j.items.length} pièce(s) importée(s)`);
  } catch (err) {
    app.toast('Bibliothèque illisible : ' + err.message);
  }
}
