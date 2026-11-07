// Raccourcis clavier (PC) + fenêtre d'aide listant tous les raccourcis.

import { h } from '../util/dom.js';
import { isTyping } from './input.js';
import { openDialog, anyDialogOpen, closeTopDialog, closePopups } from './dialogs.js';
import { cycleSymmetry, closeFlyout } from './toolbar.js';
import * as ops from '../core/layer-ops.js';
import { channel } from '../storage/storage.js';
import { matchesCombo } from './keycapture.js';

export const SHORTCUTS = [
  ['Outils', [
    ['B', 'Crayon'], ['E', 'Gomme'], ['G', 'Remplissage'], ['I', 'Pipette (ou Alt maintenu)'], ['L', 'Ligne'],
    ['U', 'Rectangle'], ['O', 'Ellipse'], ['M', 'Sélection rectangle'], ['Q', 'Lasso'], ['W', 'Baguette magique'],
    ['V', 'Déplacer'], ['H', 'Main (déplacer la vue)'], ['K', 'Ombrage (éclaircir/assombrir selon la palette)'], ['J', 'Dégradé tramé'], ['D', 'Tramage on/off'], ['S', 'Symétrie (cycle)'],
    ['X', 'Échanger couleurs A/B'], ['[ / ]', 'Taille du pinceau −/+'], ['F', 'Formes pleines on/off'],
  ]],
  ['Édition', [
    ['Ctrl+Z', 'Annuler la dernière action'], ['Ctrl+Y / Ctrl+Maj+Z', 'Rétablir'], ['Ctrl+C / X / V', 'Copier / couper / coller'],
    ['Ctrl+A', 'Tout sélectionner'], ['Ctrl+D / Échap', 'Désélectionner'], ['Ctrl+Maj+I', 'Inverser la sélection'], ['Suppr', 'Effacer la sélection'],
    ['Entrée', 'Valider le déplacement'], ['Flèches', 'Déplacer la sélection de 1 px (Maj : 8 px)'],
    ['Maj+H / Maj+V', 'Miroir de la sélection'], ['Maj+R', 'Rotation 90° de la sélection'], ['Ctrl+T', 'Rotation libre / échelle'],
    ['Maj (crayon)', 'Ligne droite depuis le dernier point'], ['Maj (formes)', 'Carré / cercle / 45°'],
    ['Clic droit', 'Dessiner avec la couleur B'],
  ]],
  ['Calques', [
    ['Ctrl+Maj+N', 'Nouveau calque'], ['Ctrl+J', 'Dupliquer'], ['Ctrl+E', 'Fusionner vers le bas'],
    ['Alt+↑ / Alt+↓', 'Calque actif précédent / suivant'], ['F2', 'Renommer'], ['Tab', 'Variante suivante du groupe actif'],
  ]],
  ['Vue', [
    ['Molette / pincement', 'Zoom'], ['Espace + glisser, clic milieu', 'Déplacer la vue'], ['+ / −', 'Zoom avant / arrière'],
    ['0', 'Ajuster à l\'écran'], ['1', 'Taille réelle (100 %)'], ['#', 'Grille on/off'], ['T', 'Mode tuiles on/off'], ['N', 'Onion skin on/off'],
  ]],
  ['Fichier', [
    ['F1', 'Guide complet (ouvert sur l\'outil actif)'], ['Ctrl+S', 'Enregistrer (navigateur + fichier lié)'], ['Ctrl+Maj+S', 'Enregistrer dans un fichier…'], ['Ctrl+O', 'Projets'], ['Ctrl+Maj+E', 'Exporter'], ['?', 'Cette aide'],
  ]],
  ['Profils', [
    ['F13 … F24', 'Changer de profil (tenue / personnage), voir onglet Expressions'],
  ]],
  ['Mode PNGtuber', [
    ['Espace', 'Parler (maintenir)'], ['Échap', 'Quitter le mode PNGtuber'],
    ['Touches choisies', 'Expressions, profils, effets et fonds (touche ou combinaison, ex. Ctrl+Maj+1)'],
  ]],
  ['Tactile', [
    ['1 doigt', 'Dessiner'], ['2 doigts', 'Zoomer / déplacer'], ['Tape à 2 doigts', 'Annuler la dernière action'], ['Tape à 3 doigts', 'Rétablir'], ['Appui long sur une couleur', 'Choisir comme couleur B'],
  ]],
];

