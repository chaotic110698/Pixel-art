// Contenu du guide complet (fenêtre « Guide »), en français et en anglais.
// Chaque texte est une paire T(fr, en). Mise en forme légère dans les textes :
//   **gras**   et   [[Touche]] (affichée comme une touche de clavier).
// Blocs : p (paragraphe), list (puces), steps (étapes numérotées), keys (raccourcis),
// tip (astuce), try (bouton qui ouvre l'outil ou la fonction : 'tool:pencil',
// 'action:openLibrary', 'panel:layers', 'settings:nav', 'shortcuts', 'tutorial', 'timeline').

const T = (fr, en) => ({ fr, en });
const p = (fr, en) => ({ p: T(fr, en) });
const tip = (fr, en) => ({ tip: T(fr, en) });
const list = (...items) => ({ list: items.map(([fr, en]) => T(fr, en)) });
const steps = (...items) => ({ steps: items.map(([fr, en]) => T(fr, en)) });
const keys = (...items) => ({ keys: items.map(([k, fr, en]) => [k, T(fr, en)]) });
const go = (target, fr, en) => ({ try: target, label: T(fr, en) });

export const GUIDE = [
  // ------------------------------------------------------------------
  {
    id: 'start', icon: 'help', title: T('Bien démarrer', 'Getting started'),
    intro: T('Pixel Atelier est un éditeur de pixel art complet qui fonctionne dans le navigateur, sur ordinateur comme sur téléphone, même sans connexion. Il est pensé pour créer des personnages PNGtuber, mais convient à tout dessin en pixels.',
      'Pixel Atelier is a complete pixel art editor that runs in the browser, on computers and phones, even offline. It is designed for PNGtuber characters but works for any pixel drawing.'),
    sections: [
      {
        id: 'interface', title: T('L\'écran en un coup d\'œil', 'The screen at a glance'),
        body: [
          list(
            ['**Barre du haut** : menu ☰ (fichiers, image, modes, aide), nom du projet (cliquez pour le renommer), annuler / rétablir, grille, ajuster à l\'écran, zoom, bibliothèque, mode PNGtuber, export, guide et paramètres.',
              '**Top bar**: ☰ menu (files, image, modes, help), project name (click to rename), undo / redo, grid, fit to screen, zoom, library, PNGtuber mode, export, guide and settings.'],
            ['**Barre d\'outils** (à gauche, en bas sur téléphone) : les outils sont rangés par familles. Un bouton affiche le dernier outil utilisé de sa famille ; un petit triangle indique qu\'il y en a d\'autres.',
              '**Toolbar** (left, bottom on phones): tools are grouped by family. Each button shows the last tool used in its family; a small triangle means there are more.'],
            ['**Barre d\'options** (sous la barre du haut) : les réglages de l\'outil actif (taille, forme, tramage, symétrie…).',
              '**Options bar** (below the top bar): settings of the active tool (size, shape, dithering, symmetry…).'],
            ['**Zone de dessin** au centre, avec la **barre de variantes** en haut à gauche (changer d\'yeux, de bouche… en un clic) et la **mini-vue** en taille réelle en haut à droite.',
              '**Drawing area** in the middle, with the **variant bar** at the top left (switch eyes, mouth… in one click) and the real-size **mini view** at the top right.'],
            ['**Panneaux** (à droite) : Couleurs, Calques, Expressions, Grille, Historique. Sur téléphone, ils s\'ouvrent depuis la barre du bas.',
              '**Panels** (right): Colors, Layers, Expressions, Grid, History. On phones they open from the bottom bar.'],
            ['**Barre d\'état** en bas de la zone de dessin : taille de l\'image, zoom, position du curseur, image d\'animation.',
              '**Status bar** at the bottom of the drawing area: image size, zoom, cursor position, animation frame.'],
          ),
        ],
      },
      {
        id: 'first', title: T('Premiers pas', 'First steps'),
        body: [
          steps(
            ['Menu ☰ > **Nouveau dessin** pour une toile vierge (taille au choix, 32×32 ou 64×64 conseillés), ou **Nouveau personnage** pour partir d\'un personnage complet prêt pour le PNGtuber.',
              '☰ menu > **New drawing** for a blank canvas (any size, 32×32 or 64×64 recommended), or **New character** to start from a complete character ready for PNGtuber use.'],
            ['Choisissez une couleur dans le panneau Couleurs (clic = couleur A, clic droit ou appui long = couleur B).',
              'Pick a color in the Colors panel (click = color A, right click or long press = color B).'],
            ['Dessinez avec le crayon [[B]]. Clic droit = dessiner avec la couleur B. Une erreur ? [[Ctrl+Z]].',
              'Draw with the pencil [[B]]. Right click = draw with color B. A mistake? [[Ctrl+Z]].'],
            ['Tout est enregistré automatiquement dans le navigateur. Pour garder une copie, menu ☰ > **Enregistrer dans un fichier**.',
              'Everything is saved automatically in the browser. To keep a copy, ☰ menu > **Save to a file**.'],
            ['Quand c\'est prêt : bouton **Exporter** (PNG, GIF, planche, ZIP…).', 'When ready: **Export** button (PNG, GIF, sheet, ZIP…).'],
          ),
          go('action:newCharacter', 'Créer un personnage', 'Create a character'),
          go('tutorial', 'Lancer la visite guidée', 'Start the guided tour'),
        ],
      },
      {
        id: 'install', title: T('Installer comme une application', 'Install as an app'),
        body: [
          p('Le site peut s\'installer sur l\'écran d\'accueil (téléphone) ou comme application (ordinateur) : menu du navigateur > « Installer » ou « Ajouter à l\'écran d\'accueil ». Il fonctionne ensuite hors ligne. Quand une nouvelle version est publiée, un bandeau propose de recharger.',
            'The site can be installed on the home screen (phone) or as an app (computer): browser menu > "Install" or "Add to home screen". It then works offline. When a new version is published, a banner offers to reload.'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'nav', icon: 'hand', title: T('Navigation et gestes', 'Navigation and gestures'),
    intro: T('Zoomer, se déplacer dans l\'image et circuler dans l\'interface, à la souris, au clavier ou au doigt.',
      'Zoom, move around the image and get around the interface with a mouse, keyboard or finger.'),
    sections: [
      {
        id: 'mouse', title: T('Souris et pavé tactile', 'Mouse and touchpad'),
        body: [
          list(
            ['**Molette** : zoom autour du curseur (par paliers ou fluide, au choix dans Paramètres > Navigation). [[Ctrl]] + molette zoome toujours.',
              '**Wheel**: zoom around the cursor (in steps or smooth, see Settings > Navigation). [[Ctrl]] + wheel always zooms.'],
            ['**Se déplacer** : maintenir [[Espace]] et glisser, ou glisser avec le **clic du milieu**, ou l\'outil Main [[H]].',
              '**Pan**: hold [[Space]] and drag, drag with the **middle button**, or use the Hand tool [[H]].'],
            ['Option « La molette déplace la vue » (Paramètres) : pratique avec un pavé tactile ; on zoome alors avec [[Ctrl]] + molette ou le pincement.',
              '"Wheel pans the view" option (Settings): handy on a touchpad; zoom with [[Ctrl]] + wheel or pinch.'],
          ),
          keys(['+ / −', 'Zoom avant / arrière', 'Zoom in / out'], ['0', 'Ajuster à l\'écran', 'Fit to screen'], ['1', 'Taille réelle (100 %)', 'Actual size (100%)'], ['#', 'Grille on/off', 'Grid on/off']),
        ],
      },
      {
        id: 'touch', title: T('Écran tactile et stylet', 'Touch screen and stylus'),
        body: [
          list(
            ['**1 doigt** : dessiner avec l\'outil actif.', '**1 finger**: draw with the active tool.'],
            ['**2 doigts** : pincer pour zoomer, glisser pour déplacer la vue (sans rien dessiner).', '**2 fingers**: pinch to zoom, drag to pan (nothing is drawn).'],
            ['**Tape à 2 doigts** : annuler. **Tape à 3 doigts** : rétablir.', '**2-finger tap**: undo. **3-finger tap**: redo.'],
            ['**Appui long** sur une couleur : la choisir comme couleur B. Appui long sur un outil : voir les autres outils de sa famille.',
              '**Long press** a color: set it as color B. Long press a tool: see the other tools of its family.'],
            ['**Mode stylet** (Paramètres > Navigation) : seul le stylet dessine, un doigt déplace la vue. Idéal sur tablette.',
              '**Stylus mode** (Settings > Navigation): only the pen draws, one finger pans. Ideal on tablets.'],
          ),
          go('settings:nav', 'Régler la navigation', 'Navigation settings'),
        ],
      },
      {
        id: 'ui', title: T('Circuler dans l\'interface', 'Getting around the interface'),
        body: [
          list(
            ['**Familles d\'outils** : cliquez à nouveau sur l\'outil actif, faites un clic droit ou un appui long pour choisir un autre outil de la famille.',
              '**Tool families**: click the active tool again, right click or long press to pick another tool of the family.'],
            ['**Panneaux** : onglets en haut à droite (sur téléphone, barre du bas : Couleurs, Calques, Expressions, Pièces, PNGtuber). Glissez la poignée du tiroir vers le bas pour le fermer.',
              '**Panels**: tabs at the top right (on phones, bottom bar: Colors, Layers, Expressions, Parts, PNGtuber). Drag the drawer handle down to close it.'],
            ['**Fenêtres** : [[Échap]] ou ✕ pour fermer. Les menus contextuels (⋯) proposent les actions avancées.',
              '**Windows**: [[Esc]] or ✕ to close. Context menus (⋯) hold advanced actions.'],
            ['**Mini-vue** (en haut à droite) : l\'image en taille réelle ; un clic ajuste la vue à l\'écran.',
              '**Mini view** (top right): the image at real size; one click fits the view.'],
            ['**Barre de variantes** (en haut à gauche) : ‹ › pour changer la variante de chaque groupe (yeux, bouche…).',
              '**Variant bar** (top left): ‹ › to change the variant of each group (eyes, mouth…).'],
          ),
          go('shortcuts', 'Voir tous les raccourcis', 'See all shortcuts'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'draw', icon: 'pencil', title: T('Outils de dessin', 'Drawing tools'),
    intro: T('Chaque outil se choisit dans la barre d\'outils ou avec sa touche. Ses réglages apparaissent dans la barre d\'options. Le clic gauche utilise la couleur A, le clic droit la couleur B.',
      'Pick each tool in the toolbar or with its key. Its settings appear in the options bar. Left click uses color A, right click color B.'),
    sections: [
      {
        id: 'pencil', icon: 'pencil', title: T('Crayon [[B]]', 'Pencil [[B]]'),
        body: [
          p('Pose des pixels nets. C\'est l\'outil de base du pixel art.', 'Places crisp pixels. The basic pixel art tool.'),
          list(
            ['**Taille** (1 à 64) et forme **carrée** ou **ronde**. [[[]] et [[]]] changent la taille.', '**Size** (1 to 64) and **square** or **round** shape. [[[]] and [[]]] change the size.'],
            ['**Pixel perfect** (taille 1) : retire automatiquement les pixels en trop dans les courbes, pour des traits propres.', '**Pixel perfect** (size 1): automatically removes extra pixels in curves for clean lines.'],
            ['**Remplacer** : ne peint que sur la couleur touchée au début du trait (pratique pour recolorer une zone sans déborder).', '**Replace**: only paints over the color touched at the start of the stroke (handy to recolor an area without spilling).'],
            ['[[Maj]] + clic : trace une ligne droite depuis le dernier point.', '[[Shift]] + click: draws a straight line from the last point.'],
            ['[[Alt]] maintenu : pipette temporaire.', 'Hold [[Alt]]: temporary color picker.'],
            ['Tramage et symétrie : voir « Options communes ».', 'Dithering and symmetry: see "Common options".'],
          ),
          go('tool:pencil', 'Prendre le crayon', 'Use the pencil'),
        ],
      },
      {
        id: 'eraser', icon: 'eraser', title: T('Gomme [[E]]', 'Eraser [[E]]'),
        body: [
          p('Rend les pixels transparents. Mêmes réglages que le crayon (taille, forme, pixel perfect). Le clic droit efface aussi.',
            'Makes pixels transparent. Same settings as the pencil (size, shape, pixel perfect). Right click also erases.'),
          go('tool:eraser', 'Prendre la gomme', 'Use the eraser'),
        ],
      },
      {
        id: 'shade', icon: 'shade', title: T('Ombrage [[K]]', 'Shading [[K]]'),
        body: [
          p('Éclaircit ou assombrit les pixels existants en suivant l\'ordre de la **palette** : passer sur un pixel prend la couleur voisine dans la palette. Idéal pour poser lumières et ombres sans changer de couleur.',
            'Lightens or darkens existing pixels following the **palette** order: going over a pixel takes the neighbouring palette color. Ideal for light and shadow without switching colors.'),
          list(
            ['**Éclaircir** / **Assombrir** dans la barre d\'options ; le clic droit fait l\'inverse.', '**Lighten** / **Darken** in the options bar; right click does the opposite.'],
            ['La palette doit contenir des teintes rangées du clair au foncé (par exemple une palette de peau).', 'The palette should contain shades ordered from light to dark (for example a skin palette).'],
          ),
          go('tool:shade', 'Essayer l\'ombrage', 'Try shading'),
        ],
      },
      {
        id: 'fill', icon: 'fill', title: T('Remplissage [[G]]', 'Fill [[G]]'),
        body: [
          list(
            ['**Contigu** : remplit la zone touchée ; **Global** : remplace cette couleur partout dans le calque.', '**Contiguous**: fills the touched area; **Global**: replaces that color everywhere on the layer.'],
            ['**Tous les calques** : les limites viennent de l\'image visible (pratique pour colorier sous un contour placé sur un autre calque).', '**All layers**: boundaries come from the visible image (handy to color under line art on another layer).'],
            ['**Tolérance** : accepte les couleurs proches.', '**Tolerance**: accepts similar colors.'],
            ['Avec le **tramage**, la zone est remplie d\'un motif.', 'With **dithering**, the area is filled with a pattern.'],
            ['Une sélection active limite le remplissage.', 'An active selection limits the fill.'],
          ),
          go('tool:fill', 'Prendre le pot de peinture', 'Use the fill tool'),
        ],
      },
      {
        id: 'gradient', icon: 'gradient', title: T('Dégradé tramé [[J]]', 'Dithered gradient [[J]]'),
        body: [
          p('Glissez du point de départ (couleur A) au point d\'arrivée (couleur B). Le dégradé est construit en pixels tramés, sans couleurs intermédiaires floues.',
            'Drag from the start point (color A) to the end point (color B). The gradient is built with dithered pixels, without blurry in-between colors.'),
          list(
            ['**Linéaire** ou **Radial**.', '**Linear** or **Radial**.'],
            ['**Tout le calque** ou **Zone touchée** (la zone de couleur sous le point de départ).', '**Whole layer** or **Touched area** (the color area under the start point).'],
            ['**Tramé** désactivé : deux aplats nets. La sélection limite la zone.', '**Dithered** off: two flat areas. The selection limits the area.'],
          ),
          go('tool:gradient', 'Essayer le dégradé', 'Try the gradient'),
        ],
      },
      {
        id: 'picker', icon: 'picker', title: T('Pipette [[I]]', 'Color picker [[I]]'),
        body: [
          list(
            ['Clic : prend la couleur comme couleur A ; clic droit : couleur B. On peut glisser pour viser.', 'Click: takes the color as color A; right click: color B. You can drag to aim.'],
            ['**Image** (ce que l\'on voit) ou **Calque actif** seulement.', '**Image** (what you see) or **Active layer** only.'],
            ['**Revenir à l\'outil précédent** après avoir pris la couleur.', '**Return to the previous tool** after picking.'],
            ['Raccourci : maintenir [[Alt]] avec le crayon.', 'Shortcut: hold [[Alt]] with the pencil.'],
          ),
          go('tool:picker', 'Prendre la pipette', 'Use the color picker'),
        ],
      },
      {
        id: 'shapes', icon: 'rect', title: T('Ligne [[L]], rectangle [[U]], ellipse [[O]]', 'Line [[L]], rectangle [[U]], ellipse [[O]]'),
        body: [
          list(
            ['Glissez du premier coin au second ; l\'aperçu suit le curseur.', 'Drag from the first corner to the second; the preview follows the cursor.'],
            ['[[Maj]] : carré, cercle, ou ligne à 45°.', '[[Shift]]: square, circle, or 45° line.'],
            ['**Épaisseur** du trait, **Contour** ou **Plein** (rectangle, ellipse). [[F]] bascule plein / contour.', '**Thickness**, **Outline** or **Filled** (rectangle, ellipse). [[F]] toggles filled / outline.'],
            ['Avec la grille aimantée (panneau Grille), les formes s\'alignent sur les cellules.', 'With a snapping grid (Grid panel), shapes align to cells.'],
          ),
          go('tool:rect', 'Dessiner un rectangle', 'Draw a rectangle'),
        ],
      },
      {
        id: 'text', icon: 'text', title: T('Texte [[Y]]', 'Text [[Y]]'),
        body: [
          p('Cliquez sur le dessin à l\'endroit du texte : une fenêtre s\'ouvre avec un aperçu. Le texte est posé en **couleur A**, comme un collage : déplacez-le, puis validez avec [[Entrée]] (ou annulez avec [[Échap]]).',
            'Click on the drawing where the text should go: a window opens with a preview. The text is placed in **color A**, like a paste: move it, then confirm with [[Enter]] (or cancel with [[Esc]]).'),
          list(
            ['**Polices pixel** : Classique 5×7 (majuscules, minuscules, accents du français) et Petite 3×5 (majuscules seulement, pour les très petits dessins).', '**Pixel fonts**: Classic 5×7 (upper and lower case, French accents) and Small 3×5 (upper case only, for very small drawings).'],
            ['**Taille ×** agrandit les pixels des lettres, **Espacement** écarte les lettres, plusieurs lignes possibles avec alignement à gauche, centré ou à droite.', '**Size ×** enlarges the letters\' pixels, **Spacing** spreads letters apart, several lines allowed with left, center or right alignment.'],
            ['**Contour (couleur B)** : un liseré d\'un pixel autour des lettres, pour un titre lisible sur n\'importe quel fond (stream, miniatures).', '**Outline (color B)**: a one-pixel border around the letters, for a title readable on any background (streams, thumbnails).'],
          ),
          go('tool:text', 'Prendre l\'outil Texte', 'Pick the Text tool'),
        ],
      },
      {
        id: 'common', icon: 'sliders', title: T('Options communes', 'Common options'),
        body: [
          list(
            ['**Tramage** [[D]] : peint avec un motif (damier, lignes, points…). « A + vide » alterne couleur et transparence, « A + B » alterne les deux couleurs.',
              '**Dithering** [[D]]: paints with a pattern (checker, lines, dots…). "A + empty" alternates color and transparency, "A + B" alternates both colors.'],
            ['**Symétrie** [[S]] : ⇆ gauche/droite, ⇅ haut/bas, ✛ les deux. Les axes s\'affichent sur le dessin. Parfait pour un visage de face.',
              '**Symmetry** [[S]]: ⇆ left/right, ⇅ top/bottom, ✛ both. Axes are shown on the drawing. Perfect for a front-facing face.'],
            ['**Dessin enroulé** (mode tuiles) : un trait qui sort d\'un bord revient par l\'autre.', '**Wrapped drawing** (tile mode): a stroke leaving one edge comes back on the other.'],
            ['[[X]] échange les couleurs A et B.', '[[X]] swaps colors A and B.'],
            ['**Pinceau personnalisé** ✿ : sélectionnez un motif (herbe, brique, étoile… 64 × 64 au plus), puis bouton **Utiliser comme pinceau** de la barre d\'options. Le crayon et la gomme le déposent le long du trait, en **couleur A** ou avec ses **couleurs d\'origine**.', '**Custom brush** ✿: select a pattern (grass, brick, star… 64 × 64 at most), then the **Use as brush** button in the options bar. The pencil and eraser stamp it along the stroke, in **color A** or with its **original colors**.'],
            ['**Pression** (crayon, gomme, ombrage) : avec un stylet, appuyer fort donne la taille choisie, effleurer donne 1 pixel.', '**Pressure** (pencil, eraser, shading): with a stylus, pressing hard gives the chosen size, a light touch gives 1 pixel.'],
          ),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'select', icon: 'select', title: T('Sélection et transformation', 'Selection and transform'),
    intro: T('Sélectionner une partie du dessin pour la déplacer, la copier, la retourner ou la faire tourner. Les fourmis (pointillés animés) montrent la sélection.',
      'Select part of the drawing to move, copy, flip or rotate it. Marching ants show the selection.'),
    sections: [
      {
        id: 'select-tools', icon: 'select', title: T('Rectangle [[M]], lasso [[Q]], baguette magique [[W]]', 'Rectangle [[M]], lasso [[Q]], magic wand [[W]]'),
        body: [
          list(
            ['**Rectangle** : glisser pour encadrer. **Lasso** : dessiner le contour à main levée. **Baguette** : clic sur une couleur pour sélectionner la zone.', '**Rectangle**: drag to frame. **Lasso**: draw the outline freehand. **Wand**: click a color to select its area.'],
            ['Modes : **Nouvelle**, **+ Ajouter**, **− Retirer** (pour combiner plusieurs sélections).', 'Modes: **New**, **+ Add**, **− Subtract** (to combine selections).'],
            ['Baguette : **Contigu** ou **Même couleur partout** ; **Image visible** pour se baser sur tous les calques.', 'Wand: **Contiguous** or **Same color everywhere**; **Visible image** to use all layers.'],
            ['Une sélection limite le crayon, le remplissage, le dégradé et la gomme à son intérieur.', 'A selection limits the pencil, fill, gradient and eraser to its inside.'],
          ),
          keys(['Ctrl+A', 'Tout sélectionner', 'Select all'], ['Ctrl+D / Échap', 'Désélectionner', 'Deselect'], ['Ctrl+Maj+I', 'Inverser la sélection', 'Invert selection'], ['Suppr', 'Effacer la sélection', 'Clear selection']),
          go('tool:select', 'Prendre la sélection rectangle', 'Use rectangle select'),
        ],
      },
      {
        id: 'move', icon: 'move', title: T('Déplacer [[V]] et main [[H]]', 'Move [[V]] and hand [[H]]'),
        body: [
          list(
            ['**Déplacer** : glisse la sélection (ou tout le calque s\'il n\'y a pas de sélection). Avec [[Ctrl]] ou [[Alt]], c\'est une **copie** qui se déplace.',
              '**Move**: drags the selection (or the whole layer if nothing is selected). With [[Ctrl]] or [[Alt]], a **copy** is moved.'],
            ['Le contenu déplacé « flotte » au-dessus du calque jusqu\'à **Valider** ([[Entrée]]) ; [[Échap]] annule.', 'Moved content "floats" above the layer until you **Confirm** ([[Enter]]); [[Esc]] cancels.'],
            ['Les **flèches** déplacent de 1 pixel, [[Maj]] + flèches de 8.', '**Arrow keys** move by 1 pixel, [[Shift]] + arrows by 8.'],
            ['Sur un calque de référence, Déplacer fait glisser l\'image de référence.', 'On a reference layer, Move drags the reference image.'],
            ['**Main** : déplace seulement la vue.', '**Hand**: only pans the view.'],
          ),
          go('tool:move', 'Prendre l\'outil Déplacer', 'Use the Move tool'),
        ],
      },
      {
        id: 'transform', icon: 'transform', title: T('Retourner, tourner, mettre à l\'échelle', 'Flip, rotate, scale'),
        body: [
          list(
            ['Miroir horizontal [[Maj+H]], vertical [[Maj+V]], rotation 90° [[Maj+R]] : boutons dans la barre d\'options des outils de sélection.', 'Horizontal flip [[Shift+H]], vertical [[Shift+V]], 90° rotation [[Shift+R]]: buttons in the selection tools options bar.'],
            ['**Rotation libre / échelle** [[Ctrl+T]] : curseurs d\'angle, de largeur et de hauteur, angles rapides (−90° à 90°), proportions liées, et **Lissage pixel art** (rotation de type RotSprite qui évite les pixels cassés).',
              '**Free rotate / scale** [[Ctrl+T]]: angle, width and height sliders, quick angles (−90° to 90°), linked proportions and **Pixel art smoothing** (RotSprite-like rotation that avoids broken pixels).'],
            ['**Copier** [[Ctrl+C]], **Couper** [[Ctrl+X]], **Coller** [[Ctrl+V]]. Une image copiée depuis un autre logiciel se colle aussi.', '**Copy** [[Ctrl+C]], **Cut** [[Ctrl+X]], **Paste** [[Ctrl+V]]. An image copied from another app can be pasted too.'],
            ['Menu ☰ > **Recadrer sur la sélection** réduit l\'image à la sélection.', '☰ menu > **Crop to selection** shrinks the image to the selection.'],
          ),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'colors', icon: 'palette', title: T('Couleurs et palettes', 'Colors and palettes'),
    intro: T('Deux couleurs sont actives : **A** (clic gauche) et **B** (clic droit). Elles apparaissent en bas de la barre d\'outils.',
      'Two colors are active: **A** (left click) and **B** (right click). They are shown at the bottom of the toolbar.'),
    sections: [
      {
        id: 'pick', title: T('Choisir une couleur', 'Picking a color'),
        body: [
          list(
            ['Dans la palette : clic = A, clic droit ou appui long = B.', 'In the palette: click = A, right click or long press = B.'],
            ['Clic sur les pastilles A / B (barre d\'outils) ou **Sélecteur avancé** : teinte, saturation, luminosité et code hexadécimal.', 'Click the A / B swatches (toolbar) or **Advanced picker**: hue, saturation, brightness and hex code.'],
            ['**Récentes** : les dernières couleurs utilisées.', '**Recent**: the last colors used.'],
            ['[[X]] échange A et B.', '[[X]] swaps A and B.'],
          ),
          go('panel:colors', 'Ouvrir le panneau Couleurs', 'Open the Colors panel'),
        ],
      },
      {
        id: 'palettes', title: T('Gérer les palettes', 'Managing palettes'),
        body: [
          list(
            ['**Charger une palette** : palettes prédéfinies (PICO-8, Endesga 32, Game Boy, Sweetie 16, peaux et cheveux…).', '**Load a palette**: built-in palettes (PICO-8, Endesga 32, Game Boy, Sweetie 16, skin and hair…).'],
            ['**+ Ajouter A** ajoute la couleur A ; menu ⋯ : retirer, trier par teinte, vider, **extraire une palette** depuis une image ou depuis le dessin.', '**+ Add A** adds color A; ⋯ menu: remove, sort by hue, clear, **extract a palette** from an image or from the drawing.'],
            ['Import et export : .hex, .gpl (GIMP, Aseprite), .json, .pal.', 'Import and export: .hex, .gpl (GIMP, Aseprite), .json, .pal.'],
            ['**Remplacer une couleur** (menu ☰ > Image) : change une couleur partout, sur un ou tous les calques.', '**Replace a color** (☰ menu > Image): changes a color everywhere, on one or all layers.'],
          ),
        ],
      },
      {
        id: 'ramps', icon: 'palette', title: T('Rampes, palette liée et lisibilité', 'Ramps, linked palette and readability'),
        body: [
          list(
            ['**Générer une rampe de couleurs** (menu ⋯ de la palette) : à partir d\'une couleur, 3 à 9 teintes de l\'ombre à la lumière. Les ombres glissent vers le bleu-violet, les lumières vers le jaune (« hue shifting ») : des couleurs vivantes plutôt que grisâtres. Réglez le nombre de teintes, le glissement et le contraste, puis ajoutez la rampe ou remplacez la palette.', '**Generate a color ramp** (palette ⋯ menu): from one color, 3 to 9 shades from shadow to light. Shadows drift toward blue-violet, lights toward yellow (hue shifting): lively colors instead of greyish ones. Set the number of shades, the drift and the contrast, then add the ramp or replace the palette.'],
            ['**Palette liée** : **double-cliquez** une couleur de la palette (ou menu ⋯ > **Modifier la couleur A**). Avec « Recolorer le dessin », tous les pixels de cette couleur changent **en direct** pendant que vous choisissez ; Valider = une seule étape à annuler. Idéal pour essayer une autre couleur de cheveux ou de tenue.', '**Linked palette**: **double-click** a palette color (or ⋯ menu > **Edit color A**). With "Recolor the drawing", every pixel of that color changes **live** while you pick; Confirm = a single undo step. Ideal to try another hair or outfit color.'],
            ['**Vérifier les valeurs** et **Vérifier la silhouette** (menu ☰ > Affichage) : le dessin s\'affiche en niveaux de gris (les formes se lisent-elles sans la couleur ?) ou en silhouette noire (la pose se reconnaît-elle ?). Rien n\'est modifié ; même entrée pour revenir aux couleurs.', '**Check values** and **Check silhouette** (☰ menu > Display): the drawing is shown in grayscale (do shapes read without color?) or as a black silhouette (is the pose recognizable?). Nothing is changed; same entry to go back to colors.'],
          ),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'layers', icon: 'layers', title: T('Calques, groupes et variantes', 'Layers, groups and variants'),
    intro: T('Les calques sont des feuilles transparentes empilées : on peut dessiner chaque partie séparément, puis les montrer, cacher ou réorganiser.',
      'Layers are stacked transparent sheets: draw each part separately, then show, hide or reorder them.'),
    sections: [
      {
        id: 'basics', title: T('Les bases', 'Basics'),
        body: [
          list(
            ['Boutons du panneau : nouveau calque [[Ctrl+Maj+N]], nouveau groupe, nouveau groupe de variantes, dupliquer [[Ctrl+J]], fusionner vers le bas [[Ctrl+E]], monter, descendre, supprimer.', 'Panel buttons: new layer [[Ctrl+Shift+N]], new group, new variant group, duplicate [[Ctrl+J]], merge down [[Ctrl+E]], move up, move down, delete.'],
            ['👁 masque / affiche, 🔒 verrouille (empêche de dessiner dessus). Double-clic ou [[F2]] pour renommer.', '👁 hides / shows, 🔒 locks (prevents drawing). Double-click or [[F2]] to rename.'],
            ['Glisser la poignée ⋮⋮ pour réorganiser ou ranger un calque dans un groupe.', 'Drag the ⋮⋮ handle to reorder or put a layer in a group.'],
            ['**Opacité** du calque actif sous la liste. [[Alt+↑]] / [[Alt+↓]] change de calque actif.', 'Active layer **opacity** below the list. [[Alt+↑]] / [[Alt+↓]] change the active layer.'],
            ['**Sélection multiple** (✓, ou [[Ctrl]]/[[Maj]] + clic) : grouper, dupliquer, masquer, fusionner ou supprimer plusieurs calques d\'un coup.', '**Multi-select** (✓, or [[Ctrl]]/[[Shift]] + click): group, duplicate, hide, merge or delete several layers at once.'],
            ['Menu ⋯ : effacer le contenu, aplatir un groupe, ajouter à ma bibliothèque, importer une image…', '⋯ menu: clear content, flatten a group, add to my library, import an image…'],
          ),
          go('panel:layers', 'Ouvrir le panneau Calques', 'Open the Layers panel'),
        ],
      },
      {
        id: 'variants', icon: 'variants', title: T('Groupes de variantes', 'Variant groups'),
        body: [
          p('Un groupe de variantes n\'affiche **qu\'un seul** de ses calques à la fois : les yeux ouverts / fermés / contents, les bouches, les tenues… On choisit la variante active avec le bouton rond, la barre de variantes sur le dessin, ou [[Tab]].',
            'A variant group shows **only one** of its layers at a time: open / closed / happy eyes, mouths, outfits… Pick the active variant with the round button, the variant bar on the drawing, or [[Tab]].'),
          tip('Les variantes sont la base des expressions et du mode PNGtuber.', 'Variants are the basis of expressions and PNGtuber mode.'),
        ],
      },
      {
        id: 'blend', icon: 'layers', title: T('Fusion, écrêtage et verrou de transparence', 'Blending, clipping and transparency lock'),
        body: [
          p('Dans les propriétés du calque actif (sous la liste) :', 'In the active layer\'s properties (below the list):'),
          list(
            ['**Fusion** : comment le calque se mélange à ce qui est dessous. **Produit** assombrit (ombres), **Écran** et **Addition** éclaircissent (lumières, lueurs), **Incrustation** et **Lumière tamisée** renforcent le contraste, **Différence** inverse… Normal par défaut.', '**Blend**: how the layer mixes with what is below. **Multiply** darkens (shadows), **Screen** and **Add** lighten (highlights, glows), **Overlay** and **Soft light** boost contrast, **Difference** inverts… Normal by default.'],
            ['**Écrêter sur le calque du dessous** : le calque n\'apparaît que sur les pixels du calque juste en dessous (badge ↳). Idéal pour poser des ombres ou un motif sur un vêtement sans déborder, en gardant le dessin d\'origine intact. Le calque de base décide de la visibilité, de l\'opacité et du mode de l\'ensemble.', '**Clip to the layer below**: the layer only shows on the pixels of the layer just below (↳ badge). Ideal for shading or patterning a garment without spilling over, keeping the original drawing intact. The base layer sets the visibility, opacity and mode of the whole.'],
            ['**Verrouiller la transparence** (badge ▦) : tous les outils ne peignent que sur les pixels déjà dessinés, sans changer leur transparence ; la gomme n\'efface plus. Parfait pour recolorer ou ombrer une forme.', '**Lock transparency** (▦ badge): every tool paints only over pixels already drawn, without changing their transparency; the eraser no longer erases. Perfect for recoloring or shading a shape.'],
            ['Ces réglages s\'annulent, sont pris en compte par l\'export, la fusion de calques, l\'aplatissement et l\'export Photoshop (PSD) ; les modes de fusion des fichiers Aseprite sont repris à l\'import.', 'These settings can be undone and are honored by export, merging, flattening and Photoshop (PSD) export; Aseprite blend modes are kept on import.'],
          ),
        ],
      },
      {
        id: 'reference', icon: 'ref', title: T('Calque de référence', 'Reference layer'),
        body: [
          p('Menu ☰ > **Importer une image de référence** : l\'image s\'affiche nette, en pleine résolution et semi-transparente, pour décalquer ou s\'inspirer. Elle n\'est **jamais exportée**. Déplacez-la avec l\'outil Déplacer, réglez sa taille et son opacité dans le panneau Calques.',
            '☰ menu > **Import a reference image**: the image is shown crisp, at full resolution and semi-transparent, to trace or for inspiration. It is **never exported**. Move it with the Move tool, set its size and opacity in the Layers panel.'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'image', icon: 'crop', title: T('Image et canevas', 'Image and canvas'),
    intro: T('Les opérations sur toute l\'image se trouvent dans le menu ☰ > Image. Toutes s\'annulent.', 'Whole-image operations are in the ☰ menu > Image. All of them can be undone.'),
    sections: [
      {
        id: 'size', title: T('Taille, recadrage, orientation', 'Size, crop, orientation'),
        body: [
          list(
            ['**Taille de l\'image / du canevas** : agrandir le canevas (avec un point d\'ancrage) ou mettre l\'image à l\'échelle (au plus proche voisin, sans flou).', '**Image / canvas size**: enlarge the canvas (with an anchor point) or scale the image (nearest neighbour, no blur).'],
            ['**Recadrer** sur la sélection ou sur le contenu (retire les bords vides).', '**Crop** to the selection or to the content (removes empty borders).'],
            ['**Miroir** horizontal ou vertical, **rotation** de 90°.', 'Horizontal or vertical **flip**, 90° **rotation**.'],
          ),
        ],
      },
      {
        id: 'effects', icon: 'outline', title: T('Remplacer une couleur et contour automatique', 'Replace a color and automatic outline'),
        body: [
          list(
            ['**Remplacer une couleur** : choisissez l\'ancienne et la nouvelle couleur, sur le calque actif ou tous les calques.', '**Replace a color**: choose the old and new color, on the active layer or all layers.'],
            ['**Contour automatique** : ajoute un contour de la couleur A autour du dessin du calque (à l\'extérieur ou sur le bord intérieur, avec ou sans les coins).', '**Automatic outline**: adds an outline in color A around the layer drawing (outside or on the inner edge, with or without corners).'],
          ),
          go('action:outlineDialog', 'Contour automatique…', 'Automatic outline…'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'grid', icon: 'grid', title: T('Grille et mode tuiles', 'Grid and tile mode'),
    intro: T('La grille aide à construire des sprites réguliers ; le mode tuiles sert à dessiner des motifs qui se répètent sans couture.', 'The grid helps build regular sprites; tile mode is for drawing seamless repeating patterns.'),
    sections: [
      {
        id: 'grid', title: T('Grille', 'Grid'),
        body: [
          list(
            ['[[#]] ou le bouton grille l\'affiche. Panneau **Grille** : largeur et hauteur des cellules, décalage, lignes principales toutes les N cellules, couleurs et épaisseurs.', '[[#]] or the grid button shows it. **Grid** panel: cell width and height, offset, major lines every N cells, colors and thickness.'],
            ['**Aimanter** : lignes, rectangles, ellipses, sélections et déplacements s\'alignent sur les cellules.', '**Snap**: lines, rectangles, ellipses, selections and moves align to cells.'],
            ['**Grille de pixels** au fort zoom (Paramètres > Affichage).', '**Pixel grid** at high zoom (Settings > Display).'],
          ),
          go('panel:grid', 'Ouvrir le panneau Grille', 'Open the Grid panel'),
        ],
      },
      {
        id: 'tiles', icon: 'tiles', title: T('Mode tuiles [[T]]', 'Tile mode [[T]]'),
        body: [
          p('Le dessin est répété tout autour pour voir le raccord. Avec **Dessin enroulé**, un trait qui dépasse un bord continue de l\'autre côté. Exportez ensuite une **planche de tuiles** depuis la fenêtre d\'export.',
            'The drawing is repeated all around to check the seam. With **Wrapped drawing**, a stroke crossing an edge continues on the other side. Then export a **tile sheet** from the export window.'),
        ],
      },
      {
        id: 'tilemap', icon: 'grid', title: T('Carte de tuiles (tilemap)', 'Tile map'),
        body: [
          p('Menu ☰ > **Carte de tuiles** : votre dessin, découpé selon la grille (16 × 16 par défaut), devient un **jeu de tuiles** ; vous peignez une carte (niveau de jeu, décor) avec ces tuiles. La carte est enregistrée dans le projet.',
            '☰ menu > **Tile map**: your drawing, cut along the grid (16 × 16 by default), becomes a **tileset**; you paint a map (game level, scenery) with these tiles. The map is saved in the project.'),
          list(
            ['Cliquez une tuile à gauche, puis peignez à droite. **Maj + clic** sur d\'autres tuiles : le pinceau en pose une **au hasard** (herbe, sol, briques variés).', 'Click a tile on the left, then paint on the right. **Shift + click** other tiles: the brush places one **at random** (varied grass, ground, bricks).'],
            ['Outils : **pinceau**, **rectangle**, **pot** (remplit une zone), **gomme** (ou clic droit), **pipette** (ou [[Alt]] + clic). [[Ctrl+Z]] annule.', 'Tools: **brush**, **rectangle**, **bucket** (fills an area), **eraser** (or right click), **picker** (or [[Alt]] + click). [[Ctrl+Z]] undoes.'],
            ['Taille de la carte (colonnes × lignes) et des tuiles réglables ; plusieurs cartes par projet.', 'Map size (columns × rows) and tile size are adjustable; several maps per project.'],
            ['Modifiez le dessin : la carte se met à jour aussitôt (pratique avec le **mode tuiles** [[T]] pour les raccords).', 'Edit the drawing: the map updates at once (handy with **tile mode** [[T]] for seams).'],
            ['Export **PNG** de la carte, ou **Tiled (ZIP)** : carte .tmj et jeu de tuiles .png, à ouvrir dans Tiled, Godot, GameMaker, Unity…', 'Export the map as **PNG**, or **Tiled (ZIP)**: .tmj map and .png tileset, to open in Tiled, Godot, GameMaker, Unity…'],
            ['**Tuiles retournées** : boutons ⇆ et ⇅ avant de peindre (la pipette reprend aussi le retournement). Une seule tuile de coin ou de bord suffit pour les quatre côtés.', '**Flipped tiles**: ⇆ and ⇅ buttons before painting (the picker also picks up the flip). A single corner or edge tile is enough for all four sides.'],
            ['**Tuiles animées** : si le dessin a plusieurs images d\'animation, chaque tuile s\'anime avec elles (eau, torches, herbe qui ondule). Bouton ▶ pour voir la carte bouger, export **GIF**, et l\'export Tiled contient les animations de tuiles.', '**Animated tiles**: if the drawing has several animation frames, every tile animates with them (water, torches, waving grass). ▶ button to see the map move, **GIF** export, and the Tiled export contains the tile animations.'],
          ),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'anim', icon: 'film', title: T('Animation', 'Animation'),
    intro: T('Menu ☰ > **Animation (timeline)** ouvre la frise des images en bas de l\'écran.', '☰ menu > **Animation (timeline)** opens the frame strip at the bottom of the screen.'),
    sections: [
      {
        id: 'frames', title: T('Images et lecture', 'Frames and playback'),
        body: [
          list(
            ['Boutons : nouvelle image vide, dupliquer l\'image, **image liée** (mêmes pixels, modifiés ensemble), délier, déplacer, supprimer.', 'Buttons: new empty frame, duplicate frame, **linked frame** (same pixels, edited together), unlink, move, delete.'],
            ['▶ lit l\'animation en boucle ; **FPS** règle la vitesse. Double-clic sur une image : sa durée propre (ms).', '▶ plays the animation in a loop; **FPS** sets the speed. Double-click a frame: its own duration (ms).'],
            ['**Onion skin** [[N]] : affiche en transparence l\'image précédente et la suivante pour dessiner le mouvement.', '**Onion skin** [[N]]: shows the previous and next frames faintly to draw motion.'],
          ),
          go('timeline', 'Ouvrir la timeline', 'Open the timeline'),
        ],
      },
      {
        id: 'tags', title: T('Balises', 'Tags'),
        body: [
          p('[[Maj]] + clic sur les images pour choisir une plage, puis **Nouvelle balise** (ex. « Marche », « Saut »). Cliquer sur une balise la lit en boucle. Les exports GIF, planche et images peuvent produire **une animation par balise**.',
            '[[Shift]] + click frames to choose a range, then **New tag** (e.g. "Walk", "Jump"). Clicking a tag loops it. GIF, sheet and frame exports can produce **one animation per tag**.'),
        ],
      },
      {
        id: 'animate', title: T('Animer un calque (interpolation et boucles)', 'Animate a layer (tweening and loops)'),
        body: [
          p('Bouton ✨ de la timeline (ou menu ☰ > **Animer le calque**) : le contenu du calque actif, à l\'image courante, est animé automatiquement sur les images suivantes (créées si besoin). Les autres calques restent en place (images liées). Aperçu animé avant de valider, une seule étape à annuler.',
            '✨ button in the timeline (or ☰ menu > **Animate the layer**): the active layer\'s content, at the current frame, is animated automatically over the next frames (created if needed). Other layers stay in place (linked frames). Animated preview before confirming, a single undo step.'),
          list(
            ['**Déplacement (de A à B)** : interpolation vers la droite / le bas, avec mouvement constant, qui accélère, ralentit, ou rebondit à l\'arrivée ; « Aller-retour » pour une boucle.', '**Move (A to B)**: tween to the right / down, with constant motion, ease in, ease out, or bounce on arrival; "Back and forth" for a loop.'],
            ['**Flottement**, **Respiration** (le haut du personnage s\'abaisse doucement), **Tremblement** : boucles prêtes à l\'emploi, réglez l\'amplitude en pixels.', '**Float**, **Breathe** (the top of the character gently lowers), **Shake**: ready-made loops, set the amplitude in pixels.'],
            ['**Clignotement**, **Apparition** et **Disparition** en fondu tramé (pixel par pixel, sans transparence floue).', '**Blink**, **Fade in** and **Fade out** with a dithered fade (pixel by pixel, no blurry transparency).'],
          ),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'library', icon: 'book', title: T('Bibliothèque et personnages', 'Library and characters'),
    intro: T('Plus de 150 pièces originales à assembler : corps, têtes, coiffures, yeux, sourcils, nez, bouches, vêtements, accessoires, mains. Tout reste modifiable pixel par pixel.',
      'More than 150 original parts to assemble: bodies, heads, hair, eyes, brows, noses, mouths, clothes, accessories, hands. Everything stays editable pixel by pixel.'),
    sections: [
      {
        id: 'newchar', icon: 'user', title: T('Nouveau personnage', 'New character'),
        body: [
          steps(
            ['Menu ☰ > **Nouveau personnage**.', '☰ menu > **New character**.'],
            ['Choisissez la **vue** : **De face** (style mignon), **3/4** (style portrait adulte, gros pixels) ou **Portrait détaillé** (grande tête de 3/4, barbe, chignon, cou ombré, au pixel près).', 'Choose the **view**: **Front** (cute style), **3/4** (adult portrait style, chunky pixels) or **Detailed portrait** (large 3/4 head, beard, bun, shaded neck, pixel-precise).'],
            ['Le **Portrait détaillé** a ses propres pièces : 9 coiffures (chignon, queue de cheval, carré, bouclée, longue à frange…), barbes, yeux à cils, sourcils épais ou fins, bouche à lèvres, 7 hauts (t-shirt, chemise, débardeur, col roulé…), lunettes, casquette, bonnet, **casque micro**, boucles d\'oreilles, collier, taches de rousseur…', 'The **Detailed portrait** has its own parts: 9 hairstyles (bun, ponytail, bob, curly, long with bangs…), beards, eyes with lashes, thick or thin brows, mouth with lips, 7 tops (t-shirt, shirt, tank top, turtleneck…), glasses, cap, beanie, **headset with mic**, earrings, necklace, freckles…'],
            ['Pour les vues de profil, choisissez l\'**orientation** : **vers la gauche** ou **vers la droite** (les pièces sont retournées en miroir).', 'For profile views, choose the **facing**: **left** or **right** (parts are mirrored).'],
            ['Réglez les 5 couleurs (peau, cheveux, yeux, vêtements, accessoires) et chaque pièce, ou 🎲 **Au hasard**.', 'Set the 5 colors (skin, hair, eyes, clothes, accessories) and each part, or 🎲 **Random**.'],
            ['**Créer le personnage** : yeux, bouche et sourcils sont des groupes de variantes, avec 7 expressions prêtes (Neutre, Parle, Content, Triste, Surpris, Fâché, Yeux fermés) sur les touches [[1]] à [[7]].', '**Create the character**: eyes, mouth and brows are variant groups, with 7 ready expressions (Neutral, Talking, Happy, Sad, Surprised, Angry, Eyes closed) on keys [[1]] to [[7]].'],
          ),
          tip('« Gabarit détaillé ×2 » double la taille (128×128) avec des diagonales lissées. Les corps entiers agrandissent la hauteur du canevas.', '"Detailed template ×2" doubles the size (128×128) with smoothed diagonals. Full bodies enlarge the canvas height.'),
          go('action:newCharacter', 'Nouveau personnage…', 'New character…'),
        ],
      },
      {
        id: 'parts', icon: 'book', title: T('Ajouter des pièces', 'Adding parts'),
        body: [
          list(
            ['Bouton **Bibliothèque** (ou « Pièces » sur téléphone) : catégories, **Vue** (de face / 3/4), **recherche** et ★ **favoris**.', '**Library** button (or "Parts" on phones): categories, **View** (front / 3/4), **search** and ★ **favorites**.'],
            ['Un clic ajoute la pièce comme calque ou groupe de variantes, à la bonne place dans l\'empilement. **Remplacer la pièce existante** échange par exemple une coiffure contre une autre.', 'One click adds the part as a layer or variant group, at the right place in the stack. **Replace existing part** swaps for example one hairstyle for another.'],
            ['Changer les couleurs en haut de la fenêtre **recolore aussi le personnage** déjà en place (menu ☰ > Recolorer le personnage pour le faire à part).', 'Changing the colors at the top of the window **also recolors the character** already in place (☰ menu > Recolor character to do it separately).'],
            ['Les vêtements s\'ajustent automatiquement au corps choisi (fin, moyen, costaud, rond…).', 'Clothes automatically fit the chosen body (slim, medium, stocky, round…).'],
            ['**Bas et chaussures** (corps entiers) : pantalon, jean à revers, bermuda, jupe, jupe longue, salopette, et baskets, bottes ou sandales, en couleur d\'accent. On peut porter un bas et des chaussures ensemble ; sur un buste, le corps passe automatiquement en corps entier. Aussi proposés dans « Nouveau personnage » (et par 🎲 Au hasard).', '**Bottoms and shoes** (full bodies): trousers, cuffed jeans, Bermuda shorts, skirt, long skirt, dungarees, and sneakers, boots or sandals, in the accent color. A bottom and shoes can be worn together; on a bust, the body switches to a full body automatically. Also offered in "New character" (and by 🎲 Random).'],
            ['**Orientation** (vues 3/4 et Portrait détaillé) : ◀ **Vers la gauche** / **Vers la droite** ▶. Changer de sens retourne tout le personnage en place (annulable) ; les pièces ajoutées ensuite suivent le même sens.', '**Facing** (3/4 and Detailed portrait views): ◀ **Facing left** / **Facing right** ▶. Switching mirrors the whole character in place (undoable); parts added afterwards follow the same direction.'],
          ),
          go('action:openLibrary', 'Ouvrir la bibliothèque', 'Open the library'),
        ],
      },
      {
        id: 'mylib', icon: 'star', title: T('Ma bibliothèque', 'My library'),
        body: [
          p('Gardez vos propres pièces : panneau Calques > ⋯ > **Ajouter à ma bibliothèque** (calque ou groupe entier, variantes comprises). Retrouvez-les dans l\'onglet ★ Ma bibliothèque, renommez-les, exportez-les ou importez celles d\'un autre appareil.',
            'Keep your own parts: Layers panel > ⋯ > **Add to my library** (layer or whole group, variants included). Find them in the ★ My library tab, rename, export them or import those from another device.'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'expr', icon: 'face', title: T('Expressions et profils', 'Expressions and profiles'),
    intro: T('Onglet **Expressions** : changer de variante d\'un clic, mémoriser des expressions et des profils (tenues, personnages).', '**Expressions** tab: switch variants in one click, save expressions and profiles (outfits, characters).'),
    sections: [
      {
        id: 'expressions', icon: 'face', title: T('Expressions', 'Expressions'),
        body: [
          list(
            ['Une expression mémorise la variante choisie dans chaque groupe (ex. « Content » = yeux contents + bouche souriante + sourcils hauts).', 'An expression stores the chosen variant of each group (e.g. "Happy" = happy eyes + smiling mouth + raised brows).'],
            ['Réglez les variantes, puis **Enregistrer l\'expression actuelle**. Un clic sur son nom l\'applique.', 'Set the variants, then **Save current expression**. Click its name to apply it.'],
            ['Menu ⋯ : mettre à jour, renommer, **associer une touche** (lettre, chiffre ou combinaison comme [[Ctrl+Maj+1]]), monter, descendre, supprimer.', '⋯ menu: update, rename, **assign a key** (letter, digit or a combination like [[Ctrl+Shift+1]]), move up, move down, delete.'],
            ['**Temporaire** : l\'expression ne dure que tant que la touche est maintenue (ex. maintenir S pour « Surpris »).', '**Temporary**: the expression only lasts while the key is held (e.g. hold S for "Surprised").'],
          ),
          go('panel:expressions', 'Ouvrir l\'onglet Expressions', 'Open the Expressions tab'),
        ],
      },
      {
        id: 'profiles', icon: 'user', title: T('Profils (F13 à F24)', 'Profiles (F13 to F24)'),
        body: [
          p('Un profil mémorise les calques visibles, les variantes et les réglages bouche/yeux du PNGtuber. Exemple : un même projet avec une tenue d\'été et une tenue d\'hiver, ou deux personnages.',
            'A profile stores visible layers, variants and the PNGtuber mouth/eye settings. Example: one project with a summer and a winter outfit, or two characters.'),
          steps(
            ['Montrez / cachez les calques de la tenue voulue.', 'Show / hide the layers of the outfit you want.'],
            ['**Enregistrer l\'état actuel comme profil**, puis choisissez sa touche de **F13** à **F24**.', '**Save current state as profile**, then pick its key from **F13** to **F24**.'],
            ['Appuyez sur la touche dans l\'éditeur, le mode PNGtuber, la fenêtre de capture ou l\'avatar OBS.', 'Press the key in the editor, PNGtuber mode, the capture window or the OBS avatar.'],
          ),
          tip('Les touches F13 à F24 n\'existent pas sur la plupart des claviers : programmez-les sur un Stream Deck ou avec un logiciel de macros. La fenêtre qui reçoit la touche doit avoir le focus.', 'Keys F13 to F24 do not exist on most keyboards: assign them on a Stream Deck or with macro software. The window receiving the key must have focus.'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'pngtuber', icon: 'tv', title: T('Mode PNGtuber et diffusion', 'PNGtuber mode and streaming'),
    intro: T('Votre personnage s\'anime avec votre voix : la bouche s\'ouvre quand vous parlez, les yeux clignent, les touches changent d\'expression.', 'Your character comes alive with your voice: the mouth opens when you speak, the eyes blink, keys change expressions.'),
    sections: [
      {
        id: 'pt-use', icon: 'mic', title: T('Utiliser le mode PNGtuber', 'Using PNGtuber mode'),
        body: [
          list(
            ['Bouton **Mode PNGtuber** (écran) en haut. **Activer le micro** : le son est analysé uniquement sur votre appareil, rien n\'est enregistré ni envoyé.', '**PNGtuber mode** button (screen) at the top. **Enable microphone**: sound is analyzed only on your device, nothing is recorded or sent.'],
            ['**Seuil de parole** et **grande ouverture** : la jauge montre votre volume (rose = parole, violet = bouche grande ouverte). Sans micro : **Maintenir pour parler** ou [[Espace]].', '**Talk threshold** and **wide open**: the meter shows your volume (pink = talking, purple = wide open mouth). Without a mic: **Hold to talk** or [[Space]].'],
            ['**Bouche** : variantes fermée / entrouverte / ouverte. **Yeux** : ouverts / fermés et fréquence du clignement.', '**Mouth**: closed / half-open / open variants. **Eyes**: open / closed and blink rate.'],
            ['**Animations** : rebond et inclinaison en parlant, respiration au repos, secousse quand on crie.', '**Animations**: bounce and tilt while talking, breathing at rest, shake when shouting.'],
            ['Fond : vert, bleu, magenta (pour l\'incrustation), noir, blanc, damier ou une image.', 'Background: green, blue, magenta (for chroma key), black, white, checker or an image.'],
            ['Touches d\'expressions ([[1]]–[[7]]…) et de profils ([[F13]]–[[F24]]) actives.', 'Expression keys ([[1]]–[[7]]…) and profile keys ([[F13]]–[[F24]]) work.'],
          ),
          go('action:openPngtuber', 'Ouvrir le mode PNGtuber', 'Open PNGtuber mode'),
        ],
      },
      {
        id: 'effects', icon: 'star', title: T('Effets et décors', 'Effects and scenes'),
        body: [
          p('Section **Effets** du mode PNGtuber : 23 effets en gros pixels, alignés sur ceux du personnage.', '**Effects** section of PNGtuber mode: 23 chunky-pixel effects, aligned with the character\'s pixels.'),
          list(
            ['**Ponctuels** : confettis (lancés des deux côtés, ils retombent sur l\'avatar), cœurs, étincelles, feu d\'artifice, étoiles filantes, impact (flash, zoom, secousse), point d\'exclamation, point d\'interrogation, goutte de gêne, veine de colère, larmes, lignes de choc, Zzz. Cliquez sur ▶ ou associez une **touche** (bouton « Touche… » ; Retour arrière pour la retirer).',
              '**One-shot**: confetti (launched from both sides, they rain down on the avatar), hearts, sparkles, fireworks, shooting stars, impact (flash, zoom, shake), exclamation mark, question mark, sweat drop, anger vein, tears, speed lines, Zzz. Click ▶ or assign a **key** ("Key…" button; Backspace removes it).'],
            ['**Ambiance en continu** : neige, pluie, pétales, lucioles, bulles, flammes. Si un profil est actif, l\'ambiance est propre à ce profil (ex. neige pour la tenue d\'hiver).', '**Continuous ambience**: snow, rain, petals, fireflies, bubbles, flames. When a profile is active, the ambience belongs to that profile (e.g. snow for the winter outfit).'],
            ['**Transformations et tenues** (le temps de l\'activation) : Démon (cornes, flammes), Ange (auréole, ailes), Fantôme, Statue de pierre, Gelé, Doré légendaire, Zombie, Ombre, Glitch, Rétro 4 couleurs, et tenues **Chevalier**, **Paladin au bouclier**, **Soldat**, **Pilote d\'avion**, **Pilote de vaisseau**, **Ouvrier du bâtiment**. Elles s\'adaptent à n\'importe quel personnage. ▶ ou une touche les allume, un second appui les éteint ; **Durée** : jusqu\'au prochain appui, 5, 10, 30 s ou le nombre de secondes de votre choix (sur le Stream Deck, chaque touche peut avoir la sienne). Liées à une expression, elles durent tant qu\'elle est affichée (ex. Fâché = Démon).',
              '**Transformations and outfits** (while active): Demon (horns, flames), Angel (halo, wings), Ghost, Stone statue, Frozen, Legendary gold, Zombie, Shadow, Glitch, Retro 4 colors, and outfits **Knight**, **Paladin with shield**, **Soldier**, **Airplane pilot**, **Spaceship pilot**, **Construction worker**. They adapt to any character. ▶ or a key turns them on, a second press turns them off; **Duration**: until the next press, 5, 10, 30 s or any number of seconds (on the Stream Deck, each key can have its own). Linked to an expression, they last as long as it is shown (e.g. Angry = Demon).'],
            ['**Liés à la voix** : aura qui pulse, contour arc-en-ciel, notes de musique quand on parle longtemps, rebond élastique.', '**Voice-driven**: pulsing aura, rainbow outline, music notes when talking for a long time, squash & stretch.'],
            ['**Quand je crie** : effets lancés quand la voix dépasse nettement le seuil de grande ouverture.', '**When I shout**: effects played when the voice clearly exceeds the wide-open threshold.'],
            ['**Liés aux expressions** : « Choisir… » pour chaque expression. Les effets ponctuels partent quand l\'expression commence, les ambiances durent tant qu\'elle est affichée. Par défaut : Content = cœurs + étincelles, Fâché = veine + flammes, Surpris = ! + lignes de choc + impact, Triste = larmes.',
              '**Linked to expressions**: "Choose…" for each expression. One-shot effects play when the expression starts, ambiences last while it is shown. Defaults: Happy = hearts + sparkles, Angry = vein + flames, Surprised = ! + speed lines + impact, Sad = tears.'],
            ['**Intensité** : douce, normale ou forte.', '**Intensity**: soft, normal or strong.'],
            ['**Décors animés** (section Fond) : ciel, nuit étoilée, coucher de soleil, aurore boréale, synthwave, ville néon, espace, forêt au crépuscule, montagnes, plage, sous l\'eau, nuages pastel, motif qui défile, chambre cosy.',
              '**Animated scenes** (Background section): sky, starry night, sunset, northern lights, synthwave, neon city, space, forest at dusk, mountains, beach, underwater, pastel clouds, scrolling pattern, cozy room.'],
          ),
          p('**Stream Deck** : bouton **Icônes Stream Deck (ZIP)** de la section Effets. Il télécharge une icône 144 × 144 pour chaque effet et chaque décor, avec un fichier LISEZMOI qui liste les touches choisies dans votre projet. Sur le Stream Deck, ajoutez une action « Raccourci clavier » (Hotkey) avec la touche de l\'effet, puis glissez l\'icône sur le bouton. Le même pack est dans le dossier stream-deck/ du dépôt GitHub.',
            '**Stream Deck**: **Stream Deck icons (ZIP)** button in the Effects section. It downloads a 144 × 144 icon for each effect and each scene, with a README listing the keys chosen in your project. On the Stream Deck, add a "Hotkey" action with the effect\'s key, then drag the icon onto the button. The same pack is in the stream-deck/ folder of the GitHub repository.'),
          tip('Tout fonctionne aussi dans la fenêtre de capture (les effets déclenchés dans l\'éditeur y sont relayés) et dans l\'avatar .html (?bg=night, ?bg=synthwave…).', 'Everything also works in the capture window (effects triggered in the editor are relayed) and in the .html avatar (?bg=night, ?bg=synthwave…).'),
          go('action:openPngtuber', 'Essayer les effets', 'Try the effects'),
        ],
      },
      {
        id: 'obs', icon: 'tv', title: T('Dans OBS', 'In OBS'),
        body: [
          list(
            ['**Fenêtre de capture** : une fenêtre avec seulement l\'avatar, qui suit vos changements dans l\'éditeur. Capturez-la dans OBS (capture de fenêtre + filtre d\'incrustation).', '**Capture window**: a window with only the avatar, following your changes in the editor. Capture it in OBS (window capture + chroma key filter).'],
            ['**Format de la scène** (section Fond du mode PNGtuber) : 1920 × 1080, 1280 × 720, 2560 × 1440, vertical 1080 × 1920 (TikTok, Shorts), carré, 4:3, coin webcam 500 × 500, coin portrait 400 × 600, ou libre. Le cadre est affiché dans l\'éditeur ; réglez la **taille de l\'avatar** dans le cadre et sa **position** (en bas, à gauche, à droite, au centre).', '**Scene format** (Background section of PNGtuber mode): 1920 × 1080, 1280 × 720, 2560 × 1440, vertical 1080 × 1920 (TikTok, Shorts), square, 4:3, 500 × 500 webcam corner, 400 × 600 portrait corner, or free. The frame is shown in the editor; set the **avatar size** in the frame and its **position** (bottom, left, right, center).'],
            ['La fenêtre de capture s\'ouvre directement à ce format et suit vos changements ; son bouton **Ajuster la fenêtre** lui redonne la taille exacte. Dans OBS, la source a ainsi la bonne taille sans recadrage.', 'The capture window opens directly at that format and follows your changes; its **Fit window** button restores the exact size. In OBS, the source then has the right size without cropping.'],
            ['**Avatar OBS (.html)** : un fichier autonome à ajouter dans OBS comme **source navigateur** (fichier local), au fond transparent. Paramètres d\'adresse : ?bg=green, ?mic=1, ?ui=0, ?scale=4, ?profile=F14. [[H]] masque ses boutons.', '**OBS avatar (.html)**: a standalone file to add in OBS as a **browser source** (local file), with a transparent background. URL parameters: ?bg=green, ?mic=1, ?ui=0, ?scale=4, ?profile=F14. [[H]] hides its buttons.'],
            ['**Images pour logiciels PNGtuber** (veadotube, PNGTuber Plus…) : export ZIP avec repos, parle, entrouverte, avec et sans clignement, par expression et par profil.', '**Images for PNGtuber software** (veadotube, PNGTuber Plus…): ZIP export with idle, talking, half-open, with and without blinking, per expression and profile.'],
          ),
        ],
      },
      {
        id: 'deck', icon: 'keyboard', title: T('Plugin Stream Deck', 'Stream Deck plugin'),
        body: [
          p('Avec de simples raccourcis clavier, les touches du Stream Deck partent vers la fenêtre au premier plan : pendant un jeu, l\'avatar ne les reçoit pas. Le **plugin Pixel Atelier** règle ça : le Stream Deck parle directement à l\'avatar, même en plein jeu.',
            'With plain keyboard shortcuts, Stream Deck keys go to the window in the foreground: during a game, the avatar does not receive them. The **Pixel Atelier plugin** solves this: the Stream Deck talks directly to the avatar, even mid-game.'),
          steps(
            ['Mode PNGtuber > Diffusion : **Télécharger le plugin Stream Deck**, puis double-cliquez sur le fichier (logiciel Stream Deck 6.4 ou plus, Windows ou Mac).', 'PNGtuber mode > Streaming: **Download the Stream Deck plugin**, then double-click the file (Stream Deck software 6.4 or later, Windows or Mac).'],
            ['Cochez **Plugin Stream Deck** (même endroit) : la fenêtre de capture et l\'avatar OBS (.html) exporté ensuite se connectent au plugin.', 'Tick **Stream Deck plugin** (same place): the capture window and the OBS avatar (.html) exported afterwards connect to the plugin.'],
            ['Dans le logiciel Stream Deck, catégorie **Pixel Atelier**, glissez les actions sur vos touches : **Expression**, **Effet**, **Fond**, **Profil**, **Parler**.', 'In the Stream Deck software, **Pixel Atelier** category, drag the actions onto your keys: **Expression**, **Effect**, **Background**, **Profile**, **Talk**.'],
            ['Cliquez une touche : choisissez l\'expression, l\'effet, le fond ou le profil dans la liste (remplie avec votre projet quand l\'avatar est ouvert).', 'Click a key: pick the expression, effect, background or profile from the list (filled with your project while the avatar is open).'],
          ),
          list(
            ['**Expression** : bascule, ou **temporaire** (tant que la touche est appuyée). **Parler** : maintenir ou bascule.', '**Expression**: switch, or **temporary** (while the key is held). **Talk**: hold or toggle.'],
            ['**Effet** : les effets ponctuels partent à chaque appui. Pour les ambiances (neige, pluie…), les transformations et les tenues, choisissez le **Mode** : **Bascule** (allumer, puis éteindre à l\'appui suivant), **Pendant… secondes** (ex. Démon pendant 15 s : compte à rebours sur la touche, puis extinction seule ; un nouvel appui l\'éteint plus tôt) ou **Maintenir** (actif tant que la touche est enfoncée).', '**Effect**: one-shot effects play on each press. For ambiences (snow, rain…), transformations and outfits, choose the **Mode**: **Toggle** (on, then off at the next press), **For… seconds** (e.g. Demon for 15 s: countdown on the key, then it turns off by itself; pressing again turns it off sooner) or **Hold** (active while the key is held down).'],
            ['La touche de l\'expression, du profil, du fond ou de l\'ambiance en cours **s\'éclaire** ; les effets et fonds affichent leur icône.', 'The key of the current expression, profile, background or ambience **lights up**; effects and backgrounds show their icon.'],
            ['Un point d\'exclamation sur la touche : aucun avatar n\'est ouvert ou la case « Plugin Stream Deck » n\'est pas cochée.', 'An exclamation mark on the key: no avatar is open, or the "Stream Deck plugin" box is not ticked.'],
            ['Tout reste sur l\'ordinateur (connexion locale 127.0.0.1:39217) ; les pages d\'autres sites sont refusées.', 'Everything stays on the computer (local connection 127.0.0.1:39217); pages from other sites are refused.'],
          ),
          p('**Mises à jour** : les nouvelles expressions, nouveaux effets et nouveaux fonds apparaissent tout seuls dans les listes du plugin (l\'avatar lui envoie son catalogue) : rien à réinstaller. Seul le plugin lui-même (nouveaux modes, icônes) change parfois. Depuis la version 1.2, il vérifie le site de temps en temps : l\'inspecteur d\'une touche affiche alors **Installer la mise à jour**, qui télécharge le paquet et l\'ouvre ; le logiciel Stream Deck remplace le plugin en gardant vos touches et leurs réglages. Si le plugin installé est plus ancien, le mode PNGtuber le signale sous la case « Plugin Stream Deck ».',
            '**Updates**: new expressions, effects and backgrounds appear by themselves in the plugin\'s lists (the avatar sends it its catalog): nothing to reinstall. Only the plugin itself (new modes, icons) sometimes changes. Since version 1.2, it checks the site from time to time: a key\'s inspector then shows **Install the update**, which downloads the package and opens it; the Stream Deck software replaces the plugin and keeps your keys and their settings. If the installed plugin is older, PNGtuber mode says so under the "Stream Deck plugin" box.'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'export', icon: 'download', title: T('Exporter', 'Export'),
    intro: T('Bouton **Exporter** [[Ctrl+Maj+E]]. Les exports sont toujours au pixel près : agrandissement au plus proche voisin, transparence conservée, jamais de flou.', '**Export** button [[Ctrl+Shift+E]]. Exports are always pixel-exact: nearest-neighbour scaling, transparency kept, never blurry.'),
    sections: [
      {
        id: 'kinds', title: T('Formats', 'Formats'),
        body: [
          list(
            ['**Image (PNG)** : l\'image telle qu\'affichée.', '**Image (PNG)**: the image as displayed.'],
            ['**Pack PNGtuber complet (ZIP)** : image, calques, variantes, expressions, profils et manifest.json.', '**Complete PNGtuber pack (ZIP)**: image, layers, variants, expressions, profiles and manifest.json.'],
            ['**Images pour logiciels PNGtuber**, **Avatar OBS (.html)** : voir le chapitre PNGtuber.', '**Images for PNGtuber software**, **OBS avatar (.html)**: see the PNGtuber chapter.'],
            ['**Photoshop (PSD)** : calques et groupes conservés (Photoshop, GIMP, Krita, Photopea).', '**Photoshop (PSD)**: layers and groups kept (Photoshop, GIMP, Krita, Photopea).'],
            ['**Calque par calque**, **par variante**, **par expression**, **par profil**, **toutes les combinaisons** (ZIP).', '**Layer by layer**, **per variant**, **per expression**, **per profile**, **all combinations** (ZIP).'],
            ['**Spritesheet / planche de tuiles**, **GIF animé**, **images d\'animation séparées**.', '**Spritesheet / tile sheet**, **animated GIF**, **separate animation frames**.'],
          ),
        ],
      },
      {
        id: 'options', title: T('Options', 'Options'),
        body: [
          list(
            ['**Échelle** ×1 à ×16 (ou personnalisée jusqu\'à ×64) : la taille finale s\'affiche.', '**Scale** ×1 to ×16 (or custom up to ×64): the final size is shown.'],
            ['**Recadrage** : taille du canevas, boîte commune autour du contenu (alignement conservé) ou chaque image séparément.', '**Crop**: canvas size, common box around the content (alignment kept) or each image separately.'],
            ['Planche : colonnes, espacement et fichier JSON. Animations : une par balise. ZIP : inclure le fichier projet.', 'Sheet: columns, spacing and JSON file. Animations: one per tag. ZIP: include the project file.'],
          ),
          go('action:exportDialog', 'Ouvrir l\'export', 'Open export'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'files', icon: 'folder', title: T('Projets, fichiers et historique', 'Projects, files and history'),
    intro: T('Vos projets sont enregistrés automatiquement dans ce navigateur. Les fichiers servent à les sauvegarder ailleurs ou à les partager.', 'Your projects are saved automatically in this browser. Files are for backing them up elsewhere or sharing them.'),
    sections: [
      {
        id: 'projects', icon: 'folder', title: T('Mes projets', 'My projects'),
        body: [
          list(
            ['Menu ☰ > **Mes projets** [[Ctrl+O]] : ouvrir, renommer, dupliquer, supprimer, avec miniatures.', '☰ menu > **My projects** [[Ctrl+O]]: open, rename, duplicate, delete, with thumbnails.'],
            ['La sauvegarde automatique se règle dans Paramètres > Affichage (rapide, toutes les 5 s, ou désactivée). [[Ctrl+S]] enregistre tout de suite.', 'Autosave is set in Settings > Display (fast, every 5 s, or off). [[Ctrl+S]] saves right away.'],
            ['En navigation privée ou si l\'espace est plein, un message prévient : téléchargez alors le fichier projet.', 'In private browsing or when storage is full, a message warns you: then download the project file.'],
          ),
          go('action:openProjects', 'Mes projets…', 'My projects…'),
        ],
      },
      {
        id: 'filesio', icon: 'save', title: T('Fichiers', 'Files'),
        body: [
          list(
            ['**Enregistrer dans un fichier** [[Ctrl+Maj+S]] : fichier projet .pxa.json. Sur ordinateur (Chrome, Edge), le fichier reste lié et [[Ctrl+S]] le met à jour.', '**Save to a file** [[Ctrl+Shift+S]]: .pxa.json project file. On desktop (Chrome, Edge), the file stays linked and [[Ctrl+S]] updates it.'],
            ['**Ouvrir un fichier** : projet .pxa.json, ZIP exporté avec son projet, ou fichier **Aseprite** (.ase, .aseprite).', '**Open a file**: .pxa.json project, ZIP exported with its project, or **Aseprite** file (.ase, .aseprite).'],
            ['**Importer une image comme calque** (PNG, JPEG, GIF, WebP) ou la coller avec [[Ctrl+V]].', '**Import an image as a layer** (PNG, JPEG, GIF, WebP) or paste it with [[Ctrl+V]].'],
          ),
        ],
      },
      {
        id: 'convert', icon: 'image', title: T('Image en pixel art, planche de sprites', 'Image to pixel art, sprite sheet'),
        body: [
          list(
            ['**Convertir une image en pixel art** (menu ☰) : une photo ou un dessin devient du pixel art, avec aperçu côte à côte. Réglez la **largeur** (32 à 128 px conseillés), la **réduction** (Nette : garde les contours, Douce : fond les détails), les **couleurs** (meilleures couleurs extraites, palette du projet ou toutes), le **tramage**, la saturation et le contraste ; « Nettoyer les pixels isolés » retire le bruit. Résultat en **nouveau dessin** (avec sa palette) ou en **nouveau calque**.', '**Convert an image to pixel art** (☰ menu): a photo or drawing becomes pixel art, with a side-by-side preview. Set the **width** (32 to 128 px recommended), the **reduction** (Sharp: keeps edges, Soft: blends details), the **colors** (best extracted colors, project palette or all), **dithering**, saturation and contrast; "Clean isolated pixels" removes noise. Result as a **new drawing** (with its palette) or a **new layer**.'],
            ['**Importer une planche de sprites** (menu ☰) : une image qui contient plusieurs images d\'animation côte à côte. Indiquez la taille d\'une case (devinée automatiquement), le décalage et l\'espacement ; les cases numérotées s\'affichent sur l\'aperçu, les cases vides peuvent être ignorées. Résultat : une animation, une case par image.', '**Import a sprite sheet** (☰ menu): an image holding several animation frames side by side. Set the cell size (guessed automatically), offset and spacing; numbered cells are shown on the preview, empty cells can be skipped. Result: an animation, one cell per frame.'],
          ),
          tip('Pour un portrait, recadrez la photo sur le visage et retouchez ensuite les yeux et les contours à la main : c\'est ce qui fait la différence.', 'For a portrait, crop the photo to the face, then retouch the eyes and outlines by hand: that is what makes the difference.'),
        ],
      },
      {
        id: 'backup', icon: 'folder', title: T('Sauvegardes (dossier, Google Drive, ZIP)', 'Backups (folder, Google Drive, ZIP)'),
        body: [
          p('Vos projets sont enregistrés dans le navigateur. Pour ne jamais les perdre (données du site effacées, autre appareil), gardez-en une copie ailleurs : menu ☰ > **Sauvegardes**, ou Paramètres > **Sauvegarde**.',
            'Your projects are stored in the browser. To never lose them (site data cleared, another device), keep a copy elsewhere: ☰ menu > **Backups**, or Settings > **Backup**.'),
          list(
            ['**Dossier de l\'ordinateur** (Chrome, Edge, Opera sur ordinateur) : choisissez un dossier ; chaque projet y est copié automatiquement (au plus une fois par minute et à la fermeture de l\'onglet), avec une copie par jour dans « historique » pendant 14 jours.', '**Computer folder** (Chrome, Edge, Opera on a computer): choose a folder; each project is copied there automatically (at most once a minute and when the tab closes), with one copy per day in "historique" for 14 days.'],
            ['**Astuce** : choisissez un dossier synchronisé (**Google Drive pour ordinateur**, OneDrive, Dropbox) : vous avez alors aussi une copie en ligne, sans autre réglage.', '**Tip**: choose a synced folder (**Google Drive for desktop**, OneDrive, Dropbox): you then also get an online copy, with no other setup.'],
            ['**Google Drive en direct** (tous les navigateurs, y compris téléphone) : il faut une fois un « identifiant client » Google gratuit (les étapes sont dans l\'onglet Sauvegarde). Ensuite « Se connecter » : les projets vont dans un dossier « Pixel Atelier » de votre Drive. La connexion dure environ une heure.', '**Google Drive directly** (every browser, phones included): you need a free Google "client ID" once (steps in the Backup tab). Then "Connect": projects go into a "Pixel Atelier" folder in your Drive. The connection lasts about an hour.'],
            ['**Archive ZIP** : tous les projets dans un fichier, partout. **Restaurer une archive** les remet dans le navigateur (sur n\'importe quel appareil).', '**ZIP archive**: all projects in one file, everywhere. **Restore an archive** puts them back into the browser (on any device).'],
            ['**Restaurer…** (dossier ou Drive) : cochez les projets ou les copies datées à récupérer.', '**Restore…** (folder or Drive): tick the projects or dated copies to recover.'],
            ['Un **rappel** apparaît si aucune sauvegarde n\'a été faite depuis 7 jours (réglable).', 'A **reminder** appears if no backup has been made for 7 days (adjustable).'],
          ),
          go('settings:backup', 'Ouvrir les sauvegardes', 'Open backups'),
        ],
      },
      {
        id: 'history', icon: 'undo', title: T('Annuler et historique', 'Undo and history'),
        body: [
          p('Tout s\'annule : [[Ctrl+Z]], [[Ctrl+Y]], boutons ↶ ↷, tape à 2 ou 3 doigts. Le panneau **Historique** liste les actions : un clic sur une ligne ramène l\'image à ce moment.',
            'Everything can be undone: [[Ctrl+Z]], [[Ctrl+Y]], ↶ ↷ buttons, 2- or 3-finger tap. The **History** panel lists actions: click a line to bring the image back to that moment.'),
          go('panel:history', 'Ouvrir l\'historique', 'Open history'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'settings', icon: 'settings', title: T('Paramètres et raccourcis', 'Settings and shortcuts'),
    intro: T('Bouton ⚙ (en haut à droite) ou menu ☰ > Paramètres.', '⚙ button (top right) or ☰ menu > Settings.'),
    sections: [
      {
        id: 'set-tabs', title: T('Les onglets', 'The tabs'),
        body: [
          list(
            ['**Apparence** : 7 thèmes (sombre, clair, minuit, forêt, sépia, pastel, contraste élevé), couleurs personnalisées, taille de l\'interface, damier de transparence.', '**Appearance**: 7 themes (dark, light, midnight, forest, sepia, pastel, high contrast), custom colors, interface size, transparency checker.'],
            ['**Navigation** : molette, zoom fluide, sens inversé, mode stylet, gestes à 2 et 3 doigts, mode gaucher, animations réduites.', '**Navigation**: wheel, smooth zoom, inverted direction, stylus mode, 2- and 3-finger gestures, left-handed mode, reduced motion.'],
            ['**Affichage** : grille de pixels, curseur du pinceau, barre de variantes, mini-vue, barre d\'état, confirmation avant suppression, sauvegarde automatique.', '**Display**: pixel grid, brush cursor, variant bar, mini view, status bar, delete confirmation, autosave.'],
            ['**Langue et aide** : 10 langues (français, English, español, Deutsch, italiano, português, русский, 日本語, 中文, 한국어 ; ce guide reste en français ou en anglais), tutoriel, raccourcis. **Sauvegarde** : dossier, Google Drive, archive ZIP. **Données** : exporter, importer ou réinitialiser vos réglages.', '**Language and help**: 10 languages (French, English, Spanish, German, Italian, Portuguese, Russian, Japanese, Chinese, Korean; this guide stays in French or English), tutorial, shortcuts. **Backup**: folder, Google Drive, ZIP archive. **Data**: export, import or reset your settings.'],
          ),
          go('settings:look', 'Ouvrir les paramètres', 'Open settings'),
        ],
      },
      {
        id: 'keys', icon: 'keyboard', title: T('Raccourcis clavier', 'Keyboard shortcuts'),
        body: [
          keys(
            ['B / E / K', 'Crayon / gomme / ombrage', 'Pencil / eraser / shading'],
            ['G / J / I', 'Remplissage / dégradé / pipette', 'Fill / gradient / picker'],
            ['L / U / O', 'Ligne / rectangle / ellipse', 'Line / rectangle / ellipse'],
            ['M / Q / W', 'Sélection / lasso / baguette', 'Select / lasso / wand'],
            ['V / H', 'Déplacer / main', 'Move / hand'],
            ['Y', 'Texte', 'Text'],
            ['Ctrl+K', 'Rechercher une commande (menu, outils, palette, panneaux) : tapez quelques lettres, ↑ ↓ puis Entrée', 'Search for a command (menu, tools, palette, panels): type a few letters, ↑ ↓ then Enter'],
            ['Ctrl+Z / Ctrl+Y', 'Annuler / rétablir', 'Undo / redo'],
            ['?', 'Liste complète des raccourcis', 'Full shortcut list'],
          ),
          p('Menu ☰ > **Personnaliser les raccourcis** : changez la touche de chaque outil et action.', '☰ menu > **Customize shortcuts**: change the key of each tool and action.'),
          go('shortcuts', 'Tous les raccourcis', 'All shortcuts'),
        ],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'lexique', icon: 'keyboard', title: T('Lexique des raccourcis', 'Shortcut glossary'),
    intro: T('Tous les raccourcis utilisables, au même endroit. La dernière section liste les touches que vous avez choisies dans ce projet.', 'Every available shortcut in one place. The last section lists the keys you chose in this project.'),
    sections: [
      {
        id: 'lx-combo', icon: 'key', title: T('Créer un raccourci à plusieurs touches', 'Creating a multi-key shortcut'),
        body: [
          p('Partout où l\'on associe une touche (expressions, profils, effets, fonds), on peut aussi enregistrer une **combinaison** : maintenez [[Ctrl]], [[Alt]] et/ou [[Maj]] puis appuyez sur la touche (ex. [[Ctrl+Maj+1]], [[Alt+B]]). [[Retour arrière]] retire le raccourci, [[Échap]] annule.',
            'Wherever you assign a key (expressions, profiles, effects, backgrounds), you can also record a **combination**: hold [[Ctrl]], [[Alt]] and/or [[Shift]] then press the key (e.g. [[Ctrl+Shift+1]], [[Alt+B]]). [[Backspace]] removes the shortcut, [[Esc]] cancels.'),
          list(
            ['Une touche simple marche aussi avec [[Maj]] tenue. Les chiffres sont lus sur la touche : sur un clavier AZERTY, [[1]] marche sans [[Maj]].', 'A single key also works with [[Shift]] held. Digits are read from the key itself: on an AZERTY keyboard, [[1]] works without [[Shift]].'],
            ['Un même raccourci ne peut servir qu\'à une chose : l\'appli prévient en cas de doublon.', 'A shortcut can only do one thing: the app warns about duplicates.'],
            ['Stream Deck et logiciels de macros : envoyez la touche ou la combinaison choisie à la fenêtre (elle doit avoir le focus).', 'Stream Deck and macro software: send the chosen key or combination to the window (it must have focus).'],
          ),
        ],
      },
      {
        id: 'lx-editor', icon: 'pencil', title: T('Éditeur : combinaisons', 'Editor: combinations'),
        body: [
          keys(
            ['Ctrl+Z', 'Annuler', 'Undo'], ['Ctrl+Y / Ctrl+Maj+Z', 'Rétablir', 'Redo'],
            ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copier / couper / coller', 'Copy / cut / paste'], ['Ctrl+A', 'Tout sélectionner', 'Select all'],
            ['Ctrl+D / Échap', 'Désélectionner', 'Deselect'], ['Ctrl+Maj+I', 'Inverser la sélection', 'Invert selection'],
            ['Suppr', 'Effacer la sélection', 'Clear selection'], ['Entrée', 'Valider le déplacement ou la transformation', 'Confirm move or transform'],
            ['Flèches / Maj+Flèches', 'Déplacer la sélection de 1 / 8 px', 'Move the selection by 1 / 8 px'],
            ['Maj+H / Maj+V / Maj+R', 'Miroir horizontal / vertical / rotation 90° de la sélection', 'Flip horizontal / vertical / rotate 90° the selection'],
            ['Ctrl+T', 'Rotation libre / échelle', 'Free rotate / scale'],
            ['Ctrl+Maj+N', 'Nouveau calque', 'New layer'], ['Ctrl+J', 'Dupliquer le calque', 'Duplicate layer'], ['Ctrl+E', 'Fusionner vers le bas', 'Merge down'],
            ['Alt+↑ / Alt+↓', 'Calque actif précédent / suivant', 'Previous / next active layer'], ['F2', 'Renommer', 'Rename'], ['Tab', 'Variante suivante du groupe actif', 'Next variant of the active group'],
            ['Ctrl+S', 'Enregistrer', 'Save'], ['Ctrl+Maj+S', 'Enregistrer dans un fichier', 'Save to a file'], ['Ctrl+O', 'Mes projets', 'My projects'], ['Ctrl+Maj+E', 'Exporter', 'Export'],
            ['Ctrl+0 / Ctrl+1', 'Ajuster à l\'écran / taille réelle', 'Fit to screen / actual size'],
            ['F1', 'Guide sur l\'outil actif', 'Guide for the active tool'], ['?', 'Fenêtre des raccourcis', 'Shortcuts window'], ['Échap', 'Fermer, annuler, désélectionner', 'Close, cancel, deselect'],
          ),
          keys(
            ['Espace', 'Maintenu + glisser : déplacer la vue', 'Held + drag: pan the view'], ['Alt', 'Maintenu : pipette temporaire', 'Held: temporary color picker'],
            ['Maj', 'Crayon : ligne droite depuis le dernier point ; formes : carré, cercle, 45°', 'Pencil: straight line from the last point; shapes: square, circle, 45°'],
          ),
        ],
      },
      {
        id: 'lx-single', icon: 'keyboard', title: T('Éditeur : touches simples (personnalisables)', 'Editor: single keys (customizable)'),
        body: [
          { dyn: 'editor' },
          p('Menu ☰ > **Personnaliser les raccourcis** pour les changer.', '☰ menu > **Customize shortcuts** to change them.'),
          go('shortcuts', 'Fenêtre des raccourcis', 'Shortcuts window'),
        ],
      },
      {
        id: 'lx-pt', icon: 'tv', title: T('Mode PNGtuber, capture OBS et avatar .html', 'PNGtuber mode, OBS capture and .html avatar'),
        body: [
          keys(
            ['Espace', 'Parler (maintenir)', 'Talk (hold)'], ['Échap', 'Quitter le mode PNGtuber', 'Leave PNGtuber mode'],
            ['F13 … F24', 'Profils (tenues, personnages) ou la combinaison choisie', 'Profiles (outfits, characters) or the chosen combination'],
            ['1 … 7', 'Expressions par défaut d\'un nouveau personnage', 'Default expressions of a new character'],
            ['H', 'Avatar .html : masquer / afficher ses boutons', '.html avatar: hide / show its buttons'],
          ),
          list(
            ['Touches des **expressions** : onglet Expressions > ⋯ > Associer une touche (option « temporaire »).', '**Expression** keys: Expressions tab > ⋯ > Assign a key ("temporary" option).'],
            ['Touches des **effets** : mode PNGtuber > Effets > « Touche… ».', '**Effect** keys: PNGtuber mode > Effects > "Key…".'],
            ['Touches des **fonds** : mode PNGtuber > Fond > « Touches des fonds… ».', '**Background** keys: PNGtuber mode > Background > "Background keys…".'],
            ['Les mêmes touches marchent dans la fenêtre de capture et dans l\'avatar .html. Ce que vous changez dans le mode PNGtuber (expression, profil, fond, effet) est aussi relayé à la fenêtre de capture.', 'The same keys work in the capture window and in the .html avatar. What you change in PNGtuber mode (expression, profile, background, effect) is also relayed to the capture window.'],
            ['Avatar .html : paramètres d\'adresse ?bg= (fond ou décor : night, synthwave…), ?mic=1, ?ui=0, ?scale=4, ?profile=F14.', '.html avatar: URL parameters ?bg= (background or scene: night, synthwave…), ?mic=1, ?ui=0, ?scale=4, ?profile=F14.'],
          ),
        ],
      },
      {
        id: 'lx-touch', icon: 'hand', title: T('Gestes tactiles et souris', 'Touch and mouse gestures'),
        body: [
          keys(
            ['1 doigt', 'Dessiner', 'Draw'], ['2 doigts', 'Pincer : zoomer ; glisser : déplacer la vue', 'Pinch: zoom; drag: pan'],
            ['Tape à 2 doigts', 'Annuler', 'Undo'], ['Tape à 3 doigts', 'Rétablir', 'Redo'],
            ['Appui long', 'Couleur : couleur B ; outil : autres outils de la famille', 'Color: color B; tool: other tools of the family'],
            ['Clic droit', 'Dessiner avec la couleur B ; outil : autres outils', 'Draw with color B; tool: other tools'],
            ['Molette', 'Zoom (ou déplacement, au choix)', 'Zoom (or pan, your choice)'], ['Clic milieu', 'Déplacer la vue', 'Pan the view'],
          ),
        ],
      },
      {
        id: 'lx-project', icon: 'star', title: T('Raccourcis de ce projet', 'This project\'s shortcuts'),
        body: [{ dyn: 'project' }],
      },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'tips', icon: 'star', title: T('Astuces et questions', 'Tips and FAQ'),
    intro: T('Quelques réponses rapides.', 'A few quick answers.'),
    sections: [
      {
        id: 'faq', title: T('Questions fréquentes', 'Frequently asked questions'),
        body: [
          list(
            ['**Mon dessin est flou à l\'export ?** Non : les exports agrandissent au plus proche voisin. Si une image paraît floue, c\'est l\'aperçu du logiciel qui la lisse.', '**Is my export blurry?** No: exports scale with nearest neighbour. If an image looks blurry, the viewing software is smoothing it.'],
            ['**Je ne peux pas dessiner ?** Le calque est peut-être verrouillé 🔒, masqué 👁, c\'est un groupe ou un calque de référence : choisissez un calque normal.', '**Can\'t draw?** The layer may be locked 🔒, hidden 👁, a group or a reference layer: pick a normal layer.'],
            ['**Où sont mes projets ?** Dans ce navigateur, sur cet appareil. Pour changer d\'appareil, enregistrez un fichier projet et ouvrez-le de l\'autre côté.', '**Where are my projects?** In this browser, on this device. To switch devices, save a project file and open it on the other side.'],
            ['**Le micro ne marche pas ?** Autorisez-le pour ce site dans le navigateur ; il faut une page en https ou un fichier local.', '**Microphone not working?** Allow it for this site in the browser; an https page or a local file is required.'],
            ['**Revenir à zéro** : Paramètres > Données > Réinitialiser (vos projets sont conservés).', '**Start over**: Settings > Data > Reset (your projects are kept).'],
          ),
        ],
      },
      {
        id: 'pro', title: T('Astuces de pixel art', 'Pixel art tips'),
        body: [
          list(
            ['Travaillez petit (32×32 ou 64×64) et zoomez : chaque pixel compte.', 'Work small (32×32 or 64×64) and zoom in: every pixel counts.'],
            ['Utilisez peu de couleurs, rangées du clair au foncé : l\'outil Ombrage devient alors très efficace.', 'Use few colors, ordered from light to dark: the Shading tool then becomes very effective.'],
            ['Activez **Pixel perfect** pour des contours propres, et la **symétrie** pour un visage de face.', 'Turn on **Pixel perfect** for clean outlines, and **symmetry** for a front-facing face.'],
            ['Regardez la **mini-vue** : c\'est la taille réelle, celle que verront les spectateurs.', 'Watch the **mini view**: it is the real size viewers will see.'],
          ),
        ],
      },
    ],
  },
];

/** Section d'aide correspondant à un outil (pour le bouton « ? » de la barre d'options). */
export const TOOL_SECTION = {
  pencil: ['draw', 'pencil'], eraser: ['draw', 'eraser'], shade: ['draw', 'shade'], fill: ['draw', 'fill'], gradient: ['draw', 'gradient'],
  picker: ['draw', 'picker'], line: ['draw', 'shapes'], rect: ['draw', 'shapes'], ellipse: ['draw', 'shapes'], text: ['draw', 'text'],
  select: ['select', 'select-tools'], lasso: ['select', 'select-tools'], wand: ['select', 'select-tools'], move: ['select', 'move'], hand: ['select', 'move'],
};
