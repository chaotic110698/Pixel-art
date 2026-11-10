# CLAUDE.md — Pixel Atelier

Éditeur de pixel art statique (GitHub Pages), en JavaScript vanilla avec modules ES, **sans build ni dépendance**. L'interface et les commentaires sont en français.

## Conventions

- Aucun framework ni bundler, aucun paquet npm à l'exécution. Les imports se font en relatif avec l'extension `.js`.
- Couleurs : `Uint32` **0xAABBGGRR** (little-endian, ordre mémoire RGBA), ce qui permet de partager un `Uint32Array` de cel avec un `ImageData`. Helpers dans `js/util/color.js`.
- Ne jamais lisser : `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`. Les exports passent par `js/export/png.js` (encodeur exact, alpha non prémultiplié). N'utilisez pas `canvas.toBlob` pour un export.
- Toute modification du document doit être **annulable** :
  - pixels : `const t = app.history.beginPixels(layer)`, puis modification de `t.cel`, puis `app.markLayerDirty(t.cel, x0, y0, x1, y1)`, puis `app.history.endPixels(t, 'Libellé')` ;
  - structure et métadonnées (calques, variantes, expressions, taille, frames, FPS, charColors, nom, grille, palette, réglages PNGtuber) : `app.history.transact('Libellé', () => { ... })`. Après annuler/rétablir, l'évènement `meta` invite les panneaux à se redessiner.
  - les sélections passent par `selection.apply/deselect/commitFloating`, qui enregistrent elles-mêmes leur entrée d'historique (`Selection._record`) ;
  - réglage « en direct » (curseur, couleur) : appliquer pendant le glissement, puis remettre l'ancienne valeur et faire une seule `transact` au relâchement (voir grid-panel.js ou `actions.setReference`). Les opérations qui changent les pixels « en masse » **remplacent** les tableaux de cels au lieu de les modifier sur place, car l'instantané de structure partage les cels par référence ;
  - plusieurs entrées regroupées : `app.history.group('Libellé', fn)`.
