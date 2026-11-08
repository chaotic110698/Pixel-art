// Plugin Stream Deck « Pixel Atelier » : pilote l'avatar PNGtuber (fenêtre de capture ou
// avatar .html dans OBS) même quand un jeu est au premier plan.
//
//  logiciel Stream Deck ──(WebSocket, port donné au lancement)──> ce plugin
//  ce plugin ──(WebSocket local ws://127.0.0.1:39217)──> avatar(s) Pixel Atelier
//
// Aucune dépendance : Node.js fourni par le logiciel Stream Deck (6.4 ou plus).
'use strict';

const fs = require('fs');
const path = require('path');
const ws = require('./ws.js');

const ROOT = path.join(__dirname, '..');
const AVATAR_PORT = Number(process.env.PIXEL_ATELIER_PORT) || 39217;
const VERSION = '1.0.0';

// ---------- arguments donnés par le logiciel Stream Deck ----------
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^-+/, '')] = process.argv[i + 1];

// ---------- listes connues sans avatar (effets et fonds de Pixel Atelier) ----------
const EFFECTS = [
  ['confetti', 'Confettis', 'oneshot'], ['hearts', 'Cœurs', 'oneshot'], ['sparkles', 'Étincelles', 'oneshot'], ['fireworks', 'Feu d\'artifice', 'oneshot'],
  ['stars', 'Étoiles filantes', 'oneshot'], ['impact', 'Impact', 'oneshot'], ['bang', 'Point d\'exclamation', 'oneshot'], ['quest', 'Point d\'interrogation', 'oneshot'],
  ['sweat', 'Goutte de gêne', 'oneshot'], ['vein', 'Veine de colère', 'oneshot'], ['tears', 'Larmes', 'oneshot'], ['lines', 'Lignes de choc', 'oneshot'], ['zzz', 'Zzz', 'oneshot'],
  ['snow', 'Neige', 'ambient'], ['rain', 'Pluie', 'ambient'], ['petals', 'Pétales', 'ambient'], ['fireflies', 'Lucioles', 'ambient'], ['bubbles', 'Bulles', 'ambient'], ['flames', 'Flammes', 'ambient'],
].map(([id, name, kind]) => ({ id, name, kind }));
const BACKGROUNDS = [
  ['transparent', 'Transparent'], ['green', 'Vert'], ['blue', 'Bleu'], ['magenta', 'Magenta'], ['black', 'Noir'], ['white', 'Blanc'],
  ['sky', 'Ciel'], ['night', 'Nuit étoilée'], ['sunset', 'Coucher de soleil'], ['aurora', 'Aurore boréale'], ['synthwave', 'Synthwave'], ['city', 'Ville néon'],
  ['space', 'Espace'], ['forest', 'Forêt au crépuscule'], ['mountains', 'Montagnes'], ['beach', 'Plage'], ['underwater', 'Sous l\'eau'], ['pastel', 'Nuages pastel'],
  ['tiles', 'Motif qui défile'], ['room', 'Chambre cosy'],
].map(([id, name]) => ({ id, name }));

// ---------- état ----------
let sd = null; // connexion au logiciel Stream Deck
const avatars = new Set(); // avatars connectés
let catalog = null; // catalogue du dernier avatar connecté
let avatarName = '';
let avState = null; // { expression, profile, background, talking, ambient[] }
const contexts = new Map(); // touche -> { uuid, kind, settings, title, image, state }

const log = (...a) => console.log('[Pixel Atelier]', ...a);
const kindOf = (uuid) => String(uuid || '').split('.').pop(); // expression | effect | background | profile | talk
const sdSend = (msg) => { if (sd && sd.open) sd.send(JSON.stringify(msg)); };
const toAvatars = (msg) => { const t = JSON.stringify(msg); for (const a of avatars) a.send(t); };
const cat = () => catalog || { expressions: [], profiles: [], effects: EFFECTS, backgrounds: BACKGROUNDS };

// ---------- images des touches ----------
const imgCache = new Map();
function image(rel) {
  if (imgCache.has(rel)) return imgCache.get(rel);
  let data = null;
  try { data = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, rel)).toString('base64'); } catch (e) { /* image absente */ }
  imgCache.set(rel, data);
  return data;
}

function titleFor(c) {
  const s = c.settings || {};
  const find = (list, id) => (list || []).find((x) => x.id === id);
  if (c.kind === 'expression') return s.id ? (find(cat().expressions, s.id) || {}).name || s.name || '?' : 'Normal';
  if (c.kind === 'profile') return s.id ? (find(cat().profiles, s.id) || {}).name || s.name || '?' : 'Défaut';
  if (c.kind === 'talk') return s.mode === 'toggle' ? 'Parler\n(bascule)' : 'Parler';
  return ''; // effets et fonds : l'icône suffit
}
function imageFor(c) {
  const id = (c.settings || {}).id;
  if (c.kind === 'effect' && id) return `imgs/fx/${id}`;
  if (c.kind === 'background' && id) return `imgs/bg/${id}`;
  return null; // image par défaut du manifeste
}
function isActive(c) {
  if (!avState) return false;
  const s = c.settings || {};
  if (c.kind === 'expression') return (s.id || null) === (avState.expression || null);
  if (c.kind === 'profile') return (s.id || null) === (avState.profile || null);
  if (c.kind === 'background') return !!s.id && s.id === avState.background;
  if (c.kind === 'effect') return (avState.ambient || []).includes(s.id);
  if (c.kind === 'talk') return !!avState.talking;
  return false;
}

