// Menu principal (bouton ☰).

import { popupMenu } from './dialogs.js';
import { showShortcuts, openKeymapDialog } from './shortcuts.js';
import * as img from '../core/image-ops.js';

export function openMainMenu(app, anchor) {
  const A = app.actions;
  const st = app.state;
  popupMenu(anchor, [
    { heading: 'Fichier' },
    { label: 'Nouveau dessin…', icon: 'plus', action: A.newDocument },
    { label: 'Nouveau personnage (PNGtuber)…', icon: 'user', action: A.newCharacter },
    { label: 'Mes projets…', icon: 'folder', hint: 'Ctrl+O', action: A.openProjects },
    { label: 'Enregistrer maintenant', icon: 'save', hint: 'Ctrl+S', action: A.saveAll },
    { label: 'Ouvrir un fichier (projet, Aseprite)…', icon: 'upload', action: A.openProjectFile },
    { label: 'Enregistrer dans un fichier (ordinateur)…', icon: 'save', hint: 'Ctrl+Maj+S', action: () => A.saveToComputer(true) },
    { label: 'Télécharger le fichier projet', icon: 'download', action: A.saveProjectFile },
    { label: 'Importer une image comme calque…', icon: 'image', action: () => A.importImage('layer') },
    { label: 'Importer une image de référence…', icon: 'ref', action: () => A.importImage('reference') },
    { label: 'Exporter…', icon: 'download', hint: 'Ctrl+Maj+E', action: () => A.exportDialog() },
    { heading: 'Image' },
    { label: 'Taille de l\'image / du canevas…', icon: 'crop', action: A.resizeDialog },
    { label: 'Recadrer sur la sélection', icon: 'crop', action: () => img.cropToSelection(app) },
    { label: 'Recadrer sur le contenu', icon: 'crop', action: () => img.cropToContent(app) },
    { label: 'Miroir horizontal', icon: 'flipH', action: () => img.flipDoc(app, 'h') },
    { label: 'Miroir vertical', icon: 'flipV', action: () => img.flipDoc(app, 'v') },
    { label: 'Rotation 90° horaire', icon: 'rotate', action: () => img.rotateDoc(app, 1) },
    { label: 'Rotation 90° antihoraire', icon: 'rotate', action: () => img.rotateDoc(app, -1) },
    { label: 'Remplacer une couleur…', icon: 'swap', action: A.replaceColorDialog },
    { label: 'Contour automatique…', icon: 'outline', action: A.outlineDialog },
    { label: 'Rotation libre / échelle de la sélection', icon: 'transform', hint: 'Ctrl+T', action: A.startTransform },
    { heading: 'Personnage' },
    { label: 'Bibliothèque de pièces…', icon: 'book', action: () => A.openLibrary() },
    { label: 'Recolorer le personnage…', icon: 'palette', action: A.recolor },
    { label: 'Mode PNGtuber', icon: 'tv', action: A.openPngtuber },
    { heading: 'Modes' },
    { label: 'Mode tuiles (mosaïque)', icon: 'tiles', hint: 'T', checked: st.tileMode, action: () => app.toggleTileMode() },
    { label: 'Animation (timeline)', icon: 'film', checked: !!app.timelineOpen, action: A.toggleAnimation },
    { heading: 'Affichage' },
    { label: 'Ajuster à l\'écran', icon: 'fit', hint: '0', action: () => app.viewport.fit() },
    { label: 'Taille réelle (100 %)', icon: 'one', hint: '1', action: () => app.viewport.actualSize() },
    { label: 'Paramètres (thème, couleurs, navigation…)', icon: 'settings', action: () => app.openSettings() },
    { label: 'Langue : English', icon: 'help', action: () => { app.setState({ lang: st.lang === 'en' ? 'fr' : 'en' }); app.savePrefs.flush(); app.storage?.saveNow().finally(() => location.reload()); } },
    { heading: 'Aide' },
    { label: 'Guide complet (outils, navigation, fonctionnalités)…', icon: 'book', hint: 'F1', action: () => app.openGuide() },
    { label: 'Raccourcis clavier et gestes', icon: 'keyboard', hint: '?', action: () => showShortcuts(app) },
    { label: 'Personnaliser les raccourcis…', icon: 'key', action: () => openKeymapDialog(app) },
    { label: 'Revoir le tutoriel', icon: 'help', action: () => app.startTutorial() },
  ]);
}
