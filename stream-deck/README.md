# Icônes Stream Deck — Pixel Atelier

Une icône **PNG 144 × 144** (pixel art net) pour chaque effet du mode PNGtuber (`effets/`)
et chaque décor animé (`fonds/`). Elles conviennent au Stream Deck, au Stream Deck XL et au Stream Deck +.

Le même pack se télécharge depuis le site : **mode PNGtuber > Effets > « Icônes Stream Deck (ZIP) »**.
Celui du site contient en plus un `LISEZMOI.txt` avec les touches choisies dans votre projet.

## Utilisation

1. Dans Pixel Atelier, mode PNGtuber : associez une touche ou une combinaison à un effet
   (Effets > « Touche… ») ou à un fond (Fond > « Touches des fonds… »).
2. Dans le logiciel Stream Deck : glissez une action **Raccourci clavier** (*Hotkey*) sur une touche
   et tapez la même touche ou combinaison (par exemple `Ctrl+Maj+1`).
3. Sur l'icône de la touche : **Définir depuis un fichier** et choisissez l'image correspondante.

La fenêtre qui reçoit la touche (mode PNGtuber, fenêtre de capture ou avatar .html) doit avoir le focus.

Pour régénérer ce dossier après une modification des icônes (`js/pngtuber/streamdeck.js`) :
`node scripts/make-streamdeck.js` (avec le site servi sur le port 8123).
