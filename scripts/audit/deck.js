// Plugin Stream Deck : un faux logiciel Stream Deck lance le vrai plugin (Node), simule les
// appuis sur les touches et vérifie l'avatar (fenêtre de capture, avatar .html autonome) :
// expressions (bascule, temporaire), ambiance, fond, parler, retour d'état des touches,
// inspecteur de propriétés, refus des pages d'autres sites.
const H = require('./h.js');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const ws = require('../../stream-deck/plugin/com.pixelatelier.avatar.sdPlugin/bin/ws.js');

const PLUGIN = path.join(__dirname, '../../stream-deck/plugin/com.pixelatelier.avatar.sdPlugin/bin/plugin.js');
const AV_PORT = 39299, SD_PORT = 39298;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { b, ctx, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);

  // ---------- faux logiciel Stream Deck ----------
  const sent = []; // messages reçus du plugin
  let plug = null;
  const piSent = []; // messages de l'inspecteur de propriétés
  let pi = null;
  const server = ws.createServer({ port: SD_PORT }, (conn) => {
    // 1re connexion : le plugin ; suivantes : l'inspecteur de propriétés
    if (!plug) { plug = conn; conn.on('message', (t) => sent.push(JSON.parse(t))); } else { pi = conn; conn.on('message', (t) => piSent.push(JSON.parse(t))); }
  });
  await new Promise((r) => server.on('listening', r));
  // faux site publiant une version plus récente du plugin (vérification des mises à jour)
  const site = require('http').createServer((req, res) => {
    if (req.url === '/stream-deck/version.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ version: '9.9.9', url: 'stream-deck/x.streamDeckPlugin', notes: 'test' })); } else { res.statusCode = 404; res.end(); }
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const child = spawn(process.execPath, [PLUGIN, '-port', String(SD_PORT), '-pluginUUID', 'TEST', '-registerEvent', 'registerPlugin', '-info', '{}'], { env: { ...process.env, PIXEL_ATELIER_PORT: String(AV_PORT), PIXEL_ATELIER_SITE: `http://127.0.0.1:${site.address().port}/` } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !plug; i++) await wait(100);
  await wait(200);
  check('Le plugin se connecte et s\'enregistre auprès du logiciel Stream Deck', sent.some((m) => m.event === 'registerPlugin' && m.uuid === 'TEST'), out.slice(0, 200));
  const sd = (event, context, extra = {}) => plug.send(JSON.stringify({ event, context, ...extra }));
  const A = (k) => `com.pixelatelier.avatar.${k}`;
  const lastFor = (context, event) => [...sent].reverse().find((m) => m.context === context && m.event === event);
  const until = async (fn, ms = 4000) => { for (let t = 0; t < ms; t += 100) { if (await fn()) return true; await wait(100); } return false; };

  // touche sans avatar : alerte
  sd('willAppear', 'k0', { action: A('effect'), payload: { settings: { id: 'confetti' } } });
  sd('keyDown', 'k0', { action: A('effect'), payload: {} });
  check('Sans avatar ouvert : la touche affiche une alerte', await until(() => sent.some((m) => m.event === 'showAlert' && m.context === 'k0')));

  // ---------- fenêtre de capture ----------
  const info = await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter } = await import('./js/library/character.js');
    const { DEFAULT_COLORS } = await import('./js/library/builder.js');
    const d = buildCharacter({ colors: DEFAULT_COLORS, name: 'Perso Deck' });
    d.pngtuber.deck = true;
    app.setDoc(d);
    await app.storage.saveNow();
    return { id: d.id, ex: d.expressions.map((e) => ({ id: e.id, name: e.name })) };
  });
  const happy = info.ex.find((e) => e.name === 'Content'), sad = info.ex.find((e) => e.name === 'Triste');
  sd('willAppear', 'kExpr', { action: A('expression'), payload: { settings: { id: happy.id } } });
  sd('willAppear', 'kHold', { action: A('expression'), payload: { settings: { id: sad.id, mode: 'hold' } } });
  sd('willAppear', 'kSnow', { action: A('effect'), payload: { settings: { id: 'snow' } } });
  sd('willAppear', 'kBg', { action: A('background'), payload: { settings: { id: 'night' } } });
  sd('willAppear', 'kTalk', { action: A('talk'), payload: { settings: {} } });
  const cap = await ctx.newPage();
  const cerrs = [];
  cap.on('pageerror', (e) => cerrs.push(e.message));
  await cap.goto(`${H.BASE}capture.html?project=${info.id}&bg=green&deckurl=ws://127.0.0.1:${AV_PORT}`);
  const titled = await until(() => (lastFor('kExpr', 'setTitle') || {}).payload?.title === 'Content');
  check('Fenêtre de capture connectée : le nom de l\'expression s\'affiche sur la touche', titled, JSON.stringify(lastFor('kExpr', 'setTitle')));
  check('Les icônes d\'effet et de fond sont posées sur les touches', /^data:image\/png;base64,/.test(lastFor('kSnow', 'setImage')?.payload?.image || '') && /^data:image\/png/.test(lastFor('kBg', 'setImage')?.payload?.image || ''));
  const st = () => cap.evaluate(() => ({ expr: document.getElementById('expr').value, bg: document.getElementById('bg').value }));

  sd('keyDown', 'kExpr', { action: A('expression'), payload: {} });
  sd('keyUp', 'kExpr', { action: A('expression'), payload: {} });
  check('Touche Expression : l\'avatar change d\'expression', await until(async () => (await st()).expr === happy.id), JSON.stringify(await st()));
  check('La touche de l\'expression active s\'allume', await until(() => (lastFor('kExpr', 'setState') || {}).payload?.state === 1));

  sd('keyDown', 'kHold', { action: A('expression'), payload: {} });
  const during = await until(async () => (await st()).expr === sad.id);
  sd('keyUp', 'kHold', { action: A('expression'), payload: {} });
  const after = await until(async () => (await st()).expr === happy.id);
  check('Expression temporaire : tant que la touche est appuyée, puis retour', during && after);

  sd('keyDown', 'kSnow', { action: A('effect'), payload: {} });
  check('Ambiance (neige) allumée, touche éclairée', await until(() => (lastFor('kSnow', 'setState') || {}).payload?.state === 1));
  sd('keyDown', 'kSnow', { action: A('effect'), payload: {} });
  check('Second appui : ambiance éteinte', await until(() => (lastFor('kSnow', 'setState') || {}).payload?.state === 0));

  sd('willAppear', 'kDemon', { action: A('effect'), payload: { settings: { id: 'demon' } } });
  sd('keyDown', 'kDemon', { action: A('effect'), payload: {} });
  const demonOn = await until(() => (lastFor('kDemon', 'setState') || {}).payload?.state === 1);
  sd('keyDown', 'kDemon', { action: A('effect'), payload: {} });
  const demonOff = await until(() => (lastFor('kDemon', 'setState') || {}).payload?.state === 0);
  check('Transformation (Démon) allumée puis éteinte depuis le Stream Deck', demonOn && demonOff && /^data:image\/png/.test(lastFor('kDemon', 'setImage')?.payload?.image || ''));
  // touche minutée : Démon pendant 2 s, compte à rebours sur la touche, extinction seule
  sd('willAppear', 'kDemon2', { action: A('effect'), payload: { settings: { id: 'demon', mode: 'timed', duration: 2 } } });
  sd('keyDown', 'kDemon2', { action: A('effect'), payload: {} });
  sd('keyUp', 'kDemon2', { action: A('effect'), payload: {} });
  const tOn = await until(() => (lastFor('kDemon2', 'setState') || {}).payload?.state === 1);
  const countdown = await until(() => /^[12] s$/.test((lastFor('kDemon2', 'setTitle') || {}).payload?.title || ''));
  const tOff = await until(() => (lastFor('kDemon2', 'setState') || {}).payload?.state === 0, 6000);
  check('Touche minutée : Démon pendant 2 s, compte à rebours puis extinction seule', tOn && countdown && tOff && (lastFor('kDemon2', 'setTitle') || {}).payload?.title === '', JSON.stringify([tOn, countdown, tOff, lastFor('kDemon2', 'setTitle')]));
  // touche maintenue : ambiance tant que la touche est enfoncée
  sd('willAppear', 'kRain', { action: A('effect'), payload: { settings: { id: 'rain', mode: 'hold' } } });
  sd('keyDown', 'kRain', { action: A('effect'), payload: {} });
  const rOn = await until(() => (lastFor('kRain', 'setState') || {}).payload?.state === 1);
  sd('keyUp', 'kRain', { action: A('effect'), payload: {} });
  const rOff = await until(() => (lastFor('kRain', 'setState') || {}).payload?.state === 0);
  check('Touche maintenue : pluie tant que la touche est enfoncée', rOn && rOff);
  sd('keyDown', 'kBg', { action: A('background'), payload: {} });
  check('Touche Fond : décor « nuit étoilée » affiché', await until(async () => (await st()).bg === 'night'));

  sd('keyDown', 'kTalk', { action: A('talk'), payload: {} });
  const talking = await until(() => (lastFor('kTalk', 'setState') || {}).payload?.state === 1);
  sd('keyUp', 'kTalk', { action: A('talk'), payload: {} });
  const stopped = await until(() => (lastFor('kTalk', 'setState') || {}).payload?.state === 0);
  check('Touche Parler : l\'avatar parle tant qu\'elle est appuyée', talking && stopped);

  sd('propertyInspectorDidAppear', 'kExpr', { action: A('expression') });
  const piOk = await until(() => { const m = lastFor('kExpr', 'sendToPropertyInspector'); return m && m.payload.connected && m.payload.catalog.expressions.length >= 7 && m.payload.name === 'Perso Deck'; });
  check('Inspecteur de propriétés : listes du projet et état de connexion', piOk);
  sd('sendToPlugin', 'kExpr', { action: A('expression'), payload: { type: 'update?' } });
  const upd = await until(() => { const m = lastFor('kExpr', 'sendToPropertyInspector'); return m && m.payload.update && m.payload.update.version === '9.9.9' && /x\.streamDeckPlugin$/.test(m.payload.update.url); });
  check('Mise à jour : le plugin trouve la version publiée sur le site', upd, JSON.stringify(lastFor('kExpr', 'sendToPropertyInspector')?.payload?.update));

  // inspecteur de propriétés (vraie page du plugin) : listes remplies, choix enregistré
  const insp = await ctx.newPage();
  await insp.goto('file://' + path.join(path.dirname(PLUGIN), '..', 'ui', 'inspector.html'));
  await insp.evaluate(([port, action, id]) => window.connectElgatoStreamDeckSocket(port, 'PI1', 'registerPropertyInspector', '{}', JSON.stringify({ action, context: 'kExpr', payload: { settings: { id } } })), [SD_PORT, A('expression'), happy.id]);
  await until(() => !!pi && piSent.some((m) => m.event === 'sendToPlugin'));
  const catMsg = lastFor('kExpr', 'sendToPropertyInspector');
  pi.send(JSON.stringify({ event: 'sendToPropertyInspector', context: 'PI1', payload: catMsg.payload }));
  const opts = await until(async () => (await insp.evaluate(() => document.querySelectorAll('#item option').length)) >= 8);
  await insp.selectOption('#item', sad.id);
  await insp.selectOption('#mode', 'hold');
  const saved = await until(() => { const m = [...piSent].reverse().find((x) => x.event === 'setSettings'); return m && m.payload.id === sad.id && m.payload.mode === 'hold'; });
  check('Inspecteur : liste des expressions du projet, choix et mode enregistrés', piSent.some((m) => m.event === 'registerPropertyInspector') && opts && saved, JSON.stringify(piSent.slice(-2)));
  await insp.screenshot({ path: `${H.OUT}/deck_inspector.png` });
  await insp.close();
  // inspecteur d'une touche Effet : mode minuté, durée, mise à jour proposée
  const insp2 = await ctx.newPage();
  await insp2.goto('file://' + path.join(path.dirname(PLUGIN), '..', 'ui', 'inspector.html'));
  await insp2.evaluate(([port, action]) => window.connectElgatoStreamDeckSocket(port, 'PI2', 'registerPropertyInspector', '{}', JSON.stringify({ action, context: 'kD', payload: { settings: { id: 'demon', mode: 'timed', duration: 15 } } })), [SD_PORT, A('effect')]);
  await until(() => piSent.filter((m) => m.event === 'registerPropertyInspector').length >= 2);
  const catFx = lastFor('kExpr', 'sendToPropertyInspector');
  pi.send(JSON.stringify({ event: 'sendToPropertyInspector', context: 'PI2', payload: catFx.payload }));
  const fxUi = await until(async () => insp2.evaluate(() => !document.getElementById('row-mode').hidden && !document.getElementById('row-duration').hidden && document.getElementById('duration').value === '15' && !document.getElementById('update').hidden && document.getElementById('mode').value === 'timed'));
  await insp2.selectOption('#mode', 'hold');
  const fxSaved = await until(() => { const m = [...piSent].reverse().find((x) => x.event === 'setSettings'); return m && m.payload.mode === 'hold'; });
  const durHidden = await insp2.evaluate(() => document.getElementById('row-duration').hidden);
  check('Inspecteur d\'effet : modes Bascule / Pendant… / Maintenir, durée, mise à jour proposée', fxUi && fxSaved && durHidden);
  await insp2.selectOption('#mode', 'timed');
  await insp2.screenshot({ path: `${H.OUT}/deck_inspector_fx.png` });
  await insp2.close();

  // une page d'un autre site ne peut pas se connecter
  const refused = await new Promise((resolve) => {
    const s = net.connect(AV_PORT, '127.0.0.1', () => s.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nOrigin: https://site-inconnu.example\r\nSec-WebSocket-Key: ${Buffer.from('0123456789abcdef').toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    s.on('data', (d) => { resolve(/403/.test(String(d))); s.destroy(); });
    s.on('error', () => resolve(false));
  });
  check('Pages d\'autres sites refusées par le plugin', refused);
  check('Fenêtre de capture : aucune erreur', !cerrs.length, cerrs.join(' | '));
  await cap.close();
  check('Avatar fermé : la touche active s\'éteint', await until(() => (lastFor('kExpr', 'setState') || {}).payload?.state === 0));

  // ---------- avatar .html autonome ----------
  const html = await ev(async () => { const { buildStandaloneAvatar } = await import('./js/pngtuber/standalone.js'); return buildStandaloneAvatar(window.pixelAtelier.doc); });
  fs.writeFileSync(`${H.OUT}/avatar_deck.html`, html);
  const av = await ctx.newPage();
  const aerrs = [];
  av.on('pageerror', (e) => aerrs.push(e.message));
  await av.goto(`file://${H.OUT}/avatar_deck.html?bg=green&deckurl=ws://127.0.0.1:${AV_PORT}`);
  const n0 = sent.filter((m) => m.event === 'sendToPropertyInspector').length;
  sd('propertyInspectorDidAppear', 'kExpr', { action: A('expression') });
  await until(() => sent.filter((m) => m.event === 'sendToPropertyInspector').length > n0 && lastFor('kExpr', 'sendToPropertyInspector').payload.connected);
  sd('keyDown', 'kExpr', { action: A('expression'), payload: {} });
  check('Avatar OBS (.html) : connecté et piloté par la touche', await until(async () => (await av.evaluate(() => document.getElementById('expr').value)) === happy.id));
  check('Avatar OBS (.html) : aucune erreur', !aerrs.length, aerrs.join(' | '));
  await av.close();

  // fermeture du logiciel Stream Deck : le plugin s'arrête
  plug.close();
  const exited = await new Promise((r) => { const t = setTimeout(() => r(false), 3000); child.on('exit', () => { clearTimeout(t); r(true); }); });
  check('Le plugin s\'arrête quand le logiciel Stream Deck se ferme', exited);
  if (!exited) child.kill();
  server.close();
  site.close();
  H.summary(errs);
  await b.close();
})();
