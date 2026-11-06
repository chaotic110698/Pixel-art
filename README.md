# Pixel Atelier

Éditeur de **pixel art** complet, gratuit, **hors ligne** et sans compte, pensé pour créer des personnages **PNGtuber**. Il fonctionne sur téléphone (tactile) comme sur ordinateur (souris et clavier).

100 % statique : HTML, CSS et JavaScript (modules ES), sans framework ni étape de build. Hébergé sur GitHub Pages et installable comme application (PWA).

## Fonctionnalités

- **Canevas** : préréglages 16 à 512 px ou taille libre (largeur ≠ hauteur), fond transparent en damier, redimensionnement avec ancrage, mise à l'échelle, recadrage, miroir et rotation.
- **Outils** : crayon (taille 1 à 64, carré ou rond), gomme, remplissage (contigu ou global, avec tolérance), pipette, ligne, rectangle, ellipse (contour ou plein), sélection rectangulaire, lasso, baguette magique (déplacer, copier, coller, rotation, miroir), symétrie (verticale, horizontale ou les deux), **tramage** (10 motifs, 2 couleurs).
- **Couleurs** : palettes PICO-8, Endesga 32, Game Boy, Sweetie 16, DawnBringer 16, CGA, peaux & cheveux… Sélecteur TSV avec alpha, couleurs récentes, import/export (.hex, .gpl, .json, .pal), extraction d'une palette depuis une image.
- **Historique** illimité en pratique (annuler/rétablir), économe en mémoire, valable pour toutes les actions : pixels, calques, variantes, expressions.
- **Grille modulable** : cellules en largeur et hauteur séparées, décalage, lignes principales tous les N cellules, couleurs, épaisseurs, opacité, aimantation. Réglages enregistrés dans le projet.
- **Calques** : groupes, opacité, verrouillage, fusion, glisser-déposer, calques de référence (semi-transparents, jamais exportés), import d'images.
- **Variantes et expressions** : un groupe de variantes n'affiche qu'un seul enfant à la fois (ex. bouche fermée / ouverte). Les expressions enregistrent une combinaison de variantes (ex. « Content »). On les applique en un clic ou avec une touche.
- **Bibliothèque de pièces originales** : corps, têtes, 14 coiffures, yeux et bouches avec plusieurs états, sourcils, nez, lunettes, chapeaux, oreilles, boucles d'oreilles, vêtements. La recoloration se fait par échange de palette, les pièces restent modifiables pixel par pixel, et l'on peut garder ses propres pièces dans « Ma bibliothèque » (import/export).
- **Nouveau personnage** : une base prête à l'emploi avec yeux, bouche et sourcils en variantes, plus 7 expressions associées aux touches 1 à 7.
- **Mode PNGtuber** : fond vert, bleu, magenta, noir, blanc, damier ou image. La bouche suit le micro (traitement **local**, seuil réglable), les yeux clignent automatiquement, le personnage rebondit quand on parle, les expressions se déclenchent au clavier, et un plein écran sert à la capture dans OBS.
- **Mode tuiles** : aperçu en mosaïque 3×3 et dessin enroulé sur les bords.
- **Animation** : images multiples, lecture, FPS, durée par image, onion skin.
- **Export** sans aucun lissage et avec la transparence préservée, à l'échelle ×1 à ×64 :
  - image PNG ;
  - calque par calque (ZIP, toutes les images à la taille du canevas) ;
  - par variante, par expression, toutes les combinaisons (avec confirmation si elles sont nombreuses) ;
  - pack PNGtuber complet avec `manifest.json` ;
  - spritesheet ou planche de tuiles (+ JSON), GIF animé, images séparées ;
  - au choix, recadrage commun (l'alignement est conservé) ou image par image.
- **Projets** : sauvegarde automatique dans le navigateur (IndexedDB), liste avec miniatures, duplication, suppression, fichier projet `.pxa.json` sans perte (téléchargement et ouverture).
- Interface en français, tutoriel au premier lancement, thème clair ou sombre.

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
| Tab | Variante suivante | T | Mode tuiles |
| Ctrl+S | Enregistrer | ? | Tous les raccourcis |

**Tactile** : 1 doigt pour dessiner, 2 doigts pour zoomer ou déplacer, tape à 2 doigts pour annuler, tape à 3 doigts pour rétablir, appui long sur une couleur pour la choisir comme couleur B.

## Lancer en local

Les modules ES demandent un serveur HTTP (le protocole `file://` ne fonctionne pas) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déploiement sur GitHub Pages

1. Sur GitHub : **Settings → Pages**.
2. *Source* : « Deploy from a branch ». Choisir la branche (par ex. `main`) et le dossier `/ (root)`.
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
