# Stream Deck — Pixel Atelier

## Plugin Stream Deck (recommandé)

Le fichier **`com.pixelatelier.avatar.streamDeckPlugin`** est un plugin pour le logiciel Stream Deck
(version 6.4 ou plus, Windows 10/11 ou macOS 12+). Il pilote l'avatar **même quand un jeu est au premier plan**,
contrairement aux raccourcis clavier.

### Installation

1. Téléchargez le plugin : mode PNGtuber > Diffusion > **« Télécharger le plugin Stream Deck »**
   (ou ce fichier depuis GitHub), puis **double-cliquez** dessus : le logiciel Stream Deck l'installe.
2. Dans Pixel Atelier, mode PNGtuber > Diffusion : cochez **« Plugin Stream Deck »**.
3. Ouvrez l'avatar : la **fenêtre de capture**, ou l'**avatar OBS (.html)** exporté après avoir coché la case.
4. Dans le logiciel Stream Deck, catégorie **Pixel Atelier**, glissez les actions sur vos touches :
   - **Expression** : bascule, ou temporaire (tant que la touche est appuyée) ;
   - **Effet** : confettis, cœurs… ; pour les ambiances (neige, pluie…), transformations (démon…) et tenues,
     **Mode** au choix : **Bascule** (allumer / éteindre), **Pendant… secondes** (ex. Démon pendant 15 s,
     compte à rebours sur la touche) ou **Maintenir** (actif tant que la touche est enfoncée) ;
   - **Fond** : couleur unie ou décor animé ;
   - **Profil** : tenue ou personnage ;
   - **Parler** : l'avatar parle tant que la touche est appuyée (ou bascule).
5. Cliquez une touche pour choisir l'expression, l'effet, le fond ou le profil : les listes se remplissent
   avec votre projet quand l'avatar est ouvert.

La touche de l'état en cours s'éclaire. Un point d'exclamation sur une touche signifie qu'aucun avatar
n'est connecté (avatar fermé, ou case « Plugin Stream Deck » décochée).

### Mises à jour

- **Rien à réinstaller pour vos nouveautés** : nouvelles expressions, nouveaux profils, nouveaux effets et
  fonds de Pixel Atelier apparaissent tout seuls dans les listes (l'avatar envoie son catalogue au plugin).
- **Nouvelle version du plugin** (nouveaux modes, icônes) : à partir de la 1.2, le plugin lit
  `stream-deck/version.json` sur le site (au lancement puis toutes les 6 heures, sans rien envoyer).
  L'inspecteur d'une touche affiche alors **« Installer la mise à jour »** : le plugin télécharge le paquet
  et l'ouvre, le logiciel Stream Deck remplace le plugin en **gardant vos touches et leurs réglages**.
- Depuis la 1.1 : téléchargez la nouvelle version et double-cliquez dessus une dernière fois (le mode
  PNGtuber signale un plugin trop ancien sous la case « Plugin Stream Deck »).

### Fonctionnement

Le plugin (`plugin/com.pixelatelier.avatar.sdPlugin`, Node.js fourni par le logiciel Stream Deck,
sans dépendance) ouvre une connexion locale `ws://127.0.0.1:39217`. L'avatar s'y connecte, envoie la
liste de ses expressions, effets, fonds et profils, puis son état ; le plugin lui transmet les appuis.
Rien ne sort de l'ordinateur ; seules les pages locales (fichier, localhost) et les sites `*.github.io`
peuvent se connecter (autres adresses : variable d'environnement `PIXEL_ATELIER_ORIGINS`).

Installation manuelle (si le double-clic ne marche pas) : copiez le dossier
`plugin/com.pixelatelier.avatar.sdPlugin` dans `%APPDATA%\Elgato\StreamDeck\Plugins\` (Windows) ou
`~/Library/Application Support/com.elgato.StreamDeck/Plugins/` (Mac), puis redémarrez le logiciel Stream Deck.

Pour régénérer les images et le paquet après une modification du plugin :
`node scripts/make-streamdeck-plugin.js` (site servi sur le port 8123) ; il écrit aussi `version.json`
(augmentez `VERSION` dans `bin/plugin.js` et `Version` dans `manifest.json`, et décrivez les nouveautés
dans `NOTES` du script). Test : `scripts/audit/run.sh deck`.

## Icônes seules

Une icône **PNG 144 × 144** (pixel art net) pour chaque effet du mode PNGtuber (`effets/`)
et chaque décor animé (`fonds/`), pour une utilisation avec de simples raccourcis clavier.

Le même pack se télécharge depuis le site : **mode PNGtuber > Effets > « Icônes Stream Deck (ZIP) »**.
Celui du site contient en plus un `LISEZMOI.txt` avec les touches choisies dans votre projet.

1. Dans Pixel Atelier, mode PNGtuber : associez une touche ou une combinaison à un effet
   (Effets > « Touche… ») ou à un fond (Fond > « Touches des fonds… »).
2. Dans le logiciel Stream Deck : glissez une action **Raccourci clavier** (*Hotkey*) sur une touche
   et tapez la même touche ou combinaison (par exemple `Ctrl+Maj+1`).
3. Sur l'icône de la touche : **Définir depuis un fichier** et choisissez l'image correspondante.

Avec les raccourcis clavier, la fenêtre qui reçoit la touche (mode PNGtuber, fenêtre de capture ou
avatar .html) doit avoir le focus : c'est pour éviter cette contrainte que le plugin existe.

Pour régénérer les icônes : `node scripts/make-streamdeck.js` (site servi sur le port 8123).
