// Effets et décors PNGtuber : chaque effet, chaque décor, touches, cri, expressions,
// réglages enregistrés et annulables, fenêtre de capture et avatar .html.
const H = require('./h.js');
const fs = require('fs');
(async () => {
  const { b, ctx, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter, DEFAULT_CHARACTER_3Q, PORTRAIT_COLORS } = await import('./js/library/character.js');
    app.setDoc(buildCharacter({ colors: PORTRAIT_COLORS, sel: DEFAULT_CHARACTER_3Q, name: 'FX' }));
    await app.storage.saveNow();
  });
  await ev(() => window.pixelAtelier.actions.openPngtuber());
  await p.waitForTimeout(800);
  // nombre de pixels dessinés sur les calques d'effets
  const fxPixels = () => ev(() => {
    let n = 0;
    for (const c of document.querySelectorAll('.pt-scene .fx-back, .pt-scene .fx-front')) {
      if (!c.width) continue;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 16) if (d[i]) n++;
    }
    return n;
  });
  const { EFFECTS, SCENE_NAMES } = await ev(async () => { const m = await import('./js/pngtuber/effects.js'); return { EFFECTS: m.EFFECTS, SCENE_NAMES: m.SCENE_NAMES }; });
  // effets ponctuels : bouton ▶
  const oneshots = EFFECTS.filter((e) => e.kind === 'oneshot');
  let okOne = 0; const bad = [];
  for (const e of oneshots) {
    await ev(() => document.querySelector('.fx-box') && null);
    await p.locator('.fx-grid .fx-row button.grow', { hasText: e.name }).first().click();
    await p.waitForTimeout(e.id === 'fireworks' ? 900 : e.id === 'stars' ? 500 : 300);
    const n = await fxPixels();
    const tr = await ev(() => document.querySelector('.pt-scene').style.transform);
    if (n > 0 || (e.id === 'impact' && tr)) okOne++; else bad.push(e.name);
    await p.waitForTimeout(e.id === 'confetti' ? 300 : 100);
  }
  await p.screenshot({ path: `${H.OUT}/fx_oneshots.png` });
  check(`${oneshots.length} effets ponctuels visibles`, okOne === oneshots.length, bad.join(', '));
  // ambiance + voix
  await p.waitForTimeout(3500);
  for (const e of EFFECTS.filter((x) => x.kind !== 'oneshot')) await p.locator('.fx-box .chips').nth(e.kind === 'ambient' ? 0 : 1).locator('button', { hasText: e.name }).click();
  const talk = p.locator('.dlg-body button', { hasText: 'Maintenir pour parler' });
  const bx = await talk.boundingBox();
  await p.mouse.move(bx.x + 5, bx.y + 5); await p.mouse.down();
  await p.waitForTimeout(1800);
  const amb = await fxPixels();
  await p.screenshot({ path: `${H.OUT}/fx_ambiance.png` });
  await p.mouse.up();
  const conf = await ev(() => { const e = window.pixelAtelier.doc.pngtuber.effects; return { ambient: e.ambient.length, voice: e.voice.length }; });
  check('Ambiances et effets de voix actifs et enregistrés', amb > 200 && conf.ambient === 6 && conf.voice === 4, `${amb} px, ${JSON.stringify(conf)}`);
  // décors
  let okSc = 0; const badSc = [];
  for (const [id, name] of Object.entries(SCENE_NAMES)) {
    await p.locator('.pt-side .chips button', { hasText: name }).first().click();
    await p.waitForTimeout(250);
    const n = await ev(() => { const c = document.querySelector('.fx-bg'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 64) if (d[i]) k++; return k / (d.length / 64); });
    if (n > 0.95) okSc++; else badSc.push(`${name} ${n.toFixed(2)}`);
    await p.screenshot({ path: `${H.OUT}/scene_${id}.png` });
  }
  check(`${Object.keys(SCENE_NAMES).length} décors animés couvrent la scène`, okSc === Object.keys(SCENE_NAMES).length, badSc.join(', '));
  // touche associée à un effet
  await p.locator('.fx-grid .fx-row', { hasText: 'Confettis' }).locator('.fx-key').click();
  await p.keyboard.press('c');
  await p.waitForTimeout(200);
  const key = await ev(() => window.pixelAtelier.doc.pngtuber.effects.keys.confetti);
  check('Touche associée à un effet', key === 'C', key);
  await ev(() => { for (const c of document.querySelectorAll('.pt-scene .chips button.on')) void c; });
  // annuler les réglages d'effets (après fermeture : regroupés dans l'historique)
  // expression liée : Content -> cœurs
  await p.locator('.pt-side .chips button', { hasText: 'Vert' }).first().click();
  const happy = await ev(() => window.pixelAtelier.doc.expressions.find((e) => /content/i.test(e.name))?.key);
  await p.keyboard.press(happy || '3');
  await p.waitForTimeout(400);
  check('Expression Content : effets liés (cœurs, étincelles)', (await fxPixels()) > 0);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await ev(async () => { await window.pixelAtelier.storage.saveNow(); });
  const undo = await ev(() => { const app = window.pixelAtelier; const before = JSON.stringify(app.doc.pngtuber.effects || null); for (let i = 0; i < 30 && JSON.stringify(app.doc.pngtuber.effects || null) === before; i++) app.history.undo(); return JSON.stringify(app.doc.pngtuber.effects || null) !== before; });
  check('Réglages d\'effets annulables', undo);
  await ev(() => { for (let i = 0; i < 30; i++) window.pixelAtelier.history.redo(); });
  await ev(async () => { await window.pixelAtelier.storage.saveNow(); });

  // fenêtre de capture : décor + effet relayé
  const id = await ev(() => window.pixelAtelier.doc.id);
  const cap = await ctx.newPage();
  const cerr = [];
  cap.on('pageerror', (e) => cerr.push(e.message));
  await cap.goto(`${H.BASE}capture.html?project=${id}&bg=synthwave`);
  await cap.waitForTimeout(1500);
  const capBg = await cap.evaluate(() => { const c = document.getElementById('fxbg'); return c.width > 0 && c.getContext('2d').getImageData(c.width >> 1, 5, 1, 1).data[3] > 0; });
  await ev(() => { const { channel } = window; void channel; });
  await ev(async (id) => { const { channel } = await import('./js/storage/storage.js'); channel.postMessage({ type: 'effect', projectId: id, id: 'confetti' }); }, id);
  await cap.waitForTimeout(400);
  const capFx = await cap.evaluate(() => { let n = 0; for (const c of document.querySelectorAll('#fxb, #fxf')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i]) n++; } return n; });
  await cap.screenshot({ path: `${H.OUT}/fx_capture.png` });
  check('Capture : décor animé + effet relayé depuis l\'éditeur', capBg && capFx > 0 && !cerr.length, `${capBg} ${capFx} ${cerr.join(' | ')}`);

  // avatar .html autonome
  const html = await ev(async () => { const { buildStandaloneAvatar } = await import('./js/pngtuber/standalone.js'); return buildStandaloneAvatar(window.pixelAtelier.doc); });
  fs.writeFileSync(`${H.OUT}/fx_avatar.html`, html);
  const av = await ctx.newPage();
  const aerr = [];
  av.on('pageerror', (e) => aerr.push(e.message));
  av.on('console', (m) => m.type() === 'error' && aerr.push(m.text()));
  await av.goto(`file://${H.OUT}/fx_avatar.html?bg=night`);
  await av.waitForTimeout(1200);
  await av.keyboard.press('c');
  await av.waitForTimeout(500);
  const avFx = await av.evaluate(() => { let n = 0; for (const c of document.querySelectorAll('#fxb, #fxf')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i]) n++; } return n; });
  await av.screenshot({ path: `${H.OUT}/fx_standalone.png` });
  check('Avatar .html : décor, ambiances et touche d\'effet', avFx > 50 && !aerr.length, `${avFx} ${aerr.join(' | ')}`);
  H.summary(errs);
  await b.close();
})();
