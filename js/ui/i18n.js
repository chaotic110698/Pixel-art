// Interface multilingue : traduction à la volée du DOM (textes, infobulles,
// libellés d'accessibilité). Le code reste écrit en français.
// - anglais : dictionnaire i18n-en.js (clé = texte français) + motifs ci-dessous ;
// - autres langues : js/ui/lang/<code>.js (DICT, même clés ; P = modèles des motifs,
//   dans l'ordre de PATTERNS), générés par scripts/i18n-lang.py depuis i18n/<code>.txt.
//   Un texte absent retombe sur l'anglais.
// Les contenus de l'utilisateur (noms de calques, d'expressions, de projets…) sont
// marqués translate="no" et ignorés.

import { EN } from './i18n-en.js';

/** Langues proposées : [code, nom dans la langue]. */
export const LANGS = [
  ['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'],
  ['pt', 'Português'], ['ru', 'Русский'], ['ja', '日本語'], ['zh', '中文（简体）'], ['ko', '한국어'],
];
let lang = 'fr';
let DICT = null; // dictionnaire de la langue (hors anglais)
let PT = null; // modèles des motifs de la langue
const ATTRS = ['title', 'aria-label', 'placeholder'];
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
/** Texte traduit (langue choisie, sinon anglais) ou undefined. */
function lookup(t) {
  if (has(DICT, t)) return DICT[t];
  if (has(EN, t)) return EN[t];
  return undefined;
}

