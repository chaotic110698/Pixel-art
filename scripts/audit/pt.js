// PNGtuber : fenêtre de l'éditeur, capture OBS, avatar autonome.
const H = require('./h.js');
const fs = require('fs');
(async () => {
  const { b, ctx, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  for (const view of ['front', '3q', '3qd']) {
    await ev(async (view) => {
      const app = window.pixelAtelier;
      const ch = await import('./js/library/character.js');
      const { DEFAULT_COLORS } = await import('./js/library/builder.js');
      const colors = { '3q': ch.PORTRAIT_COLORS, '3qd': ch.PORTRAIT_QD_COLORS }[view] || DEFAULT_COLORS;
      const sel = { '3q': ch.DEFAULT_CHARACTER_3Q, '3qd': ch.DEFAULT_CHARACTER_QD }[view] || ch.DEFAULT_CHARACTER;
      app.setDoc(ch.buildCharacter({ colors, sel, name: 'PT ' + view, facing: view === '3qd' ? 'right' : null }));
      await app.storage.saveNow();
    }, view);
    await ev(() => window.pixelAtelier.actions.openPngtuber());
    await p.waitForTimeout(700);
    const hash = () => ev(() => { const c = document.querySelector('.pt-scene > canvas:not(.fx-layer)'); if (!c) return null; const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let h = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) n++; h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 3]) | 0; } return { h, n }; });
    const s0 = await hash();
    check(`[${view}] PNGtuber : avatar affiché`, s0 && s0.n > 100, JSON.stringify(s0));
    const seen = new Set([s0.h]);
    for (const k of ['2', '3', '4', '5', '6', '7']) { await p.keyboard.press(k); await p.waitForTimeout(250); seen.add((await hash()).h); }
    check(`[${view}] Touches 1–7 : images différentes`, seen.size >= 6, seen.size);
    // « maintenir pour parler »
    const talk = p.locator('.dlg-body button', { hasText: 'Maintenir pour parler' });
    if (await talk.count()) {
      await p.keyboard.press('1'); await p.waitForTimeout(200);
      const a = (await hash()).h;
      const bx = await talk.boundingBox();
      await p.mouse.move(bx.x + 5, bx.y + 5); await p.mouse.down(); await p.waitForTimeout(400);
      const bb = (await hash()).h; await p.mouse.up();
      check(`[${view}] Maintenir pour parler : bouche ouverte`, a !== bb);
    } else check(`[${view}] Bouton « Maintenir pour parler »`, false);
    await p.screenshot({ path: `${H.OUT}/pt_${view}.png` });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    check(`[${view}] Fermeture du mode PNGtuber`, !(await ev(() => window.pixelAtelier.pngtuberOpen)));
  }

  // format de la scène (cadre 16:9) et pack d'icônes Stream Deck
  await ev(() => window.pixelAtelier.actions.openPngtuber());
  await p.waitForTimeout(600);
  await p.selectOption('select[aria-label="Format de la scène"]', '1080p');
  await p.waitForTimeout(300);
  const ratio = await ev(() => { const r = document.querySelector('.pt-scene').getBoundingClientRect(); return r.width / r.height; });
  check('Format 1920 × 1080 : scène en 16:9', Math.abs(ratio - 16 / 9) < 0.02, ratio.toFixed(3));
  await p.selectOption('select[aria-label="Format de la scène"]', 'vertical');
  await p.waitForTimeout(300);
  const ratioV = await ev(() => { const r = document.querySelector('.pt-scene').getBoundingClientRect(); return r.width / r.height; });
  check('Format vertical : scène en 9:16', Math.abs(ratioV - 9 / 16) < 0.02, ratioV.toFixed(3));
  const sdBtn = p.locator('.dlg-body button', { hasText: 'Icônes Stream Deck' });
  await sdBtn.scrollIntoViewIfNeeded().catch(() => {});
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), sdBtn.click()]);
  const zipPath = `${H.OUT}/streamdeck.zip`;
  await dl.saveAs(zipPath);
  const zbuf = fs.readFileSync(zipPath);
  let pngs = 0;
  for (let i = 0; i + 30 < zbuf.length; i++) if (zbuf.readUInt32LE(i) === 0x04034b50) { const n = zbuf.readUInt16LE(i + 26); if (zbuf.slice(i + 30, i + 30 + n).toString().endsWith('.png')) pngs++; }
  check('Pack Stream Deck : 63 icônes PNG (49 effets, 14 décors)', pngs === 63, pngs);
  await p.selectOption('select[aria-label="Format de la scène"]', 'free');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // capture OBS
  const id = await ev(() => window.pixelAtelier.doc.id);
  const cap = await ctx.newPage();
  const cerrs = [];
  cap.on('pageerror', (e) => cerrs.push(e.message));
  cap.on('console', (m) => { if (m.type() === 'error') cerrs.push(m.text()); });
  await cap.goto(`${H.BASE}capture.html?project=${id}&bg=green`);
  await cap.waitForTimeout(1500);
  const capN = await cap.evaluate(() => { const c = document.getElementById('avatar'); if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  check('Capture OBS : avatar affiché', capN > 100, capN);
  // suit l'éditeur (expression)
  const c1 = await cap.screenshot();
  await ev(async () => { const ops = await import('./js/core/layer-ops.js'); const app = window.pixelAtelier; ops.applyExpression(app, app.doc.expressions[2].id); });
  await cap.waitForTimeout(800);
  const c2 = await cap.screenshot();
  check('Capture OBS : suit l\'expression de l\'éditeur', !c1.equals(c2));
  await cap.screenshot({ path: `${H.OUT}/capture.png` });
  await cap.goto(`${H.BASE}capture.html?project=${id}&bg=green&fmt=square`);
  await cap.waitForTimeout(1000);
  const capR = await cap.evaluate(() => { const r = document.getElementById('scene').getBoundingClientRect(); return r.width / r.height; });
  check('Capture OBS : format carré (?fmt=square)', Math.abs(capR - 1) < 0.02, capR.toFixed(3));
  check('Capture OBS : aucune erreur', cerrs.length === 0, cerrs.join(' | '));

  // avatar autonome
  const html = await ev(async () => { const { buildStandaloneAvatar } = await import('./js/pngtuber/standalone.js'); return buildStandaloneAvatar(window.pixelAtelier.doc); });
  fs.writeFileSync(`${H.OUT}/avatar.html`, html);
  const av = await ctx.newPage();
  const aerrs = [];
  av.on('pageerror', (e) => aerrs.push(e.message));
  av.on('console', (m) => { if (m.type() === 'error') aerrs.push(m.text()); });
  await av.goto('file://' + H.OUT + '/avatar.html?bg=green');
  await av.waitForTimeout(1200);
  const a1 = await av.screenshot();
  await av.keyboard.press('3'); await av.waitForTimeout(400);
  const a2 = await av.screenshot();
  check('Avatar .html : s\'affiche et réagit aux touches', !a1.equals(a2));
  await av.keyboard.press('h'); await av.waitForTimeout(200);
  check('Avatar .html : H masque l\'interface', await av.evaluate(() => document.body.classList.contains('clean')));
  check('Avatar .html : aucune erreur', aerrs.length === 0, aerrs.join(' | '));
  await av.screenshot({ path: `${H.OUT}/avatar.png` });

  H.summary(errs);
  await b.close();
})();
