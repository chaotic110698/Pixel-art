// Menu principal (bouton ☰).

import { popupMenu } from './dialogs.js';
import { showShortcuts } from './shortcuts.js';
import * as img from '../core/image-ops.js';

export function openMainMenu(app, anchor) {
  const A = app.actions;
  const st = app.state;
  popupMenu(anchor, [
    { heading: 'Fichier' },
    { label: 'Nouveau dessin…', icon: 'plus', action: A.newDocument },
    { label: 'Nouveau personnage (PNGtuber)…', icon: 'user', action: A.newCharacter },
    { label: 'Mes projets…', icon: 'folder', hint: 'Ctrl+O', action: A.openProjects },
    { label: 'Enregistrer maintenant', icon: 'save', hint: 'Ctrl+S', action: () => app.storage?.saveNow(true) },
    { label: 'Ouvrir un fichier projet…', icon: 'upload', action: A.openProjectFile },
    { label: 'Télécharger le fichier projet', icon: 'download', hint: 'Ctrl+Maj+S', action: A.saveProjectFile },
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
    { label: 'Aperçu taille réelle', icon: 'image', checked: st.showMinimap !== false, action: () => app.setState({ showMinimap: st.showMinimap === false }) },
    { label: 'Barre de variantes sur le canevas', icon: 'variants', checked: st.showVariantBar !== false, action: () => app.setState({ showVariantBar: st.showVariantBar === false }) },
    { label: 'Grille de pixels au fort zoom', icon: 'grid', checked: st.showPixelGrid, action: () => app.setState({ showPixelGrid: !st.showPixelGrid }) },
    { label: 'Molette = déplacer (sinon zoom)', icon: 'hand', checked: st.wheelPans, action: () => app.setState({ wheelPans: !st.wheelPans }) },
    { label: st.theme === 'dark' ? 'Thème clair' : 'Thème sombre', icon: st.theme === 'dark' ? 'sun' : 'moon', action: () => app.setTheme(st.theme === 'dark' ? 'light' : 'dark') },
    { heading: 'Aide' },
    { label: 'Raccourcis clavier et gestes', icon: 'keyboard', hint: '?', action: showShortcuts },
    { label: 'Revoir le tutoriel', icon: 'help', action: () => app.startTutorial() },
  ]);
}