export function showShortcuts(app = null) {
  openDialog({
    title: 'Raccourcis clavier et gestes',
    wide: true,
    body: h('div', { class: 'fields', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' } },
      shortcutTable(app).map(([cat, list]) => h('div', {},
        h('h3', { style: { margin: '0 0 6px' } }, cat),
        h('table', { class: 'keys' }, list.map(([k, d]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, d))))))),
    buttons: app ? [
      { label: 'Lexique complet', action: () => { app.openGuide?.('lexique'); return true; } },
      { label: 'Personnaliser les touches…', action: () => { openKeymapDialog(app); return true; } },
      { label: 'Fermer', value: null, primary: true },
    ] : [],
  });
}

/** Tableau d'aide : la section « Outils » reflète la configuration actuelle. */
function shortcutTable(app) {
  if (!app) return SHORTCUTS;
  const first = ['Touches simples (personnalisables)', singleKeyActions(app).map((a) => [(a.key || '—').toUpperCase(), a.label])];
  return [first, ...SHORTCUTS.slice(1)];
}

/** Fenêtre de personnalisation des touches simples. */
export function openKeymapDialog(app) {
  const body = h('div');
  let waiting = null;
  const render = () => {
    const acts = singleKeyActions(app);
    body.replaceChildren(
      h('p', { class: 'hint' }, 'Cliquez sur une touche puis appuyez sur la nouvelle (lettre, chiffre ou symbole). Échap annule, Retour arrière retire la touche. Les raccourcis avec Ctrl restent fixes.'),
      h('table', { class: 'keys' }, acts.map((a) => h('tr', {},
        h('td', {}, h('button', { class: 'btn small' + (waiting === a.id ? ' primary' : ''), style: { minWidth: '64px' }, onclick: () => { waiting = a.id; render(); } }, waiting === a.id ? '…' : (a.key || '—').toUpperCase())),
        h('td', {}, a.label),
        h('td', {}, a.key !== a.def ? h('button', { class: 'btn small', title: 'Touche par défaut', onclick: () => setKey(a.id, a.def) }, `↺ ${a.def.toUpperCase()}`) : null)))));
  };
  const setKey = (id, key) => {
    const map = { ...(app.state.keymap || {}) };
    if (key) {
      // une touche ne peut servir qu'à une action
      for (const a of singleKeyActions(app)) if (a.id !== id && a.key === key) map[a.id] = '';
    }
    map[id] = key;
    app.setState({ keymap: map });
    applyKeymap(app);
    waiting = null;
    render();
  };
  const onKey = (e) => {
    if (!waiting) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { waiting = null; render(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') return setKey(waiting, '');
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.key === ' ') return;
    setKey(waiting, e.key.toLowerCase());
  };
  window.addEventListener('keydown', onKey, true);
  render();
  openDialog({
    title: 'Personnaliser les raccourcis',
    wide: true,
    body,
    buttons: [
      { label: 'Tout réinitialiser', action: () => { app.setState({ keymap: {} }); applyKeymap(app); render(); return false; } },
      { label: 'Fermer', primary: true, value: true },
    ],
    onClose: () => window.removeEventListener('keydown', onKey, true),
  });
}

/**
 * Actions déclenchées par une seule touche : PERSONNALISABLES.
 * id -> { label, def (touche par défaut, minuscule), run(app) }
 */
export function singleKeyActions(app) {
  const list = app.tools.list.map((t) => ({ id: 'tool:' + t.id, label: t.name, def: t.defaultKey.toLowerCase(), run: () => app.tools.select(t.id) }));
  list.push(
    { id: 'swap', label: 'Échanger les couleurs A/B', def: 'x', run: () => app.swapColors() },
    { id: 'dither', label: 'Tramage on/off', def: 'd', run: () => app.setState({ dither: !app.state.dither }) },
    { id: 'symmetry', label: 'Symétrie (cycle)', def: 's', run: () => cycleSymmetry(app) },
    { id: 'fill', label: 'Formes pleines on/off', def: 'f', run: () => app.setState({ shapeFill: !app.state.shapeFill }) },
    { id: 'brushDown', label: 'Taille du pinceau −', def: '[', run: () => app.setState({ brushSize: Math.max(1, app.state.brushSize - 1), shapeSize: Math.max(1, app.state.shapeSize - 1) }) },
    { id: 'brushUp', label: 'Taille du pinceau +', def: ']', run: () => app.setState({ brushSize: Math.min(64, app.state.brushSize + 1), shapeSize: Math.min(32, app.state.shapeSize + 1) }) },
    { id: 'zoomIn', label: 'Zoom avant', def: '+', run: () => app.viewport.stepZoom(1) },
    { id: 'zoomOut', label: 'Zoom arrière', def: '-', run: () => app.viewport.stepZoom(-1) },
    { id: 'fit', label: 'Ajuster à l\'écran', def: '0', run: () => app.viewport.fit() },
    { id: 'actual', label: 'Taille réelle', def: '1', run: () => app.viewport.actualSize() },
    { id: 'grid', label: 'Grille on/off', def: '#', run: () => app.toggleGrid() },
    { id: 'tiles', label: 'Mode tuiles on/off', def: 't', run: () => app.toggleTileMode() },
    { id: 'onion', label: 'Onion skin on/off', def: 'n', run: () => app.setState({ onion: !app.state.onion }) },
    { id: 'help', label: 'Aide des raccourcis', def: '?', run: () => showShortcuts(app) },
  );
  const map = app.state.keymap || {};
  for (const a of list) a.key = (map[a.id] ?? a.def) || '';
  return list;
}

/** Applique la configuration : touches affichées dans les infobulles des outils. */
export function applyKeymap(app) {
  for (const a of singleKeyActions(app)) {
    if (a.id.startsWith('tool:')) app.tools.get(a.id.slice(5)).key = (a.key || '—').toUpperCase();
  }
  app.emit('keymap');
}

export function initShortcuts(app) {
  for (const t of app.tools.list) t.defaultKey = t.defaultKey || t.key;
  applyKeymap(app);

  window.addEventListener('paste', (e) => {
    if (isTyping(e)) return;
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      app.actions.pasteImage(item.getAsFile());
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.tool-flyout')) {
      closeFlyout();
      return;
    }
    if (e.key === 'Escape' && (anyDialogOpen() || document.querySelector('.popup-menu'))) {
      closePopups();
      closeTopDialog();
      return;
    }
    if (isTyping(e)) return;
    if (app.pngtuberOpen) return; // le mode PNGtuber gère ses propres touches
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const sel = app.selection;
    const A = app.actions;

    if (e.key === 'Escape' && app.freeTransform) {
      A.endTransform(true);
      return;
    }
    if (e.key === 'Escape') {
      closePopups();
      if (closeTopDialog()) return;
      if (sel.floating) sel.cancelFloating();
      else if (sel.active) sel.deselect();
      app.tools.current.cancel?.();
      app.closeDrawer?.();
      return;
    }
    if (anyDialogOpen()) return;

    // profils (tenues / personnages) : F13–F24 ou combinaison, appliqués dans l'éditeur et transmis à la fenêtre de capture
    {
      const pf = app.doc.profiles.find((p) => p.key && matchesCombo(e, p.key));
      if (pf) {
        e.preventDefault();
        if (!e.repeat) {
          ops.applyProfile(app, pf.id);
          channel?.postMessage({ type: 'profile', projectId: app.doc.id, id: pf.id });
        }
        return;
      }
      if (/^F(1[3-9]|2[0-4])$/.test(e.key)) return;
    }

    const run = (fn) => {
      e.preventDefault();
      fn();
    };

    if (ctrl) {
      if (k === 'z' && !e.shiftKey) return run(() => app.history.undo());
      if (k === 'y' || (k === 'z' && e.shiftKey)) return run(() => app.history.redo());
      if (k === 'c') return run(() => A.copy());
      if (k === 'x') return run(() => A.copy(true));
      if (k === 'v') {
        // laisser l'évènement « paste » natif gérer les images du système si le presse-papiers interne est vide
        if (app.clipboard) return run(() => A.paste());
        return;
      }
      if (k === 'a') return run(() => sel.selectAll());
      if (k === 'd') return run(() => sel.deselect());
      if (k === 'i' && e.shiftKey) return run(() => sel.invert());
      if (k === 's' && e.shiftKey) return run(() => A.saveToComputer(true));
      if (k === 's') return run(() => A.saveAll());
      if (k === 'o') return run(() => A.openProjects());
      if (k === 'e' && e.shiftKey) return run(() => A.exportDialog());
      if (k === 'e') return run(() => ops.mergeDown(app));
      if (k === 'j') return run(() => ops.duplicate(app));
      if (k === 't') return run(() => A.startTransform());
      if (k === 'n' && e.shiftKey) return run(() => ops.addLayer(app));
      if (k === '0') return run(() => app.viewport.fit());
      if (k === '1') return run(() => app.viewport.actualSize());
      return;
    }

    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      return run(() => {
        // calques dans l'ordre affiché (haut -> bas)
        const list = [];
        const visit = (g) => { for (let i = g.children.length - 1; i >= 0; i--) { const n = app.doc.get(g.children[i]); list.push(n); if (n.type === 'group' && !n.collapsed) visit(n); } };
        visit(app.doc.root);
        const i = list.findIndex((n) => n.id === app.doc.activeId);
        const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowUp' ? -1 : 1)))];
        if (next) {
          sel.commitFloating();
          app.doc.activeId = next.id;
          app.emit('structure');
        }
      });
    }

    if (e.key.startsWith('Arrow') && sel.active) {
      return run(() => {
        const step = e.shiftKey ? 8 : 1;
        if (!sel.floating && !sel.lift()) return;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        sel.moveFloating(...d);
      });
    }
    if (e.key === 'Enter' && app.freeTransform) return run(() => A.endTransform(false));
    if (e.key === 'Enter' && sel.floating) return run(() => sel.commitFloating());
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) return run(() => A.deleteSelection());
    if (e.key === 'F2') return run(() => app.renameActive?.());
    if (e.key === 'F1') return run(() => app.openToolGuide?.());
    if (e.key === 'Tab') {
      return run(() => {
        const a = app.doc.active;
        let g = a && (a.type === 'group' && a.variant ? a : app.doc.get(a.parent));
        while (g && !g.variant) g = app.doc.get(g.parent);
        if (g && g.variant) ops.cycleVariant(app, g.id, e.shiftKey ? -1 : 1);
        else app.toast('Sélectionnez un calque dans un groupe de variantes');
      });
    }

    if (e.shiftKey && sel.active) {
      if (k === 'h') return run(() => sel.transformFloating('flipH'));
      if (k === 'v') return run(() => sel.transformFloating('flipV'));
      if (k === 'r') return run(() => sel.transformFloating('cw'));
    }
    if (e.repeat || e.altKey) return;
    // touches simples personnalisables (Maj autorisée seulement pour les symboles comme ? ou #)
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const alias = { '=': '+', '_': '-', "'": '#' };
    for (const a of singleKeyActions(app)) {
      if (!a.key) continue;
      if (a.key === key || (a.key === alias[key])) {
        if (e.shiftKey && /^[a-z0-9]$/.test(key)) continue;
        return run(a.run);
      }
    }
  });
}