// Motifs pour les textes dynamiques : [regex, fonction de remplacement en anglais].
// Toujours AJOUTER un motif à la fin (les langues s'y réfèrent par leur rang).
const PATTERNS = [
  [/^Annulé : (.+)$/, (m, a) => `Undone: ${tr(a)}`],
  [/^Rétabli : (.+)$/, (m, a) => `Redone: ${tr(a)}`],
  [/^« (.+) » ajouté( \(avec une tête et un corps de base\))?$/, (m, a, b) => `"${a}" added${b ? ' (with a base head and body)' : ''}`],
  [/^« (.+) » : pièce retirée$/, (m, a) => `"${a}": part removed`],
  [/^« (.+) » ajouté à votre bibliothèque$/, (m, a) => `"${a}" added to your library`],
  [/^Ajouter « (.+) »$/, (m, a) => `Add "${tr(a)}"`],
  [/^(#[0-9a-fA-F]{3,8}) — clic : couleur A, clic droit \/ appui long : couleur B$/, (m, hx) => `${hx} — click: color A, right click / long press: color B`],
  [/^Expression « (.+) »$/, (m, a) => `Expression "${a}"`],
  [/^Supprimer (\d+) éléments( \?)?$/, (m, n, q) => `Delete ${n} items${q ? '?' : ''}`],
  [/^Dupliquer (\d+) éléments$/, (m, n) => `Duplicate ${n} items`],
  [/^(\d+) éléments sélectionnés$/, (m, n) => `${n} items selected`],
  [/^(\d+) action\(s\) · (.+) Mo$/, (m, n, s) => `${n} action(s) · ${s} MB`],
  [/^(\d+) fichier\(s\)$/, (m, n) => `${n} file(s)`],
  [/^(\d+) image\(s\)$/, (m, n) => `${n} frame(s)`],
  [/^Plage (\d+)–(\d+)$/, (m, a, b) => `Range ${a}–${b}`],
  [/^Image (\d+) — (\d+) ms \(Maj\+clic : plage, double-clic : durée\)$/, (m, a, b) => `Frame ${a} — ${b} ms (Shift+click: range, double-click: duration)`],
  [/^Image (\d+)$/, (m, a) => `Frame ${a}`],
  [/^Balise « (.+) »$/, (m, a) => `Tag "${a}"`],
  [/^(.+) \(images (\d+)–(\d+)\) — clic : lire en boucle, double-clic : modifier$/, (m, a, b, c) => `${a} (frames ${b}–${c}) — click: loop, double-click: edit`],
  [/^Canevas agrandi à (\d+)×(\d+) pour accueillir les pièces$/, (m, a, b) => `Canvas enlarged to ${a}×${b} to fit the parts`],
  [/^Nouveau dessin (\d+)×(\d+)$/, (m, a, b) => `New drawing ${a}×${b}`],
  [/^Touche pour « (.+) »$/, (m, a) => `Key for "${a}"`],
  [/^Supprimer l'expression « (.+) » \?$/, (m, a) => `Delete the expression "${a}"?`],
  [/^Supprimer le groupe « (.+) » et son contenu \?$/, (m, a) => `Delete group "${a}" and its content?`],
  [/^Supprimer définitivement « (.+) » \? Cette action est irréversible\.$/, (m, a) => `Permanently delete "${a}"? This cannot be undone.`],
  [/^Supprimer « (.+) » de votre bibliothèque \?$/, (m, a) => `Delete "${a}" from your library?`],
  [/^Mode PNGtuber — (.+)$/, (m, a) => `PNGtuber mode — ${a}`],
  [/^Enregistré dans « (.+) »$/, (m, a) => `Saved to "${a}"`],
  [/^Enregistré \(navigateur \+ « (.+) »\)$/, (m, a) => `Saved (browser + "${a}")`],
  [/^Projet « (.+) » ouvert$/, (m, a) => `Project "${a}" opened`],
  [/^Palette (.+)$/, (m, a) => lookup('Palette ' + a) || `Palette ${a}`],
  [/^Symétrie : (.+)$/, (m, a) => `Symmetry: ${{ aucune: 'none', 'verticale (gauche/droite)': 'vertical (left/right)', 'horizontale (haut/bas)': 'horizontal (top/bottom)', 'les deux': 'both' }[a] || a}`],
  [/^★ Favoris \((\d+)\)$/, (m, n) => `★ Favorites (${n})`],
  [/^(.+) \((.+)\) — clic droit ou appui long : autres outils$/, (m, a, k) => `${tr(a)} (${k}) — right click or long press: other tools`],
  [/^(Dessin|Remplissage|Formes|Sélection|Déplacer) : (.+)$/, (m, a, b) => `${tr(a)}: ${tr(b)}`],
  [/^(.+) \(3\/4\)$/, (m, a) => `${tr(a)} (3/4)`],
  [/^(.+) \((.+), 3\/4\)$/, (m, a, b) => `${tr(a)} (${tr(b.charAt(0).toUpperCase() + b.slice(1)).toLowerCase()}, 3/4)`],
  [/^Profil « (.+) »$/, (m, a) => `Profile "${a}"`],
  [/^Effets de « (.+) »$/, (m, a) => `Effects for "${a}"`],
  [/^Raccourci : (.+) \(changer\)$/, (m, a) => `Shortcut: ${a.replace(/Maj\+/g, 'Shift+')} (change)`],
  [/^Touche pour (.+)$/, (m, a) => `Key for ${tr(a)}`],
  [/^Touche (.+) déjà utilisée par « (.+) »$/, (m, k, a) => `Key ${k} is already used by "${a}"`],
  [/^Supprimer le profil « (.+) » \?$/, (m, a) => `Delete profile "${a}"?`],
  [/^Opacité : (\d+) %$/, (m, a) => `Opacity: ${a}%`],
  [/^(\d+) %$/, (m, a) => `${a}%`],
  [/^(\d+) couleurs (importées|extraites)$/, (m, n, w) => `${n} colors ${w === 'importées' ? 'imported' : 'extracted'}`],
  [/^Cela va générer (\d+) images\. Continuer \?$/, (m, n) => `This will generate ${n} images. Continue?`],
  [/^Inclure toutes les combinaisons \((\d+)\)$/, (m, n) => `Include all combinations (${n})`],
  [/^Une animation par balise \((\d+)\)$/, (m, n) => `One animation per tag (${n})`],
  [/^✔ (.+) \((\d+) images?\)$/, (m, f, n) => `✔ ${f} (${n} image${n > 1 ? 's' : ''})`],
  [/^Fichier Aseprite importé : (\d+) calque\(s\), (\d+) image\(s\)$/, (m, a, b) => `Aseprite file imported: ${a} layer(s), ${b} frame(s)`],
  [/^Variante du groupe « (.+) »\.$/, (m, a) => `Variant of group "${a}".`],
  [/^Impossible d'ouvrir « (.+) » : (.+)$/, (m, a, b) => `Could not open "${a}": ${b}`],
  [/^Erreur : (.+)$/, (m, a) => `Error: ${a}`],
  [/^(.+) : variante (précédente|suivante)$/, (m, a, b) => `${a}: ${b === 'précédente' ? 'previous' : 'next'} variant`],
  [/^Les pièces sont prévues pour un canevas d'au moins 64×64 px \(actuel : (\d+)×(\d+)\).+$/, (m, a, b) => `Parts are designed for a canvas of at least 64×64 px (current: ${a}×${b}): it will be enlarged automatically when the first part is added (undoable). Tip: "New character" directly creates a full character.`],
  [/^(\d+) × (\d+) tuiles de (\d+) × (\d+) px · (\d+) × (\d+) px · (\d+) case\(s\) remplie\(s\)$/, (m, a, b, c, d, e, f, n) => `${a} × ${b} tiles of ${c} × ${d} px · ${e} × ${f} px · ${n} filled cell(s)`],
  [/^(\d+) tuiles choisies : .+$/, (m, n) => `${n} tiles selected: the brush places one at random (ideal for varying grass, ground, bricks).`],
  [/^Supprimer la carte « (.+) » \?$/, (m, a) => `Delete map "${a}"?`],
  [/^Sauvegarde dans « (.+) » activée \((\d+) projets?\)$/, (m, a, n) => `Backup to "${a}" enabled (${n} project${+n > 1 ? 's' : ''})`],
  [/^(\d+) projets? copiés? dans « (.+) »$/, (m, n, a) => `${n} project${+n > 1 ? 's' : ''} copied to "${a}"`],
  [/^(\d+) projets? envoyés? sur Google Drive$/, (m, n) => `${n} project${+n > 1 ? 's' : ''} uploaded to Google Drive`],
  [/^Sauvegarde téléchargée : (\d+) projets?$/, (m, n) => `Backup downloaded: ${n} project${+n > 1 ? 's' : ''}`],
  [/^(\d+) projets? restaurés?$/, (m, n) => `${n} project${+n > 1 ? 's' : ''} restored`],
  [/^(\d+)×(\d+) · (\d+) % · (.+)$/, (m, w, h, z, rest) => `${w}×${h} · ${z}% · ${rest.replace('sél.', 'sel.').replace(/image (\d+)\/(\d+)/, 'frame $1/$2')}`],
];

const STATUS_I = PATTERNS.findIndex(([rx]) => rx.source.startsWith('^(\\d+)×(\\d+) · '));

export function getLang() {
  return lang;
}

/** Traduit une chaîne (renvoie l'originale si inconnue ou en français). */
export function tr(s) {
  if (lang === 'fr' || typeof s !== 'string') return s;
  const t = s.trim();
  if (!t) return s;
  const out = translateCore(t);
  if (out === null) return s;
  return s.replace(t, out);
}

/** Remplit un modèle : {1} groupe, {T1} groupe traduit, {C1} traduit en minuscules, {K1} touche, {?1:texte}. */
function fill(tpl, m) {
  return tpl
    .replace(/\{\?(\d):([^}]*)\}/g, (_, i, txt) => (m[+i] ? txt : ''))
    .replace(/\{([TCK]?)(\d)\}/g, (_, f, i) => {
      const v = m[+i] ?? '';
      if (f === 'T') return tr(v);
      if (f === 'C') return tr(v.charAt(0).toUpperCase() + v.slice(1)).toLowerCase();
      if (f === 'K') return v.replace(/Maj\+/g, 'Shift+');
      return v;
    });
}

function translateCore(t) {
  const direct = lookup(t);
  if (direct !== undefined) return direct;
  for (let i = 0; i < PATTERNS.length; i++) {
    const [rx, fn] = PATTERNS[i];
    const m = t.match(rx);
    if (!m) continue;
    if (PT && PT[i]) {
      // barre d'état : « sél. » et « image n/m » traduits avant le modèle
      if (i === STATUS_I && m[4]) m[4] = m[4].replace('sél.', tr('sél.')).replace(/image (\d+)\/(\d+)/, `${tr('image')} $1/$2`);
      return fill(PT[i], m);
    }
    return fn(...m);
  }
  // suffixe entre parenthèses : « Crayon (B) », « Nouveau calque (Ctrl+Maj+N) »
  let m = t.match(/^(.+?)(\s*\((?:[^()]*)\))$/);
  if (m && lookup(m[1])) return lookup(m[1]) + m[2].replace(/Maj/g, 'Shift').replace(/Suppr/g, 'Del');
  // ponctuation finale
  m = t.match(/^(.+?)(\s*(?:…|:|\.|\?|!))$/);
  if (m && lookup(m[1])) return lookup(m[1]) + m[2].trim().replace(/^:$/, ':');
  // préfixe symbole / émoji
  m = t.match(/^([^\p{L}\p{N}«"(]+)(.+)$/u);
  if (m && lookup(m[2])) return m[1] + lookup(m[2]);
  // message « Libellé : détail »
  m = t.match(/^(.+?) : (.+)$/);
  if (m && lookup(m[1])) return `${lookup(m[1])}: ${m[2]}`;
  return null;
}

function skip(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el) return true;
  if (el.closest('[translate="no"], script, style, code, textarea')) return true;
  return false;
}

function translateTextNode(n) {
  if (skip(n)) return;
  const v = n.nodeValue;
  const out = tr(v);
  if (out !== v) n.nodeValue = out;
}

function translateElement(el) {
  if (el.nodeType !== 1 || skip(el)) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const v = el.getAttribute(a);
    const out = tr(v);
    if (out !== v) el.setAttribute(a, out);
  }
}

function translateTree(root) {
  if (root.nodeType === 3) return translateTextNode(root);
  if (root.nodeType !== 1) return;
  translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 3) translateTextNode(n);
    else translateElement(n);
  }
}

let observer = null;
/** Choisit la langue (charge son dictionnaire) et traduit la page. À attendre avant de bâtir l'interface. */
export async function setLanguage(l) {
  lang = LANGS.some(([id]) => id === l) ? l : 'fr';
  DICT = null;
  PT = null;
  if (lang !== 'fr' && lang !== 'en') {
    try {
      const mod = await import(`./lang/${lang}.js`);
      DICT = mod.DICT;
      PT = mod.P || null;
    } catch (err) {
      console.warn('[i18n]', lang, err);
      lang = 'en';
    }
  }
  document.documentElement.lang = lang;
  if (lang !== 'fr') {
    translateTree(document.body);
    if (!observer) {
      observer = new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === 'childList') m.addedNodes.forEach(translateTree);
          else if (m.type === 'characterData') translateTextNode(m.target);
          else if (m.type === 'attributes') translateElement(m.target);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
    // titre de la page
    document.title = document.title.replace('éditeur de pixel art & PNGtuber', tr('éditeur de pixel art & PNGtuber'));
  }
}
