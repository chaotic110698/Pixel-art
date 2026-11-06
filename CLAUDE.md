# CLAUDE.md — Pixel Atelier

Éditeur de pixel art statique (GitHub Pages), en JavaScript vanilla avec modules ES, **sans build ni dépendance**. L'interface et les commentaires sont en français.

## Conventions

- Aucun framework ni bundler, aucun paquet npm à l'exécution. Les imports se font en relatif avec l'extension `.js`.
- Couleurs : `Uint32` **0xAABBGGRR** (little-endian, ordre mémoire RGBA), ce qui permet de partager un `Uint32Array` de cel avec un `ImageData`. Helpers dans `js/util/color.js`.
- Ne jamais lisser : `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`. Les exports passent par `js/export/png.js` (encodeur exact, alpha non prémultiplié). N'utilisez pas `canvas.toBlob` pour un export.
- Toute modification du document doit être **annulable** :
  - pixels : `const t = app.history.beginPixels(layer)`, puis modification de `t.cel`, puis `app.markLayerDirty(t.cel, x0, y0, x1, y1)`, puis `app.history.endPixels(t, 'Libellé')` ;
  - structure (calques, variantes, expressions, taille, frames, charColors) : `app.history.transact('Libellé', () => { ... })`. Les opérations qui changent les pixels « en masse » **remplacent** les tableaux de cels au lieu de les modifier sur place, car l'instantané de structure partage les cels par référence ;
  - plusieurs entrées regroupées : `app.history.group('Libellé', fn)`.
- Évènements de `app` (Emitter) : `doc`, `structure`, `changed`, `pixels`, `history`, `tool`, `color`, `state`, `selection`, `frame`, `viewport`, `hover`, `grid`, `toast`. L'UI se met à jour en les écoutant.
- Préférences de l'éditeur : `app.state` (persistées dans localStorage via `app.setState(patch)`). Données du projet : `app.doc`.
- Ergonomie : zones tactiles ≥ 44 px, `title` et `aria-label` sur les boutons d'icône, Pointer Events uniquement.
- Après tout ajout, suppression ou renommage de fichier : `node scripts/sw-files.mjs --write` (liste de précache du service worker), et incrémenter `VERSION` dans `sw.js` avant une mise en ligne.

## Architecture

```
index.html, css/app.css, manifest.webmanifest, sw.js, icons/
js/main.js            point d'entrée : construit l'UI, relie les modules
js/app.js             classe App : état, document, services (historique, sélection, rendu…)
js/core/
  doc.js              modèle : arbre de nœuds (layer/group), frames, expressions, grille, pngtuber, snapshot/restore
  history.js          annuler/rétablir : patchs rectangulaires + transactions de structure
  selection.js        masque de sélection + contenu flottant (lift/paste/transform/commit)
  raster.js           Bresenham, rect, ellipse, flood fill, polygone, motifs de tramage, transformations
  layer-ops.js        calques, groupes, variantes, expressions (toutes annulables)
  image-ops.js        taille du canevas, échelle, miroir, rotation, recadrage
  palettes.js         palettes prédéfinies, import/export, extraction (median cut)
js/render/
  celcache.js         canvas mis en cache par cel (WeakMap), mise à jour partielle (putImageData d'un rect)
  compose.js          composition canvas (rapide) et pixels exacts (export, pipette)
  renderer.js         vue : damier, mosaïque, onion skin, grilles, symétrie, fourmis, curseur
  viewport.js         zoom / déplacement
js/tools/             painter.js (taille, symétrie, tramage, masque, enroulement), outils
js/ui/                input (pointeurs/gestes), toolbar, panneaux, dialogues, menu, raccourcis, tutoriel, timeline
js/export/            png.js, gif.js, zip.js, render.js (images d'export), exporter.js (logique + manifest), export-ui.js
js/library/
  builder.js          mini-langage de pièces (Grid, rôles, contour/ombrage auto, roleColors, recolorMap)
  library.js          registre des catégories, insertion dans un doc (ordre z, remplacement)
  character.js        « Nouveau personnage », expressions par défaut, réglage PNGtuber automatique
  library-ui.js       fenêtres Bibliothèque, Nouveau personnage, Recolorer, Ma bibliothèque
  parts/*.js          UN FICHIER PAR CATÉGORIE (bodies, heads, hair, eyes, brows, noses, mouths, accessories, tops)
js/pngtuber/          mode PNGtuber (micro Web Audio local, clignement, expressions au clavier)
js/storage/           db.js (IndexedDB), serialize.js, storage.js (autosave), project-file.js, projects-ui.js
scripts/sw-files.mjs  vérifie ou régénère la liste de précache de sw.js
```

### Modèle de document

- `doc.nodes : Map<id, node>`, racine `root`. Les enfants d'un groupe sont rangés **du bas vers le haut** ; le panneau les affiche dans l'ordre inverse.
- Un calque contient `cels[frame]` (un `Uint32Array` de taille w×h par frame, créé dès le départ), `opacity`, `visible`, `locked`, `reference`, `part` (métadonnées de bibliothèque : `pieceId`, `category`, `z`, `state`).
- Un groupe avec `variant: true` n'affiche que `active`. `role` vaut `eyes`, `mouth` ou `brows` pour les pièces de la bibliothèque.
- Une expression a la forme `{ id, name, states: { groupId: childId }, key }`.
- `doc.renderList({ overrides, includeReference, root, ignoreVisibility, frame })` donne les calques à composer.

### Bibliothèque : ajouter une pièce

Une pièce est `{ id, name, category, build(ctx) => [{ name, z, grid } | { name, z, role, variants: [{ name, state, grid }] }] }`.

- Gabarit 64×64 : tête en x 20–43, y 11–37 ; yeux vers y 23–27 (centres x 26 et 37) ; sourcils vers y 18–21 ; nez à x 31–32, y 28–31 ; bouche en x 27–36, y 32–35 ; épaules à partir de y ≈ 44. L'axe de symétrie est x = 31,5.
- Rôles de couleur, convertis par `roleColors()` : `s S k r` (peau), `h H j q` (cheveux), `w e E p l` (yeux et encre), `m t T` (bouche), `c C x` (vêtements), `a A y` (accessoires), `g` (verre).
- Les états de variantes reconnus par le PNGtuber et les expressions par défaut sont : yeux `open/closed/happy/surprised`, bouche `closed/open/smile/sad/surprised`, sourcils `normal/high/angry/sad`.
- L'ordre d'empilement suit `Z` dans `builder.js`. Les coiffures produisent un calque arrière (sous la tête) et un calque avant.

## Tests manuels et automatiques

Il n'y a pas de framework de test. On vérifie avec Playwright (Chromium déjà installé dans l'environnement cloud) en servant le dossier avec `python3 -m http.server`. `window.pixelAtelier` expose l'objet `app` pour piloter les outils (`app.tools.current.down/move/up(p)`) et vérifier l'état.

Points à revérifier après une modification importante :
- tactile : 2 doigts (zoom sans tracé), tape à 2 doigts (annuler) ;
- annuler/rétablir de bout en bout ;
- export (relire les PNG/ZIP/GIF, par exemple avec Python/PIL) ;
- fonctionnement hors ligne (service worker).

## Pistes pour la suite

Carte de niveau (tilemap) en mode tuiles, rotation libre de la sélection, pinceau « pixel perfect », sélection de calques multiples, raccourcis personnalisables, plus de pièces (corps entiers, vêtements variés).
