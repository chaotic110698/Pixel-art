// Raccourcis clavier (PC) + fenêtre d'aide listant tous les raccourcis.

import { h } from '../util/dom.js';
import { isTyping } from './input.js';
import { openDialog, anyDialogOpen, closeTopDialog, closePopups } from './dialogs.js';
import { cycleSymmetry } from './toolbar.js';
import * as ops from '../core/layer-ops.js';

export const SHORTCUTS = [
  ['Outils', [
    ['B', 'Crayon'], ['E', 'Gomme'], ['G', 'Remplissage'], ['I', 'Pipette (ou Alt maintenu)'], ['L', 'Ligne'],
    ['U', 'Rectangle'], ['O', 'Ellipse'], ['M', 'Sélection rectangle'], ['Q', 'Lasso'], ['W', 'Baguette magique'],
    ['V', 'Déplacer'], ['H', 'Main (déplacer la vue)'], ['K', 'Ombrage (éclaircir/assombrir selon la palette)'], ['J', 'Dégradé tramé'], ['D', 'Tramage on/off'], ['S', 'Symétrie (cycle)'],
    ['X', 'Échanger couleurs A/B'], ['[ / ]', 'Taille du pinceau −/+'], ['F', 'Formes pleines on/off'],
  ]],
  ['Édition', [
    ['Ctrl+Z', 'Annuler'], ['Ctrl+Y / Ctrl+Maj+Z', 'Rétablir'], ['Ctrl+C / X / V', 'Copier / couper / coller'],
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
    ['Ctrl+S', 'Enregistrer (local)'], ['Ctrl+Maj+S', 'Télécharger le fichier projet'], ['Ctrl+O', 'Projets'], ['Ctrl+Maj+E', 'Exporter'], ['?', 'Cette aide'],
  ]],
  ['Tactile', [
    ['1 doigt', 'Dessiner'], ['2 doigts', 'Zoomer / déplacer'], ['Tape à 2 doigts', 'Annuler'], ['Tape à 3 doigts', 'Rétablir'], ['Appui long sur une couleur', 'Choisir comme couleur B'],
  ]],
];

export function showShortcuts() {
  openDialog({
    title: 'Raccourcis clavier et gestes',
    wide: true,
    body: h('div', { class: 'fields', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' } },
      SHORTCUTS.map(([cat, list]) => h('div', {},
        h('h3', { style: { margin: '0 0 6px' } }, cat),
        h('table', { class: 'keys' }, list.map(([k, d]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, d))))))),
  });
}

export function initShortcuts(app) {
  const toolKeys = {};
  for (const t of app.tools.list) toolKeys[t.key.toLowerCase()] = t.id;

  window.addEventListener('paste', (e) => {
    if (isTyping(e)) return;
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      app.actions.pasteImage(item.getAsFile());
    }
  });

  window.addEventListener('keydown', (e) => {
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
      if (k === 's' && e.shiftKey) return run(() => A.saveProjectFile());
      if (k === 's') return run(() => app.storage?.saveNow(true));
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
    if (e.repeat) return;
    if (toolKeys[k] && !e.shiftKey && !e.altKey) return run(() => app.tools.select(toolKeys[k]));
    if (k === 'x') return run(() => app.swapColors());
    if (k === 'd') return run(() => app.setState({ dither: !app.state.dither }));
    if (k === 's') return run(() => cycleSymmetry(app));
    if (k === 'f') return run(() => app.setState({ shapeFill: !app.state.shapeFill }));
    if (k === '[') return run(() => app.setState({ brushSize: Math.max(1, app.state.brushSize - 1), shapeSize: Math.max(1, app.state.shapeSize - 1) }));
    if (k === ']') return run(() => app.setState({ brushSize: Math.min(64, app.state.brushSize + 1), shapeSize: Math.min(32, app.state.shapeSize + 1) }));
    if (k === '+' || k === '=') return run(() => app.viewport.stepZoom(1));
    if (k === '-' || k === '_') return run(() => app.viewport.stepZoom(-1));
    if (k === '0') return run(() => app.viewport.fit());
    if (k === '1') return run(() => app.viewport.actualSize());
    if (e.key === '#' || e.key === "'") return run(() => app.toggleGrid());
    if (k === 't') return run(() => app.toggleTileMode());
    if (k === 'n') return run(() => app.setState({ onion: !app.state.onion }));
    if (e.key === '?') return run(showShortcuts);
  });
}