/** Met à jour titre, image et état (allumé / éteint) d'une touche, seulement si nécessaire. */
function render(context) {
  const c = contexts.get(context);
  if (!c) return;
  const title = titleFor(c);
  if (title !== c.title) {
    c.title = title;
    sdSend({ event: 'setTitle', context, payload: { title, target: 0 } });
  }
  const img = imageFor(c);
  if (img !== c.image) {
    c.image = img;
    for (const state of [0, 1]) {
      const data = img ? image(`${img}${state ? '_on' : ''}.png`) : null;
      sdSend({ event: 'setImage', context, payload: data ? { image: data, target: 0, state } : { target: 0, state } }); // sans image : celle du manifeste
    }
  }
  const state = isActive(c) ? 1 : 0;
  if (state !== c.state) {
    c.state = state;
    sdSend({ event: 'setState', context, payload: { state } });
  }
}
const renderAll = () => { for (const k of contexts.keys()) render(k); };

/** Données de l'inspecteur de propriétés (listes déroulantes, état de la connexion). */
function toInspector(context) {
  const c = contexts.get(context);
  if (!c) return;
  sdSend({ event: 'sendToPropertyInspector', action: c.uuid, context, payload: { type: 'catalog', connected: avatars.size > 0, name: avatarName, catalog: cat(), port: AVATAR_PORT, version: VERSION } });
}
const toAllInspectors = () => { for (const k of contexts.keys()) toInspector(k); };

// ---------- appuis sur les touches ----------
function press(context, down) {
  const c = contexts.get(context);
  if (!c) return;
  const s = c.settings || {};
  let cmd = null;
  if (c.kind === 'expression') {
    const hold = s.mode === 'hold';
    if (!down && !hold) return;
    cmd = { action: 'expression', id: s.id || null, down, hold };
  } else if (c.kind === 'talk') {
    const toggle = s.mode === 'toggle';
    if (!down && toggle) return;
    cmd = { action: 'talk', down, toggle };
  } else {
    if (!down) return;
    if (c.kind === 'effect' && !s.id) { sdSend({ event: 'showAlert', context }); return; }
    cmd = { action: c.kind, id: s.id || (c.kind === 'background' ? 'green' : null), down: true };
  }
  if (!avatars.size) {
    if (down) sdSend({ event: 'showAlert', context }); // aucun avatar ouvert
    return;
  }
  toAvatars({ type: 'cmd', ...cmd });
}

// ---------- messages du logiciel Stream Deck ----------
function onStreamDeck(text) {
  let m;
  try { m = JSON.parse(text); } catch (e) { return; }
  const ctx = m.context;
  const payload = m.payload || {};
  switch (m.event) {
    case 'willAppear':
      contexts.set(ctx, { uuid: m.action, kind: kindOf(m.action), settings: payload.settings || {}, title: undefined, image: undefined, state: -1 });
      render(ctx);
      break;
    case 'willDisappear':
      contexts.delete(ctx);
      break;
    case 'didReceiveSettings': {
      const c = contexts.get(ctx);
      if (c) { c.settings = payload.settings || {}; render(ctx); }
      break;
    }
    case 'keyDown':
      press(ctx, true);
      break;
    case 'keyUp':
      press(ctx, false);
      break;
    case 'propertyInspectorDidAppear':
      toInspector(ctx);
      break;
    case 'sendToPlugin':
      if (payload.type === 'catalog?') {
        if (avatars.size) toAvatars({ type: 'catalog?' });
        toInspector(ctx);
      }
      break;
    default:
  }
}

function connectStreamDeck() {
  if (!args.port || !args.pluginUUID) {
    log('lancé sans le logiciel Stream Deck : seul le serveur des avatars est actif (mode test)');
    return;
  }
  ws.connect(`ws://127.0.0.1:${args.port}`).then((conn) => {
    sd = conn;
    sd.send(JSON.stringify({ event: args.registerEvent || 'registerPlugin', uuid: args.pluginUUID }));
    sd.on('message', onStreamDeck);
    sd.on('close', () => { log('logiciel Stream Deck fermé'); process.exit(0); });
    log('connecté au logiciel Stream Deck');
  }).catch((err) => { log('connexion au logiciel Stream Deck impossible', err.message); setTimeout(connectStreamDeck, 2000); });
}

// ---------- serveur local pour les avatars ----------
/** Pages autorisées : fichier local (avatar .html dans OBS), localhost, sites GitHub Pages. */
function acceptOrigin(origin) {
  if (!origin || origin === 'null' || origin.startsWith('file://')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return true;
  const extra = (process.env.PIXEL_ATELIER_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return extra.includes(origin);
}

function startAvatarServer() {
  const server = ws.createServer({
    host: '127.0.0.1', port: AVATAR_PORT, accept: acceptOrigin,
    info: () => `Plugin Stream Deck Pixel Atelier ${VERSION} : ${avatars.size} avatar(s) connecté(s).`,
  }, (conn) => {
    avatars.add(conn);
    log('avatar connecté', conn.origin || '(fichier local)');
    conn.on('message', (text) => {
      let m;
      try { m = JSON.parse(text); } catch (e) { return; }
      if (m.type === 'hello') {
        catalog = m.catalog || null;
        avatarName = m.name || '';
        for (const c of contexts.values()) c.title = undefined; // noms à jour
        renderAll();
        toAllInspectors();
      } else if (m.type === 'state') {
        avState = m.state || null;
        renderAll();
      }
    });
    conn.on('close', () => {
      avatars.delete(conn);
      log('avatar déconnecté');
      if (!avatars.size) { avState = null; renderAll(); }
      toAllInspectors();
    });
  });
  server.on('error', (err) => {
    log('port', AVATAR_PORT, 'indisponible :', err.code || err.message, '— nouvel essai dans 5 s');
    setTimeout(startAvatarServer, 5000);
  });
  server.on('listening', () => log('en attente des avatars sur ws://127.0.0.1:' + AVATAR_PORT));
}

startAvatarServer();
connectStreamDeck();
