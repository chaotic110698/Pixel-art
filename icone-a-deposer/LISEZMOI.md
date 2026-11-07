# Déposez ici l'icône de l'application

Mettez dans ce dossier **une image carrée** : l'icône de Pixel Atelier (écran d'accueil du
téléphone, onglet du navigateur, application installée).

## Ce qu'il faut déposer

- **Format** : PNG de préférence (JPEG et WebP acceptés). Le fond transparent est accepté.
- **Taille** : idéalement **512 × 512 px ou plus**. Une icône en pixel art toute petite
  (16×16, 32×32, 64×64…) convient aussi : elle sera agrandie au plus proche voisin, sans flou.
- **Carrée** : sinon elle est centrée sur un carré.
- Le nom du fichier n'a pas d'importance (par exemple `icone.png`).
- Facultatif : un second fichier nommé `icone-maskable.png` si vous voulez une version
  spéciale pour Android (icône « adaptative » découpée en rond ou en goutte). Sinon elle est
  créée automatiquement avec une marge de sécurité.
- Facultatif : `icone-pleine.png`, version carrée sans transparence pour l'iPhone (iOS arrondit
  lui-même les coins).

## Icône actuelle

`original/IMG_5208.png` est l'image déposée. Claude en a tiré `icone.png` (la tuile sombre
arrondie, fond transparent), `icone-pleine.png` (iPhone) et `icone-maskable.png` (Android,
contenu dans la zone de sécurité). Pour changer d'icône, remplacez ces fichiers.

## Ensuite

Prévenez Claude (« l'icône est déposée ») : il lance

```
python3 scripts/make-icons.py
```

qui fabrique toutes les tailles dans `icons/` (192, 512, maskable, Apple 180, favicon 32 et 16),
puis met à jour le service worker et publie le site.
