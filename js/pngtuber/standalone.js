// Avatar autonome : un seul fichier .html (images intégrées + moteur), à ajouter
// dans OBS comme « Source navigateur » (fichier local) ou à ouvrir dans un navigateur.
// Paramètres d'URL : ?bg=transparent|green|blue|magenta|black|white|<hex>  &mic=1  &ui=0  &scale=N  &profile=<nom ou F13…>

import { createAvatar } from './engine.js';
import { buildAvatarImages, avatarExpressions, avatarSettings, initialExpression, avatarProfiles } from './assets.js';

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

export async function buildStandaloneAvatar(doc) {
  const { files, map } = await buildAvatarImages(doc);
  const settings = avatarSettings(doc);
  // demi-ouverture disponible selon le profil
  const halfByProfile = {};
  for (const p of [null, ...doc.profiles.map((x) => x.id)]) halfByProfile[p || ''] = avatarSettings(doc, p).hasHalf;
  const data = {
    profiles: avatarProfiles(doc),
    halfByProfile,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    files,
    map,
    expressions: avatarExpressions(doc),
    initial: initialExpression(doc),
    settings: {
      threshold: settings.threshold, threshold2: settings.threshold2, hasHalf: settings.hasHalf,
      blinkEvery: settings.blinkEvery, blinkDuration: settings.blinkDuration,
      bounce: settings.bounce, breathe: settings.breathe, shake: settings.shake, tilt: settings.tilt, scale: 0,
    },
  };
  // JSON sûr dans un <script> (pas de « </script> » possible)
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.name)} — avatar PNGtuber</title>
<!-- Généré par Pixel Atelier. Tout fonctionne hors ligne ; le micro est analysé localement. -->
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  #stage { position: fixed; inset: 0; display: flex; align-items: flex-end; justify-content: center; }
  canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
  #ui { position: fixed; left: 8px; top: 8px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
        font: 13px system-ui, sans-serif; color: #fff; background: rgba(20,20,30,.75); padding: 6px 8px; border-radius: 10px; }
  #ui button { font: inherit; border: 0; border-radius: 8px; padding: 6px 10px; background: #ff5ab4; color: #fff; cursor: pointer; }
  #ui select { font: inherit; border-radius: 6px; }
  body.clean #ui { display: none; }
</style>
</head>
<body>
<div id="stage"><canvas></canvas></div>
<div id="ui">
  <button id="mic">🎤 Activer le micro</button>
  <select id="prof" aria-label="Profil"></select>
  <select id="expr" aria-label="Expression"></select>
  <span>Espace = parler · F13–F24 = profils · H = masquer</span>
</div>
<script>
const DATA = ${json};
const createAvatar = (${createAvatar.toString()});
(function () {
  const params = new URLSearchParams(location.search);
  const BG = { green: '#00ff00', blue: '#0047bb', magenta: '#ff00ff', black: '#000000', white: '#ffffff' };
  const bg = params.get('bg') || 'transparent';
  document.body.style.background = bg === 'transparent' ? 'transparent' : (BG[bg] || (/^[0-9a-f]{3,8}$/i.test(bg) ? '#' + bg : bg));
  if (params.get('ui') === '0') document.body.classList.add('clean');
  const scale = parseInt(params.get('scale'), 10);
  if (scale > 0) DATA.settings.scale = scale;
  const imgs = {};
  for (const [sig, src] of Object.entries(DATA.files)) { const im = new Image(); im.src = src; imgs[sig] = im; }
  const getImage = (pf, ex, mouth, blink) => {
    const k = (pf || '') + '|' + (ex || '') + '|';
    const sig = DATA.map[k + mouth + '|' + (blink ? 1 : 0)] || DATA.map[k + 'open|' + (blink ? 1 : 0)];
    const im = imgs[sig];
    return im && im.complete && im.naturalWidth ? im : null;
  };
  const sel = document.getElementById('expr');
  const optNone = document.createElement('option');
  optNone.value = ''; optNone.textContent = '(état par défaut)';
  sel.append(optNone);
  for (const e of DATA.expressions) {
    const o = document.createElement('option');
    o.value = e.id; o.textContent = e.name + (e.key ? ' [' + e.key + ']' : '');
    sel.append(o);
  }
  const psel = document.getElementById('prof');
  const pNone = document.createElement('option');
  pNone.value = ''; pNone.textContent = '(profil par défaut)';
  psel.append(pNone);
  for (const p of DATA.profiles) {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.name + (p.key ? ' [' + p.key + ']' : '');
    psel.append(o);
  }
  if (!DATA.profiles.length) psel.hidden = true;
  const av = createAvatar({
    canvas: document.querySelector('canvas'),
    stage: document.getElementById('stage'),
    width: DATA.width,
    height: DATA.height,
    getImage,
    cfg: (pf) => Object.assign({}, DATA.settings, { hasHalf: !!DATA.halfByProfile[pf || ''] }),
    expressions: () => DATA.expressions,
    profiles: () => DATA.profiles,
    initialExpression: DATA.initial,
    onChange: (s) => { sel.value = s.expression || ''; psel.value = s.profile || ''; },
  });
  psel.addEventListener('change', () => av.setProfile(psel.value || null));
  const startProfile = params.get('profile');
  if (startProfile) { const p = DATA.profiles.find((x) => x.id === startProfile || x.name === startProfile || x.key === startProfile); if (p) av.setProfile(p.id); }
  sel.value = DATA.initial || '';
  sel.addEventListener('change', () => av.setExpression(sel.value || null));
  av.attachKeys(window);
  window.addEventListener('keydown', (e) => { if (e.key === 'h' || e.key === 'H') { if (!DATA.expressions.some((x) => x.key === 'H')) document.body.classList.toggle('clean'); } });
  const micBtn = document.getElementById('mic');
  const mic = () => av.startMic().then(() => { micBtn.textContent = '🎤 Micro actif'; }).catch((err) => { micBtn.textContent = '🎤 Micro refusé : ' + err.name; });
  micBtn.addEventListener('click', mic);
  if (params.get('mic') === '1') mic();
  av.start();
})();
</script>
</body>
</html>
`;
}
