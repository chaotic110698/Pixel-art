// Hors ligne, mode tuiles, grille, historique, expressions dans l'éditeur, tutoriel.
const H = require('./h.js');
(async () => {
  const { b, ctx, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);

  // --- service worker / hors ligne
  const swOk = await ev(async () => { if (!('serviceWorker' in navigator)) return 'absent'; const r = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]); return r ? 'prêt' : 'non prêt'; });
  check('Service worker installé', swOk === 'prêt', swOk);
  await p.waitForTimeout(1500);
  await ctx.setOffline(true);
  await p.reload();
  const offline = await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc, null, { timeout: 10000 }).then(() => true).catch(() => false);
  check('Rechargement hors ligne', offline);
  const lazyOk = await ev(async () => { try { await import('./js/export/exporter.js'); await import('./js/library/library-ui.js'); await import('./js/pngtuber/pngtuber.js'); await import('./js/storage/aseprite.js'); await import('./js/export/psd.js'); return true; } catch (e) { return String(e); } });
  check('Modules chargés à la demande disponibles hors ligne', lazyOk === true, String(lazyOk));
  const capOk = await (async () => { const c = await ctx.newPage(); await c.goto(H.BASE + 'capture.html').catch(() => {}); const t = await c.title().catch(() => ''); await c.close(); return t; })();
  check('capture.html hors ligne', !!capOk, capOk);
  await ctx.setOffline(false);
  await p.keyboard.press('Escape');

  // --- mode tuiles
  await H.blank(p, 16, 16);
  await p.keyboard.press('t');
  check('Mode tuiles (T)', await ev(() => !!window.pixelAtelier.state.tileMode));
  await H.tool(p, 'pencil');
  await H.drag(p, [[15, 15]]);
  check('Dessin en mode tuiles', (await H.count(p)) === 1);
  await p.screenshot({ path: H.OUT + '/tiles.png' });
  await p.keyboard.press('t');

  // --- grille
  const g = await ev(async () => {
    const app = window.pixelAtelier;
    const d = app.doc;
    const before = JSON.stringify(d.grid);
    document.querySelector('#panel-tabs button[data-tab="grid"]')?.click();
    await new Promise((r) => setTimeout(r, 200));
    const inputs = document.querySelectorAll('#panel-grid input, #panel-grid select, #panel-grid button').length;
    return { before, inputs };
  });
  check('Panneau Grille', g.inputs > 3, g.inputs);
  await p.keyboard.press('#');
  await p.waitForTimeout(100);

  // --- historique : clic sur une entrée ancienne
  await H.blank(p, 16, 16);
  for (let i = 0; i < 4; i++) await H.drag(p, [[i, i]]);
  await ev(() => document.querySelector('#panel-tabs button[data-tab="history"]')?.click());
  await p.waitForTimeout(200);
  const items = p.locator('#panel-history .hist-row');
  const nItems = await items.count();
  if (nItems > 2) { await items.nth(1).click(); await p.waitForTimeout(150); }
  const nPx = await H.count(p);
  check('Historique : revenir à une étape', nItems >= 4 && nPx < 4, `${nItems} entrées, ${nPx} px`);

  // --- expressions dans l'éditeur (touches 1–7) + temporaire
  await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter } = await import('./js/library/character.js');
    const { DEFAULT_COLORS } = await import('./js/library/builder.js');
    app.setDoc(buildCharacter({ colors: DEFAULT_COLORS }));
  });
  await ev(() => document.querySelector('#panel-tabs button[data-tab="expressions"]')?.click());
  await p.waitForTimeout(300);
  const st = () => ev(async () => { const ops = await import('./js/core/layer-ops.js'); return JSON.stringify(ops.currentStates(window.pixelAtelier.doc)); });
  const s1 = await st();
  // cliquer sur l'expression « Content »
  await p.locator('#panel-expressions .expr-row button', { hasText: 'Content' }).first().click();
  await p.waitForTimeout(200);
  const s2 = await st();
  check('Appliquer une expression (panneau)', s1 !== s2);
  await p.keyboard.press('Control+z');
  check('Annuler l\'expression', (await st()) === s1);
  // Tab : variante suivante du groupe actif
  await p.screenshot({ path: H.OUT + '/expr_panel.png' });

  // --- tutoriel
  await ev(() => window.pixelAtelier.startTutorial());
  await p.waitForTimeout(400);
  let steps = 0;
  for (let i = 0; i < 20; i++) {
    const next = p.locator('button', { hasText: /^(Suivant|Commencer|Terminer)/ }).first();
    if (!(await next.count()) || !(await next.isVisible())) break;
    await next.click(); steps++; await p.waitForTimeout(200);
  }
  check('Tutoriel parcouru jusqu\'au bout', steps >= 3, steps + ' étapes');
  await p.screenshot({ path: H.OUT + '/tuto_end.png' });

  H.summary(errs);
  await b.close();
})();
