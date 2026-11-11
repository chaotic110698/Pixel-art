// Panneau Couleurs : sélecteur HSV + alpha, hexadécimal, palette, récentes,
// palettes prédéfinies, import/export, extraction depuis une image.

import { openRampDialog, openPaletteColorDialog } from './color-tools.js';
import { h, clear, pickFile, downloadBlob, loadImageFromFile, imageToRGBA, slugify } from '../util/dom.js';
import { hexToU32, toRgba, rgba, u32ToHex, rgbToHsl, isValidHex, normHex } from '../util/color.js';
import { PRESET_PALETTES, presetById, parsePalette, exportHex, exportGpl, extractPalette } from '../core/palettes.js';
import { icon } from './icons.js';
import { popupMenu, openDialog, confirmDialog } from './dialogs.js';

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let hh = 0;
  if (d) {
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60;
    if (hh < 0) hh += 360;
  }
  return [hh, max ? d / max : 0, max];
}

function hsvToRgb(hh, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function initColorsPanel(app) {
  const panel = document.getElementById('panel-colors');
  let target = 'primary';
  let hsv = [0, 0, 0];
  let alpha = 255;
  let showEditor = false;

  // ----- éditeur HSV -----
  const svKnob = h('div', { class: 'knob' });
  const sv = h('div', { class: 'hsv-sv' }, svKnob);
  const hueKnob = h('div', { class: 'knob' });
  const hue = h('div', { class: 'hsv-bar hue-bar' }, hueKnob);
  const aKnob = h('div', { class: 'knob' });
  const aBar = h('div', { class: 'hsv-bar' }, aKnob);
  const hexIn = h('input', { class: 'input hex', 'aria-label': 'Code hexadécimal', maxlength: 9 });
  const native = h('input', { type: 'color', 'aria-label': 'Sélecteur de couleur du système' });
  const tgtSeg = h('div', { class: 'seg' });
  const editor = h('div', { class: 'hsv-box' }, sv, hue, aBar,
    h('div', { class: 'row nowrap' }, tgtSeg, hexIn, native));

  function fromState() {
    const c = hexToU32(app.state[target]);
    const [r, g, b, a] = toRgba(c);
    const nh = rgbToHsv(r, g, b);
    // conserver la teinte quand la couleur est grise
    if (nh[1] === 0 || nh[2] === 0) nh[0] = hsv[0];
    hsv = nh;
    alpha = a;
    paintEditor();
  }

  function commit() {
    const [r, g, b] = hsvToRgb(hsv[0], hsv[1], hsv[2]);
    app.setColor(target, u32ToHex(rgba(r, g, b, alpha)));
  }

  function paintEditor() {
    const [r, g, b] = hsvToRgb(hsv[0], hsv[1], hsv[2]);
    const pure = hsvToRgb(hsv[0], 1, 1);
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgb(${pure}))`;
    svKnob.style.left = hsv[1] * 100 + '%';
    svKnob.style.top = (1 - hsv[2]) * 100 + '%';
    hueKnob.style.left = (hsv[0] / 360) * 100 + '%';
    aBar.style.background = `linear-gradient(to right, transparent, rgb(${r},${g},${b})), repeating-conic-gradient(#888 0% 25%, #ccc 0% 50%) 0 0 / 10px 10px`;
    aKnob.style.left = (alpha / 255) * 100 + '%';
    const hex = u32ToHex(rgba(r, g, b, alpha));
    if (document.activeElement !== hexIn) hexIn.value = hex;
    native.value = u32ToHex(rgba(r, g, b));
    clear(tgtSeg);
    tgtSeg.append(
      h('button', { class: target === 'primary' ? 'on' : '', title: 'Modifier la couleur principale', onclick: () => { target = 'primary'; fromState(); } }, 'A'),
      h('button', { class: target === 'secondary' ? 'on' : '', title: 'Modifier la couleur secondaire', onclick: () => { target = 'secondary'; fromState(); } }, 'B'));
  }

  function drag(el, fn) {
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = el.getBoundingClientRect();
        fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
        paintEditor();
        commit();
      };
      move(e);
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }
  drag(sv, (x, y) => { hsv[1] = x; hsv[2] = 1 - y; });
  drag(hue, (x) => { hsv[0] = Math.min(359.9, x * 360); });
  drag(aBar, (x) => { alpha = Math.round(x * 255); });
  hexIn.addEventListener('change', () => {
    const v = hexIn.value.trim();
    if (isValidHex(v)) app.setColor(target, normHex(v.startsWith('#') ? v : '#' + v));
    fromState();
  });
  native.addEventListener('input', () => {
    const [r, g, b] = toRgba(hexToU32(native.value));
    app.setColor(target, u32ToHex(rgba(r, g, b, alpha)));
  });

  // ----- palette -----
  const paletteGrid = h('div', { class: 'swatches', role: 'listbox', 'aria-label': 'Palette' });
  const recentGrid = h('div', { class: 'swatches recent' });
  const presetSel = h('select', { class: 'input grow', 'aria-label': 'Palettes prédéfinies' });

  function swatch(hex, { onPick, onAlt, title }) {
    const b = h('button', { class: 'swatch', style: { background: hex }, title: title || hex, 'aria-label': hex });
    let timer = null, longed = false;
    b.addEventListener('pointerdown', (e) => {
      longed = false;
      if (e.pointerType === 'touch') timer = setTimeout(() => { longed = true; onAlt?.(); }, 450);
    });
    const stop = () => clearTimeout(timer);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointerleave', stop);
    b.addEventListener('click', (e) => {
      if (longed) return;
      if (e.shiftKey) onAlt?.();
      else onPick();
    });
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      onAlt?.();
    });
    return b;
  }

  function renderPalette() {
    const doc = app.doc;
    clear(paletteGrid);
    const prim = normHex(app.state.primary), sec = normHex(app.state.secondary);
    doc.palette.forEach((hex, i) => {
      const s = swatch(hex, {
        title: `${hex} — clic : couleur A, clic droit / appui long : couleur B`,
        onPick: () => app.setColor('primary', hex),
        onAlt: () => app.setColor('secondary', hex),
      });
      s.addEventListener('dblclick', () => openPaletteColorDialog(app, i, setPalette));
      if (normHex(hex) === prim) s.classList.add('sel');
      if (normHex(hex) === sec) s.classList.add('sel2');
      s.dataset.index = i;
      paletteGrid.append(s);
    });
    paletteGrid.append(h('button', { class: 'swatch add', title: 'Ajouter la couleur A à la palette', 'aria-label': 'Ajouter à la palette', onclick: addCurrent }, '+'));
  }

  function renderRecent() {
    clear(recentGrid);
    for (const hex of app.state.recent) {
      recentGrid.append(swatch(hex, { onPick: () => app.setColor('primary', hex), onAlt: () => app.setColor('secondary', hex) }));
    }
    if (!app.state.recent.length) recentGrid.append(h('span', { class: 'hint', style: { gridColumn: '1 / -1' } }, 'Les couleurs utilisées apparaîtront ici.'));
  }

  function setPalette(colors, label = 'Palette modifiée') {
    app.history.transact(label, () => {
      app.doc.palette = colors.slice(0, 256);
    });
    renderPalette();
    app.toast(label);
  }

  function addCurrent() {
    const hex = normHex(app.state.primary);
    if (app.doc.palette.map(normHex).includes(hex)) return app.toast('Déjà dans la palette');
    setPalette([...app.doc.palette, hex], 'Couleur ajoutée');
  }

  function removeCurrent() {
    const hex = normHex(app.state.primary);
    const p = app.doc.palette.filter((c) => normHex(c) !== hex);
    if (p.length === app.doc.palette.length) return app.toast('La couleur A n\'est pas dans la palette');
    setPalette(p, 'Couleur retirée');
  }

  function sortPalette() {
    const key = (hex) => {
      const [r, g, b] = toRgba(hexToU32(hex));
      const [hh, s, l] = rgbToHsl(r, g, b);
      return (s < 0.12 ? -1000 : Math.round(hh / 30) * 100) + l * 99;
    };
    setPalette([...app.doc.palette].sort((a, b) => key(a) - key(b)), 'Palette triée');
  }

  for (const p of PRESET_PALETTES) presetSel.append(h('option', { value: p.id }, `${p.name} (${p.colors.length})`));
  presetSel.prepend(h('option', { value: '', selected: true }, 'Charger une palette…'));
  presetSel.addEventListener('change', async () => {
    const id = presetSel.value;
    presetSel.value = '';
    if (!id) return;
    const p = presetById(id);
    app.setState({ lastPalette: id });
    setPalette([...p.colors], `Palette ${p.name}`);
  });

  const moreBtn = h('button', { class: 'icon-btn small', title: 'Plus d\'options de palette', 'aria-label': 'Options de palette' }, icon('more'));
  moreBtn.addEventListener('click', () => popupMenu(moreBtn, [
    { label: 'Ajouter la couleur A', icon: 'plus', action: addCurrent },
    { label: 'Retirer la couleur A', icon: 'trash', action: removeCurrent },
    { label: 'Remplacer… (couleur A partout)', icon: 'swap', action: () => app.actions.replaceColorDialog() },
    { label: 'Trier par teinte', icon: 'sliders', action: sortPalette },
    { label: 'Générer une rampe de couleurs…', icon: 'palette', action: () => openRampDialog(app, setPalette) },
    { label: 'Modifier la couleur A (et le dessin)…', icon: 'swap', action: () => {
      const i = app.doc.palette.map(normHex).indexOf(normHex(app.state.primary));
      if (i < 0) return app.toast('La couleur A n\'est pas dans la palette');
      openPaletteColorDialog(app, i, setPalette);
    } },
    { label: 'Palette depuis le dessin', icon: 'palette', action: () => app.actions.paletteFromDrawing((c) => setPalette(c, 'Palette extraite du dessin')) },
    { sep: true },
    { label: 'Importer (.hex, .gpl, .json, .pal)', icon: 'upload', action: importPalette },
    { label: 'Extraire d\'une image…', icon: 'image', action: extractFromImage },
    { label: 'Exporter en .hex', icon: 'download', action: () => downloadBlob(new Blob([exportHex(app.doc.palette)], { type: 'text/plain' }), slugify(app.doc.name) + '_palette.hex') },
    { label: 'Exporter en .gpl (GIMP/Aseprite)', icon: 'download', action: () => downloadBlob(new Blob([exportGpl(app.doc.palette, app.doc.name)], { type: 'text/plain' }), slugify(app.doc.name) + '_palette.gpl') },
    { sep: true },
    { label: 'Vider la palette', icon: 'trash', danger: true, action: async () => { if (await confirmDialog('Vider la palette ?', { danger: true, ok: 'Vider' })) setPalette([], 'Palette vidée'); } },
  ], { align: 'right' }));

  async function importPalette() {
    const f = await pickFile('.hex,.gpl,.json,.pal,.txt');
    if (!f) return;
    try {
      const colors = parsePalette(await f.text(), f.name.toLowerCase());
      if (!colors.length) throw new Error('vide');
      setPalette(colors, `${colors.length} couleurs importées`);
    } catch (_) {
      app.toast('Fichier de palette non reconnu');
    }
  }

  async function extractFromImage() {
    const f = await pickFile('image/*');
    if (!f) return;
    const img = await loadImageFromFile(f);
    const max = 1024;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const data = imageToRGBA(img, Math.max(1, Math.round(img.naturalWidth * k)), Math.max(1, Math.round(img.naturalHeight * k)));
    const nIn = h('input', { type: 'number', class: 'input num', value: 16, min: 2, max: 256 });
    const v = await openDialog({
      title: 'Extraire une palette',
      body: [h('p', {}, 'Nombre maximal de couleurs à extraire :'), nIn],
      buttons: [{ label: 'Annuler', value: false }, { label: 'Extraire', value: true, primary: true }],
    }).result;
    if (!v) return;
    const colors = extractPalette(data, Math.max(2, Math.min(256, +nIn.value || 16)));
    setPalette(colors, `${colors.length} couleurs extraites`);
  }

  const editorToggle = h('button', { class: 'btn small', onclick: () => { showEditor = !showEditor; editor.hidden = !showEditor; editorToggle.textContent = showEditor ? 'Masquer le sélecteur' : 'Sélecteur avancé'; } }, showEditor ? 'Masquer le sélecteur' : 'Sélecteur avancé');
  editor.hidden = !showEditor;

  panel.append(
    h('div', { class: 'row nowrap' }, presetSel, moreBtn),
    h('div', { class: 'row', style: { margin: '6px 0' } }, editorToggle,
      h('button', { class: 'btn small', title: 'Ajouter la couleur A', onclick: addCurrent }, '+ Ajouter A')),
    editor,
    paletteGrid,
    h('h3', {}, 'Récentes'),
    recentGrid);

  // commandes de palette reprises par la palette de commandes (Ctrl+K)
  app.paletteCommands = () => [
    { label: 'Générer une rampe de couleurs…', icon: 'palette', run: () => openRampDialog(app, setPalette) },
    { label: 'Trier par teinte', icon: 'sliders', run: sortPalette },
    { label: 'Palette depuis le dessin', icon: 'palette', run: () => app.actions.paletteFromDrawing((c) => setPalette(c, 'Palette extraite du dessin')) },
    { label: 'Importer (.hex, .gpl, .json, .pal)', icon: 'upload', run: importPalette },
    { label: 'Extraire d\'une image…', icon: 'image', run: extractFromImage },
  ];
  app.openColorEditor = (which) => {
    target = which;
    showEditor = true;
    editor.hidden = false;
    editorToggle.textContent = 'Masquer le sélecteur';
    fromState();
    app.showPanel?.('colors');
  };

  app.on('color', () => {
    fromState();
    renderPalette();
  });
  app.on('doc', renderPalette);
  app.on('meta', renderPalette);
  app.on('recent', renderRecent);
  fromState();
  renderPalette();
  renderRecent();
}
