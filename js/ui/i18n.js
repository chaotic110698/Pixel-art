// Interface en anglais : traduction à la volée du DOM (textes, infobulles,
// libellés d'accessibilité) à partir du dictionnaire i18n-en.js.
// Le code reste écrit en français ; les contenus de l'utilisateur (noms de
// calques, d'expressions, de projets…) sont marqués translate="no" et ignorés.

import { EN } from './i18n-en.js';

let lang = 'fr';
const ATTRS = ['title', 'aria-label', 'placeholder'];

// Motifs pour les textes dynamiques : [regex, fonction de remplacement]
const PATTERNS = [
  [/^Annulé : (.+)$/, (m, a) => `Undone: ${tr(a)}`],
  [/^Rétabli : (.+)$/, (m, a) => `Redone: ${tr(a)}`],
  [/^« (.+) » ajouté( \(avec une tête et un corps de base\))?$/, (m, a, b) => `"${a}" added${b ? ' (with a base head and body)' : ''}`],
  [/^« (.+) » : pièce retirée$/, (m, a) => `"${a}": part removed`],
  [/^« (.+) » ajouté à votre bibliothèque$/, (m, a) => `"${a}" added to your library`],
  [/^Ajouter « (.+) »$/, (m, a) => `Add "${a}"`],
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
  [/^Palette (.+)$/, (m, a) => (EN['Palette ' + a] ? EN['Palette ' + a] : `Palette ${a}`)],
  [/^Symétrie : (.+)$/, (m, a) => `Symmetry: ${{ aucune: 'none', 'verticale (gauche/droite)': 'vertical (left/right)', 'horizontale (haut/bas)': 'horizontal (top/bottom)', 'les deux': 'both' }[a] || a}`],
  [/^★ Favoris \((\d+)\)$/, (m, n) => `★ Favorites (${n})`],
  [/^(.+) \((.+)\) — clic droit ou appui long : autres outils$/, (m, a, k) => `${tr(a)} (${k}) — right click or long press: other tools`],
  [/^(Dessin|Remplissage|Formes|Sélection|Déplacer) : (.+)$/, (m, a, b) => `${tr(a)}: ${tr(b)}`],
  [/^Profil « (.+) »$/, (m, a) => `Profile "${a}"`],
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
  [/^(\d+)×(\d+) · (\d+) % · (.+)$/, (m, w, h, z, rest) => `${w}×${h} · ${z}% · ${rest.replace('sél.', 'sel.').replace(/image (\d+)\/(\d+)/, 'frame $1/$2')}`],
];

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

function translateCore(t) {
  if (Object.prototype.hasOwnProperty.call(EN, t)) return EN[t];
  for (const [rx, fn] of PATTERNS) {
    const m = t.match(rx);
    if (m) return fn(...m);
  }
  // suffixe entre parenthèses : « Crayon (B) », « Nouveau calque (Ctrl+Maj+N) »
  let m = t.match(/^(.+?)(\s*\((?:[^()]*)\))$/);
  if (m && EN[m[1]]) return EN[m[1]] + m[2].replace(/Maj/g, 'Shift').replace(/Suppr/g, 'Del');
  // ponctuation finale
  m = t.match(/^(.+?)(\s*(?:…|:|\.|\?|!))$/);
  if (m && EN[m[1]]) return EN[m[1]] + m[2].trim().replace(/^:$/, ':');
  // préfixe symbole / émoji
  m = t.match(/^([^\p{L}\p{N}«"(]+)(.+)$/u);
  if (m && EN[m[2]]) return m[1] + EN[m[2]];
  // message « Libellé : détail »
  m = t.match(/^(.+?) : (.+)$/);
  if (m && EN[m[1]]) return `${EN[m[1]]}: ${m[2]}`;
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
export function setLanguage(l) {
  lang = l === 'en' ? 'en' : 'fr';
  document.documentElement.lang = lang;
  if (lang === 'en') {
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
    document.title = document.title.replace('éditeur de pixel art & PNGtuber', 'pixel art & PNGtuber editor');
  }
}
