# Tests d'audit

Tests de bout en bout pilotés par Playwright (Chromium), sans dépendance dans le site.
`./run.sh` lance tout ; `./run.sh tools fuzz` lance une sélection. Les fichiers produits
(exports, captures d'écran) vont dans `$TMPDIR/pixel-atelier-audit`.

| Test | Contenu |
|---|---|
| tools | outils à la souris, annuler/rétablir, sélection, calques, opérations d'image, raccourcis |
| export | animation, 13 exports relus (python3 + PIL si présents), sauvegarde/rechargement, fichier projet |
| files | ouverture ZIP et Aseprite (après `export`), onglets des Paramètres |
| pt | mode PNGtuber (face et 3/4), capture OBS, avatar .html autonome |
| fx | effets PNGtuber (13 ponctuels, ambiances, voix, touches, expressions, annuler) et 14 décors animés, capture et avatar .html |
| lib | chaque pièce de la bibliothèque et chaque état, 30 personnages au hasard, recoloration |
| ui | chaque entrée du menu, boutons des panneaux, thèmes, aide |
| guide | guide complet : 5 accès (barre d'outils, barre du haut, F1, « ? », menu), 16 chapitres, recherche, boutons « Essayer », mobile, anglais |
| misc | hors ligne (service worker), tuiles, grille, historique, expressions, tutoriel |
| mobile | 4 appareils : débordements, barre du bas, fenêtres, tactile (1 et 2 doigts) |
| a11y | libellés accessibles, saisie isolée des raccourcis |
| en | textes restés en français dans l'interface anglaise |
| sizes | mise en page à 5 tailles d'écran |
| storage | démarrage sans IndexedDB / localStorage |
| fuzz | centaines d'actions aléatoires : annuler/rétablir exacts et persistance |

Un détecteur signale aussi tout texte parasite (« null », « undefined », « NaN ») ajouté au DOM.
