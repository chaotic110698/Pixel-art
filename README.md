# Pixel Atelier

Éditeur de **pixel art** complet, gratuit, **hors ligne** et sans compte, pensé pour créer des personnages **PNGtuber**. Il fonctionne sur téléphone (tactile) comme sur ordinateur (souris et clavier).

100 % statique : HTML, CSS et JavaScript (modules ES), sans framework ni étape de build. Hébergé sur GitHub Pages et installable comme application (PWA).

## Fonctionnalités

- **Canevas** : préréglages 16 à 512 px ou taille libre (largeur ≠ hauteur), fond transparent en damier, redimensionnement avec ancrage, mise à l'échelle, recadrage, miroir et rotation.
- **Outils** : crayon (taille 1 à 64, carré ou rond, mode **pixel perfect**, mode **remplacer une couleur**), **ombrage** (éclaircit/assombrit en suivant la palette), **dégradé tramé** (linéaire ou radial, Bayer 4×4), gomme, remplissage (contigu ou global, avec tolérance), pipette, ligne, rectangle, ellipse (contour ou plein), sélection rectangulaire, lasso, baguette magique (déplacer, copier, coller, miroir, rotation 90° et **rotation libre / mise à l'échelle** avec lissage pixel art de type RotSprite), **contour automatique**, symétrie (verticale, horizontale ou les deux), **tramage** (10 motifs, 2 couleurs).
- **Couleurs** : palettes PICO-8, Endesga 32, Game Boy, Sweetie 16, DawnBringer 16, CGA, peaux & cheveux… Sélecteur TSV avec alpha, couleurs récentes, import/export (.hex, .gpl, .json, .pal), extraction d'une palette depuis une image.
- **Historique** illimité en pratique (annuler/rétablir), économe en mémoire, valable pour toutes les actions : pixels, sélections, calques, variantes, expressions, palette, grille, nom du projet, réglages d'animation et PNGtuber.
- **Grille modulable** : cellules en largeur et hauteur séparées, décalage, lignes principales tous les N cellules, couleurs, épaisseurs, opacité. Aimantation des lignes, formes, sélections (rectangle et lasso) et déplacements. Réglages enregistrés dans le projet.
- **Calques** : groupes, opacité, verrouillage, fusion, glisser-déposer, **sélection multiple** (Ctrl/Maj + clic ou mode tactile : grouper, fusionner, dupliquer, masquer, supprimer), import d'images, et **images de référence nettes** : affichées en pleine résolution au-dessus ou en dessous du dessin, déplaçables et redimensionnables, jamais exportées.
- **Variantes et expressions** : un groupe de variantes n'affiche qu'un seul enfant à la fois (ex. bouche fermée / ouverte). Les expressions enregistrent une combinaison de variantes (ex. « Content »). On les applique en un clic ou avec une touche.
- **Bibliothèque de pièces originales** : corps, têtes, 14 coiffures, yeux et bouches avec plusieurs états, sourcils, nez, lunettes, chapeaux, oreilles, boucles d'oreilles, vêtements. La recoloration se fait par échange de palette, les pièces restent modifiables pixel par pixel, et l'on peut garder ses propres pièces dans « Ma bibliothèque » (import/export).
- **Nouveau personnage** : une base prête à l'emploi avec yeux, bouche et sourcils en variantes, plus 7 expressions associées aux touches 1 à 7.
- **Mode PNGtuber** : fond vert, bleu, magenta, noir, blanc, damier ou image. La bouche suit le micro (traitement **local**) avec 2 ou 3 états (fermée, entrouverte, ouverte) et deux seuils réglables. Les yeux clignent automatiquement ; respiration, rebond, secousse quand on crie et inclinaison sont activables. Les expressions se déclenchent au clavier, normalement ou de façon **temporaire** (tant que la touche est maintenue).
- **Diffusion dans OBS** :
  - une **fenêtre de capture** qui n'affiche que l'avatar et suit l'éditeur (expressions, enregistrements) ;
  - un **avatar autonome `.html`** à ajouter comme source navigateur (fond transparent, paramètres `?bg=`, `?mic=1`, `?ui=0`, `?scale=`) ;
  - des **images prêtes pour les logiciels PNGtuber** (repos / parle / entrouverte / clignement, par expression).
- **Mode tuiles** : aperçu en mosaïque 3×3 et dessin enroulé sur les bords.
- **Animation** : images multiples, lecture, FPS, durée par image, onion skin, **balises** (« Marche », « Saut »…) avec lecture en boucle d'une balise ou d'une plage (Maj+clic), **images liées** (mêmes pixels, modifiés ensemble), export d'**une animation par balise** (GIF, planche + JSON avec frameTags, images).
- **Export** sans aucun lissage et avec la transparence préservée, à l'échelle ×1 à ×64 :
  - image PNG ;
  - calque par calque (ZIP, toutes les images à la taille du canevas) ;
  - par variante, par expression, toutes les combinaisons (avec confirmation si elles sont nombreuses) ;
  - pack PNGtuber complet avec `manifest.json` ;
  - spritesheet ou planche de tuiles (+ JSON), GIF animé, images séparées ;
  - au choix, recadrage commun (l'alignement est conservé) ou image par image.
- **Projets** : sauvegarde automatique et incrémentale dans le navigateur (IndexedDB), liste avec miniatures, renommage, duplication, suppression, fichier projet `.pxa.json` sans perte (téléchargement et ouverture).
- **Confort** : raccourcis personnalisables, panneau **Historique** (revenir à n'importe quelle étape), enregistrement direct dans un fichier de l'ordinateur (Chrome/Edge), import de fichiers **Aseprite** (.ase), export **PSD** (calques et groupes), interface en **français ou anglais** (menu ☰).
- Tutoriel au premier lancement, thème clair ou sombre.

## Raccourcis principaux

| Touche | Action | Touche | Action |
|---|---|---|---|
| B | Crayon | Ctrl+Z / Ctrl+Y | Annuler / rétablir |
| E | Gomme | Ctrl+C / X / V | Copier / couper / coller |
| G | Remplissage | Ctrl+A / Ctrl+D | Tout sélectionner / désélectionner |
| I (ou Alt) | Pipette | Suppr | Effacer la sélection |
| L | Ligne | Entrée | Valider le déplacement |
| U | Rectangle | Flèches | Déplacer la sélection |
| O | Ellipse | [ / ] | Taille du pinceau |
| M | Sélection rectangle | X | Échanger les couleurs A/B |
| Q | Lasso | D | Tramage |
| W | Baguette magique | S | Symétrie |
| V | Déplacer | # | Grille |
| H / Espace | Déplacer la vue | 0 / 1 | Ajuster / taille réelle |
| K | Ombrage | J | Dégradé tramé |
| Ctrl+T | Rotation libre / échelle | Ctrl+clic (calques) | Sélection multiple |
| Tab | Variante suivante | T | Mode tuiles |
| Ctrl+S | Enregistrer | ? | Tous les raccourcis |

**Tactile** : la barre du bas donne accès aux couleurs, calques, expressions, à la bibliothèque (« Pièces ») et au mode PNGtuber. 1 doigt pour dessiner, 2 doigts pour zoomer ou déplacer, tape à 2 doigts pour annuler, tape à 3 doigts pour rétablir, appui long sur une couleur pour la choisir comme couleur B.

## Lancer en local

Les modules ES demandent un serveur HTTP (le protocole `file://` ne fonctionne pas) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déploiement sur GitHub Pages

1. Sur GitHub : **Settings → Pages**.
2. *Source* : « Deploy from a branch ». Choisir la branche `main` et le dossier `/ (root)`.
3. Le site est alors disponible à l'adresse `https://<utilisateur>.github.io/<dépôt>/`.

Aucune étape de build n'est nécessaire. Le fichier `.nojekyll` désactive le traitement Jekyll.

À chaque mise en ligne qui modifie des fichiers :

```bash
node scripts/sw-files.mjs --write   # met à jour la liste hors ligne du service worker
```

Pensez aussi à incrémenter `VERSION` dans `sw.js` pour que les utilisateurs reçoivent la nouvelle version.

## Ajouter des pièces à la bibliothèque

Chaque catégorie a son propre fichier dans `js/library/parts/` (`hair.js`, `eyes.js`, `mouths.js`…). Une pièce se dessine sur un gabarit 64×64 avec des « rôles » de couleur (`s` peau, `h` cheveux, `p` encre…), à l'aide de formes (`ell`, `rect`, `poly`) ou de motifs ASCII. Voir `js/library/builder.js` et `CLAUDE.md`.

## Confidentialité

Tout reste sur votre appareil : aucun serveur, aucun compte, aucune télémétrie. Le micro du mode PNGtuber est analysé localement et n'est jamais enregistré.
