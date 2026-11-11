// Outils de couleur : générateur de rampes (teintes qui glissent vers le froid dans les
// ombres et le chaud dans les lumières), couleur de palette liée au dessin (la modifier
// recolore tous ses pixels, aperçu en direct) et vérification de lisibilité.

import { h, clear } from '../util/dom.js';
import { openDialog } from './dialogs.js';
import { hexToU32, u32ToHex, toRgba, rgba, rgbToHsl, hslToRgb, normHex } from '../util/color.js';

/** Écart de teinte signé de a vers b (−180..180). */
const hueTo = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

/**
 * Rampe de n couleurs autour de hex (du plus sombre au plus clair).
 * shift : degrés de glissement de teinte aux extrémités (vers le bleu-violet dans l'ombre,
 * vers le jaune dans la lumière) ; range : écart de luminosité ; sat : variation de saturation.
 */
export function makeRamp(hex, { steps = 5, shift = 20, range = 0.6, sat = 0.15 } = {}) {
  const [r, g, b] = toRgba(hexToU32(hex));
  const [hh, s, l] = rgbToHsl(r, g, b);
  const out = [];
  const lo = Math.max(0.04, l - range / 2), hi = Math.min(0.96, l + range / 2);
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1); // 0 = ombre, 1 = lumière
    const k = t * 2 - 1;
    const L = lo + (hi - lo) * t;
    // teinte : vers 250° (froid) dans l'ombre, vers 60° (chaud) dans la lumière
    const target = k < 0 ? 250 : 60;
    const d = hueTo(hh, target);
    const H = hh + Math.sign(d) * Math.min(Math.abs(d), shift * Math.abs(k));
    // saturation un peu plus forte dans les tons moyens, plus faible aux extrémités
    const S = Math.max(0, Math.min(1, s * (1 + sat * (1 - Math.abs(k)) - sat * 0.8 * Math.abs(k) * (k > 0 ? 1.4 : 0.6))));
    const [nr, ng, nb] = hslToRgb(H, s < 0.04 ? s : S, L);
    out.push(u32ToHex(rgba(nr, ng, nb)));
  }
  return out;
}

const swatchRow = (colors) => h('div', { class: 'ramp-row' }, colors.map((c) => h('span', { class: 'ramp-sw', style: { background: c }, title: c })));

/** Fenêtre de rampe : ajouter à la palette ou remplacer la palette. */
export function openRampDialog(app, setPalette) {
  const o = { base: normHex(app.state.primary), steps: 5, shift: 20, range: 0.6 };
  const out = h('div', {});
  const draw = () => { clear(out); out.append(swatchRow(makeRamp(o.base, o))); };
  const slider = (label, key, min, max, step, fmt) => {
    const val = h('span', { class: 'small muted', style: { width: '48px', textAlign: 'right' } }, fmt(o[key]));
    return h('div', { class: 'row nowrap' }, h('span', { class: 'small', style: { width: '120px' } }, label),
      h('input', { type: 'range', min, max, step, value: o[key], class: 'grow', 'aria-label': label, oninput: (e) => { o[key] = +e.target.value; val.textContent = fmt(o[key]); draw(); } }), val);
  };
  const base = h('input', { type: 'color', value: o.base.slice(0, 7), 'aria-label': 'Couleur de base', oninput: (e) => { o.base = e.target.value; draw(); } });
  draw();
  openDialog({
    title: 'Générer une rampe de couleurs',
    body: [
      h('p', { class: 'hint' }, 'Une rampe va de l\'ombre à la lumière. En pixel art, les ombres glissent vers le bleu-violet et les lumières vers le jaune : les couleurs restent vivantes au lieu de devenir grises.'),
      h('div', { class: 'row' }, h('span', { class: 'small', style: { width: '120px' } }, 'Couleur de base'), base),
      slider('Nombre de teintes', 'steps', 3, 9, 1, (v) => String(v)),
      slider('Glissement de teinte', 'shift', 0, 45, 1, (v) => v + '°'),
      slider('Contraste', 'range', 0.2, 0.9, 0.05, (v) => Math.round(v * 100) + ' %'),
      out,
    ],
    buttons: [
      { label: 'Annuler', value: null },
      { label: 'Remplacer la palette', value: true, action: () => setPalette(makeRamp(o.base, o), 'Rampe de couleurs') },
      { label: 'Ajouter à la palette', primary: true, value: true, action: () => {
        const cur = app.doc.palette.map(normHex);
        setPalette([...app.doc.palette, ...makeRamp(o.base, o).filter((c) => !cur.includes(normHex(c)))], 'Rampe ajoutée');
      } },
    ],
  });
}