- Évènements de `app` (Emitter) : `doc`, `structure`, `meta`, `changed`, `pixels`, `history`, `tool`, `color`, `state`, `selection`, `frame`, `viewport`, `hover`, `grid`, `toast`.
- Toute modification de pixels en place doit passer par `markDirty` (via `app.markLayerDirty`) : c'est ce qui déclenche aussi la sauvegarde incrémentale. L'UI se met à jour en les écoutant.
- Préférences de l'éditeur : `app.state` (persistées dans localStorage via `app.setState(patch)`). Données du projet : `app.doc`.
- **Langues** : le code et l'interface sont écrits en français ; les traductions sont appliquées à la volée par `js/ui/i18n.js` (MutationObserver sur les textes, `title`, `aria-label`, `placeholder`). Tout nouveau texte d'interface doit être ajouté **à la fin** de `js/ui/i18n-en.js` (clé = texte français exact) ou couvert par un motif de `i18n.js` pour les textes dynamiques (nouveau motif : **à la fin** de PATTERNS). Autres langues (`LANGS`) : `i18n/<code>.txt` (une traduction par ligne, dans l'ordre des clés de i18n-en.js, puis un bloc `#P` de modèles `{1}`, `{T1}`…) assemblés en `js/ui/lang/<code>.js` par `python3 scripts/i18n-lang.py i18n/<code>.txt` ; `--missing <code>` liste ce qui reste à traduire (repli en anglais en attendant). Le guide n'existe qu'en français et en anglais (autres langues : anglais). Les contenus de l'utilisateur (noms de calques, expressions, projets…) doivent porter `translate: 'no'`. Les noms créés par l'application (calques par défaut, pièces) passent par `tr()`.
- **Guide** : toute nouvelle fonction ou tout nouvel outil doit être décrit dans `js/ui/guide-content.js` (français ET anglais ; ce contenu est en `translate="no"`, il ne passe pas par i18n-en.js). Un outil a sa section dans `TOOL_SECTION` (ouverte par F1 et le bouton « ? » de la barre d'options).
- Panneaux et fenêtres qui se redessinent entièrement (`clear` + reconstruction) : passer par `keepScroll(el, fn)` (util/dom.js), sinon un clic en bas d'une liste ramène l'utilisateur en haut.
- Ergonomie : zones tactiles ≥ 44 px, `title` et `aria-label` sur les boutons d'icône, Pointer Events uniquement.
- Après tout ajout, suppression ou renommage de fichier : `node scripts/sw-files.mjs --write` (liste de précache du service worker), et incrémenter `VERSION` dans `sw.js` avant une mise en ligne.

## Mise en ligne

- GitHub Pages publie la branche **`main`**. Travailler sur la branche de session, puis pousser aussi sur `main` (`git push origin HEAD:main`) une fois les tests passés.
- Avant de pousser : `node scripts/sw-files.mjs` (liste à jour) et `VERSION` incrémentée dans `sw.js`, sinon les utilisateurs gardent l'ancienne version en cache.

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
  parts/*.js          UN FICHIER PAR CATÉGORIE (bodies, heads, hair, eyes, brows, noses, mouths, accessories, tops, hands)
  parts/3qd-more.js   pièces complémentaires du portrait détaillé (accessoires, coiffures, yeux/sourcils/bouche, hauts) via les outils exportés QD de 3qd.js
  parts/3qd.js        « Portrait détaillé » (view '3qd', facing 'left') : carte REF découpée de la 2e image de référence (grille 50 placée en OX 7, OY 14), pièces 64×64 au pixel près
  parts/3q/*.js       vue de 3/4 « portrait » tournée à droite, grilles 32×32 doublées (common : g32, art, x2, hash ; bodies BODY3Q + torso/neck ; heads + headMask ; face : yeux/sourcils/nez/bouches/barbes ; hair ; tops ; accessories)
js/pngtuber/
  engine.js           moteur d'avatar AUTONOME (copié par toString dans l'avatar .html : aucune dépendance)
  effects.js          effets (confettis, émotes, ambiances, voix, transformations/tenues TF : recoloration pixel par pixel + éléments calés sur la tête et les épaules détectées par info(), exposées au moteur par fx.look()) et décors animés : createEffects AUTONOME aussi ; grille de pixels alignée sur l'avatar ; réglages doc.pngtuber.effects (effectsConfig dans assets.js), ambiance propre au profil (profile.fxAmbient)
  assets.js           overrides (expression, bouche closed/half/open, clignement), images, réglages
  formats.js          formats de scène (FORMATS : 1080p, vertical…), ANCHORS, layoutScene/applyAnchor (éditeur et capture)
  decklink.js         liaison avec le plugin Stream Deck : createDeckLink AUTONOME (WebSocket ws://127.0.0.1:39217, catalogue + état, commandes -> engine.command) ; active si doc.pngtuber.deck (ou ?deck=1)
  streamdeck.js       icônes Stream Deck 144×144 (effets dessinés sur une grille de 24, décors via sceneThumb) et ZIP ; scripts/make-streamdeck.js régénère le dossier stream-deck/
  pngtuber.js         fenêtre PNGtuber de l'éditeur ; capture.js + capture.html : fenêtre de capture OBS
  standalone.js       export de l'avatar .html autonome
capture.html          page de capture (lit IndexedDB, suit l'éditeur via BroadcastChannel « pixel-atelier »)
js/storage/           db.js (IndexedDB), serialize.js, storage.js (autosave incrémental), project-file.js (fichiers, File System Access), aseprite.js (import .ase), projects-ui.js
js/export/psd.js      export Photoshop (calques, dossiers « lsct », noms Unicode « luni »)
js/ui/tilemap.js      carte de tuiles : jeu de tuiles = dessin découpé (tileset), doc.tilemaps [{ id, name, tw, th, cols, rows, cells }] (cells remplacé à chaque trait), export PNG et Tiled (.tmj)
js/storage/backup.js  sauvegardes : dossier (showDirectoryPicker, handle dans kv « backup:dir »), Google Drive (OAuth jeton via oauth.html, drive.file), ZIP de tous les projets, restauration ; backup-ui.js = onglet Paramètres > Sauvegarde
js/ui/keycapture.js   raccourcis PNGtuber : touche simple ou combinaison (« Ctrl+Maj+1 »), capture (captureCombo), conflits (keyOwner) ; même lecture que engine.js (chiffres lus sur la touche physique)
js/ui/guide.js        fenêtre « Guide » (sommaire, recherche, boutons « Essayer ») ; contenu bilingue dans guide-content.js (paires T(fr, en), **gras**, [[touche]])
js/ui/history-panel.js, js/ui/i18n.js + i18n-en.js, shortcuts.js (touches simples personnalisables : singleKeyActions)
js/ui/settings.js     fenêtre Paramètres ; thèmes (THEMES) appliqués par applyAppearance() via des variables CSS sur <html> ; SETTING_KEYS = réglages exportables
js/ui/toolbar.js      outils regroupés (TOOL_GROUPS) avec menu de groupe, barre d'options contextuelle
stream-deck/plugin/   plugin Stream Deck (Node, SANS dépendance) : com.pixelatelier.avatar.sdPlugin (manifest.json, bin/plugin.js, bin/ws.js WebSocket minimal, ui/inspector.html) ; `node scripts/make-streamdeck-plugin.js` régénère les images, le paquet stream-deck/com.pixelatelier.avatar.streamDeckPlugin et stream-deck/version.json (à relancer après toute modification du plugin ; augmenter VERSION de bin/plugin.js et Version du manifest : les plugins installés proposent alors la mise à jour) ; commandes d'effet : mode toggle | timed (duration) | hold ; test : scripts/audit/deck.js (faux logiciel Stream Deck)
scripts/sw-files.mjs  vérifie ou régénère la liste de précache de sw.js
icone-a-deposer/      l'utilisateur y dépose l'icône de l'appli ; `python3 scripts/make-icons.py` fabrique toutes les tailles dans icons/ (192, 512, maskable, apple-touch, favicons ; pixel art agrandi sans flou), puis sw-files --write et VERSION
scripts/audit/        batterie de tests Playwright (run.sh, voir son README)
```

### Modèle de document

- `doc.nodes : Map<id, node>`, racine `root`. Les enfants d'un groupe sont rangés **du bas vers le haut** ; le panneau les affiche dans l'ordre inverse.
- Un calque contient `cels[frame]` (un `Uint32Array` de taille w×h par frame, créé dès le départ), `opacity`, `visible`, `locked`, `reference`, `part` (métadonnées de bibliothèque : `pieceId`, `category`, `z`, `state`).
- Un groupe avec `variant: true` n'affiche que `active`. `role` vaut `eyes`, `mouth` ou `brows` pour les pièces de la bibliothèque.
- Un profil (tenue / personnage) : `doc.profiles = [{ id, name, key ('F13'…'F24'), visibility: { nodeId: bool }, states: { groupId: childId }, pngtuber: { mouthGroup, mouthOpen, … } }]`. `renderList({ visibility })` applique les visibilités d'un profil sans toucher au document. Côté PNGtuber, une image se décrit par (profil, expression, bouche, clignement) : `avatarRender()` dans assets.js.
- Une expression a la forme `{ id, name, states: { groupId: childId }, key, hold }` (`hold` : expression temporaire tant que la touche est maintenue).
- Animation : `doc.tags = [{ id, name, from, to, color }]` (indices d'images inclus). Les **images liées** partagent le même `Uint32Array` dans `layer.cels` ; la sérialisation les décrit par `celLinks` (`'calque:image' -> 'calque:imageSource'`) et ne stocke que la cel source. Toute opération d'image doit décaler les balises (voir timeline.js).
- `doc.renderList({ overrides, includeReference, root, ignoreVisibility, frame })` donne les calques à composer.
- Calque de référence « net » : `reference: true` + `refImg: { src (dataURL), w, h, x, y, scale }` (coordonnées en pixels du document). Il est dessiné par le renderer en pleine résolution, sous le dessin s'il est placé sous le premier calque normal, sinon par-dessus. Il n'est jamais exporté. `refImg` est remplacé (jamais modifié en place) pour rester compatible avec les instantanés d'historique.

### Stockage

IndexedDB `pixel-atelier` v2 : `projects` (structure sans pixels + `celKeys`), `cels` (un enregistrement par cel, clé `projet|calque|image`), `meta` (liste + miniature), `library`, `kv`. Seules les cels modifiées (`markDirty`) ou déplacées sont réécrites. Un contenu flottant non validé est inclus dans la sauvegarde. Les anciens enregistrements (pixels dans `projects`) restent lisibles.

### Bibliothèque : ajouter une pièce

Une pièce est `{ id, name, category, build(ctx) => [{ name, z, grid } | { name, z, role, variants: [{ name, state, grid }] }] }`.

- Gabarit 64×64 : tête en x 20–43, y 11–37 ; yeux vers y 23–27 (centres x 26 et 37) ; sourcils vers y 18–21 ; nez à x 31–32, y 28–31 ; bouche en x 27–36, y 32–35 ; épaules à partir de y ≈ 44. L'axe de symétrie est x = 31,5.
- Rôles de couleur, convertis par `roleColors()` : `s S k r` (peau), `h H j q` (cheveux), `w e E p l` (yeux et encre), `m t T` (bouche), `c C x` (vêtements), `a A y` (accessoires), `g` (verre).
- Les états de variantes reconnus par le PNGtuber et les expressions par défaut sont : yeux `open/closed/happy/surprised`, bouche `closed/open/smile/sad/surprised`, sourcils `normal/high/angry/sad`.
- L'ordre d'empilement suit `Z` dans `builder.js`. Les coiffures produisent un calque arrière (sous la tête) et un calque avant.
- **Vues** : une pièce peut porter `view: '3q'` ou `view: '3qd'` (sinon vue de face). `VIEWS`, `VIEW_BASE` (mannequin et base auto par vue), `docView(doc)` et `bodyTypeForView()` sont dans library.js ; la bibliothèque et « Nouveau personnage » filtrent par vue (`DEFAULT_CHARACTER_3Q`). Style « portrait » de 3/4 (d'après l'image de référence de l'utilisateur) : chaque pièce est dessinée sur une **grille 32×32 puis doublée** (`x2()` dans parts/3q/common.js, pixels 2×2) ; rôles dédiés `o` (contour brun très foncé commun), `M`/`K`/`L` (ombre douce, ombre, reflet de la peau). Repères 32×32 : crâne x 8–23, y 4–20 ; oreille x 9–11, y 12–17 ; profil vertical en x 24 ; sourcils y 10–11 ; yeux y 12–14 (proche x 16–18, lointain x 22–23) ; dessous du nez y 17 ; bouche x 18–23, y 19–21 ; menton y 22–23 ; cou x 11–19 ; épaules y 24–25. `PORTRAIT_COLORS` (character.js) = palette par défaut de cette vue. Physiques 3/4 : `3q-fin`, `3q-moyen`, `3q-costaud`, `3q-rond` (les hauts 3/4 s'y ajustent via `fitsBody`).
- **Orientation** : une pièce de profil a un sens dessiné (`facingOf(piece)` : `piece.facing`, 'right' par défaut pour '3q'). Le personnage du projet a le sien (`doc.charTemplate.facing`, `docFacing(doc)`) ; `insertPiece` retourne en miroir (`flipGrid`) les pièces dessinées dans l'autre sens. `flipDoc(app, 'h')` met à jour `charTemplate` (ox et sens). `buildCharacter({ facing })`.
- Origine du gabarit mémorisée par projet : `doc.charTemplate = { ox, oy, scale, facing? }` (fixée à la première pièce, décalée par les redimensionnements/recadrages). Les **corps entiers** (`tall: true`) utilisent une grille 64×96 dont les 64 premières lignes coïncident avec le buste ; la bibliothèque ajoute des lignes en bas du canevas si besoin. `scale: 2` = gabarit détaillé (grilles agrandies par Scale2x, `scaleGrid`). Changer de corps recrée le vêtement (`fitsBody`).

## Tests manuels et automatiques

Il n'y a pas de framework de test. On vérifie avec Playwright (Chromium déjà installé dans l'environnement cloud) en servant le dossier avec `python3 -m http.server`. `window.pixelAtelier` expose l'objet `app` pour piloter les outils (`app.tools.current.down/move/up(p)`) et vérifier l'état.

**Avant chaque mise en ligne : `scripts/audit/run.sh`** (≈ 200 vérifications : outils à la souris, exports relus, PNGtuber/OBS/avatar, chaque pièce de la bibliothèque, chaque entrée de menu, mobile et tactile, anglais, accessibilité, hors ligne, stockage indisponible, fuzz annuler/rétablir + persistance). Il démarre lui-même le serveur s'il le faut. Un nouveau texte d'interface oublié dans `i18n-en.js` fait échouer `en` ; un `null` ajouté au DOM (par ex. `el.append(cond ? x : null)` : `append` natif écrit « null », contrairement à `h()`) est signalé comme « texte parasite ».

Points à revérifier après une modification importante :
- tactile : 2 doigts (zoom sans tracé), tape à 2 doigts (annuler) ;
- annuler/rétablir de bout en bout ;
- export (relire les PNG/ZIP/GIF, par exemple avec Python/PIL) ;
- fonctionnement hors ligne (service worker).

## Pistes pour la suite

Tuiles animées et retournées dans la carte de tuiles, pièces dessinées à la main pour le gabarit ×2, vêtements spécifiques aux corps entiers (pantalons, jupes), plus de langues.