/** Valeurs (avec alpha) présentes dans le dessin dont la couleur est rgb. */
function sameRgb(doc, u) {
  const rgb = u & 0x00ffffff;
  const found = new Set();
  for (const l of doc.allLayers()) for (const cel of l.cels) {
    if (!cel) continue;
    for (let i = 0; i < cel.length; i++) { const v = cel[i]; if (v >>> 24 && (v & 0x00ffffff) === rgb) found.add(v >>> 0); }
  }
  return found;
}

/**
 * Modifier une couleur de la palette. Avec « Recolorer le dessin » (palette liée), tous les
 * pixels de cette couleur suivent en direct ; Valider = une seule entrée d'historique.
 */
export function openPaletteColorDialog(app, index, setPalette) {
  const doc = app.doc;
  const oldHex = normHex(doc.palette[index]);
  const oldU = hexToU32(oldHex);
  const values = sameRgb(doc, oldU);
  // copies d'origine des cels concernées (aperçu en direct, puis restauration)
  const touched = [];
  const seen = new Set();
  for (const l of doc.allLayers()) for (const cel of l.cels) {
    if (!cel || seen.has(cel)) continue;
    seen.add(cel);
    for (let i = 0; i < cel.length; i++) if (values.has(cel[i] >>> 0)) { touched.push({ cel, orig: cel.slice() }); break; }
  }
  let linked = app.state.paletteLinked !== false && values.size > 0;
  let cur = oldHex;
  const mapFor = (hex) => {
    const nu = hexToU32(hex) & 0x00ffffff;
    const m = new Map();
    for (const v of values) m.set(v, ((v & 0xff000000) | nu) >>> 0);
    return m;
  };
  const preview = () => {
    const m = linked ? mapFor(cur) : null;
    for (const t of touched) {
      for (let i = 0; i < t.cel.length; i++) { const o = t.orig[i]; t.cel[i] = m && m.has(o >>> 0) ? m.get(o >>> 0) : o; }
      app.markLayerDirty(t.cel);
    }
    app.renderer.invalidateAll();
  };
  const restore = () => {
    for (const t of touched) { t.cel.set(t.orig); app.markLayerDirty(t.cel); }
    app.renderer.invalidateAll();
  };
  const sw = h('span', { class: 'ramp-sw', style: { background: cur, width: '48px', height: '32px' } });
  const hex = h('input', { class: 'input', value: cur, 'aria-label': 'Code couleur', style: { width: '96px' }, translate: 'no', onchange: (e) => { if (/^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) set(normHex(e.target.value.trim())); } });
  const picker = h('input', { type: 'color', value: cur.slice(0, 7), 'aria-label': 'Nouvelle couleur', oninput: (e) => set(e.target.value) });
  function set(v) {
    cur = normHex(v);
    sw.style.background = cur;
    hex.value = cur;
    picker.value = cur.slice(0, 7);
    preview();
  }
  openDialog({
    title: 'Modifier la couleur de la palette',
    body: [
      h('div', { class: 'row' }, h('span', { class: 'ramp-sw', style: { background: oldHex, width: '48px', height: '32px' }, title: oldHex }), '→', sw, picker, hex),
      h('label', { class: 'chk', title: 'Palette liée : changer la couleur de la palette change aussi tous les pixels de cette couleur' },
        h('input', { type: 'checkbox', checked: linked, disabled: !values.size, onchange: (e) => { linked = e.target.checked; app.setState({ paletteLinked: linked }); preview(); } }),
        'Recolorer le dessin (tous les pixels de cette couleur)'),
      h('p', { class: 'hint' }, values.size ? 'Le dessin se met à jour en direct ; « Annuler » remet tout comme avant.' : 'Cette couleur n\'est pas utilisée dans le dessin.'),
    ],
    buttons: [
      { label: 'Annuler', value: null, action: () => restore() },
      { label: 'Valider', primary: true, value: true, action: () => {
        restore();
        if (cur === oldHex) return true;
        app.history.group('Modifier une couleur de la palette', () => {
          const pal = [...doc.palette];
          pal[index] = cur;
          setPalette(pal, 'Couleur de la palette modifiée');
          if (linked) app.actions.replaceColors(mapFor(cur), null, 'Recolorer le dessin');
        });
        return true;
      } },
    ],
    onClose: (v) => { if (v === undefined) restore(); },
  });
}

/** Image de vérification : niveaux de gris (valeurs) ou silhouette (forme seule). */
export function checkImage(src, mode, cache) {
  const w = src.width, hh = src.height;
  const c = cache && cache.width === w && cache.height === hh ? cache : Object.assign(document.createElement('canvas'), { width: w, height: hh });
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, hh);
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, hh);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    if (mode === 'silhouette') { d[i] = d[i + 1] = d[i + 2] = 20; } else {
      const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = y;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
