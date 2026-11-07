// Raccourcis du mode PNGtuber : combinaisons, touches des fonds, capture qui suit
// l'éditeur, fond immobile pendant la respiration, lexique du guide.
const H = require('./h.js');
(async () => {
  const { b, ctx, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter, DEFAULT_CHARACTER_3Q, PORTRAIT_COLORS } = await import('./js/library/character.js');
    app.setDoc(buildCharacter({ colors: PORTRAIT_COLORS, sel: DEFAULT_CHARACTER_3Q, name: 'Touches' }));
    app.doc.pngtuber.breathe = true;
    app.doc.pngtuber.background = 'mountains';
    await app.storage.saveNow();
  });
  await ev(() => window.pixelAtelier.actions.openPngtuber());
  await p.waitForTimeout(700);
  // 1. respiration : l'avatar bouge, le fond (décor fixe) non
  const sample = () => ev(() => {
    const bg = document.querySelector('.fx-bg'), av = document.querySelector('.pt-scene > canvas:not(.fx-layer)');
    const hash = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 37) h = (h * 31 + d[i]) | 0; return h; };
    return [hash(bg), hash(av)];
  });
  const seen = new Set(), avs = new Set();
  for (let i = 0; i < 12; i++) { const [bgH, avH] = await sample(); seen.add(bgH); avs.add(avH); await p.waitForTimeout(160); }
  check('Respiration : seul l\'avatar bouge (fond immobile)', seen.size === 1 && avs.size > 1, `fond ${seen.size} état(s), avatar ${avs.size}`);
  // 2. combinaison pour un effet
  await p.locator('.fx-grid .fx-row', { hasText: 'Confettis' }).locator('.fx-key').click();
  await p.keyboard.press('Control+Shift+Digit1');
  await p.waitForTimeout(150);
  const k1 = await ev(() => window.pixelAtelier.doc.pngtuber.effects?.keys?.confetti);
  check('Combinaison enregistrée pour un effet', k1 === 'Ctrl+Maj+1', k1);
  const px = () => ev(() => { let n = 0; for (const c of document.querySelectorAll('.fx-back, .fx-front')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i]) n++; } return n; });
  await p.waitForTimeout(2500);
  const before = await px();
  await p.keyboard.press('Control+Shift+Digit1');
  await p.waitForTimeout(250);
  check('La combinaison déclenche l\'effet', (await px()) > before + 20);
  // 3. touche de fond
  await p.locator('.pt-side .chips button', { hasText: 'Touches des fonds' }).click();
  await p.waitForTimeout(200);
  await p.locator('.dlg .fx-row', { hasText: 'Synthwave' }).locator('.fx-key').click();
  await p.keyboard.press('Alt+KeyB');
  await p.locator('.dlg .fx-row', { hasText: 'Vert' }).first().locator('.fx-key').click();
  await p.keyboard.press('KeyG');
  await p.waitForTimeout(150);
  const bk = await ev(() => window.pixelAtelier.doc.pngtuber.bgKeys);
  check('Touches des fonds enregistrées', bk && bk.synthwave === 'Alt+B' && bk.green === 'G', JSON.stringify(bk));
  await p.locator('.dlg-foot button', { hasText: 'Fermer' }).last().click();
  await ev(async () => { await window.pixelAtelier.storage.saveNow(); });
  // capture ouverte avant le changement
  const id = await ev(() => window.pixelAtelier.doc.id);
  const cap = await ctx.newPage();
  await cap.goto(`${H.BASE}capture.html?project=${id}&bg=green`);
  await cap.waitForTimeout(1200);
  await p.bringToFront();
  await p.keyboard.press('Alt+KeyB');
  await p.waitForTimeout(400);
  const edBg = await ev(() => window.pixelAtelier.doc.pngtuber.background);
  const capBg = await cap.evaluate(() => document.getElementById('bg').value);
  check('Touche de fond dans l\'éditeur, suivie par la capture', edBg === 'synthwave' && capBg === 'synthwave', `${edBg} / ${capBg}`);
  // changement à la souris dans l'éditeur, puis dans la capture (liste), puis touche dans la capture
  await p.locator('.pt-side .chips button', { hasText: 'Plage' }).first().click();
  await p.waitForTimeout(300);
  const c2 = await cap.evaluate(() => document.getElementById('bg').value);
  await cap.bringToFront();
  await cap.mouse.move(50, 50);
  await cap.selectOption('#bg', 'night');
  await cap.waitForTimeout(200);
  const c3 = await cap.evaluate(() => document.getElementById('bg').value);
  await cap.waitForTimeout(3500); // la barre se masque
  await cap.keyboard.press('KeyG');
  await cap.waitForTimeout(200);
  const c4 = await cap.evaluate(() => [document.getElementById('bg').value, getComputedStyle(document.getElementById('scene')).backgroundColor]);
  check('Capture : changer de fond (éditeur, liste, touche)', c2 === 'beach' && c3 === 'night' && c4[0] === 'green' && c4[1] === 'rgb(0, 255, 0)', `${c2} ${c3} ${c4}`);
  // 4. expression : combinaison
  await p.bringToFront();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await ev(() => document.querySelector('#panel-tabs button[data-tab="expressions"]')?.click());
  await p.waitForTimeout(200);
  await p.locator('#panel-expressions .expr-row').nth(1).locator('.icon-btn[aria-label="Options de l\'expression"]').click();
  await p.locator('.popup-menu button', { hasText: /Raccourci|Associer/ }).first().click();
  await p.waitForTimeout(200);
  await p.keyboard.press('Alt+Shift+KeyP');
  await p.waitForTimeout(100);
  await p.locator('.dlg-foot button', { hasText: 'OK' }).click();
  const ek = await ev(() => window.pixelAtelier.doc.expressions[1].key);
  check('Combinaison pour une expression', ek === 'Alt+Maj+P', ek);
  await ev(() => window.pixelAtelier.actions.openPngtuber());
  await p.waitForTimeout(500);
  await p.keyboard.press('Alt+Shift+KeyP');
  await p.waitForTimeout(200);
  const ex = await ev(() => document.querySelector('.pt-side .chips button.on[translate="no"]')?.textContent || '');
  const exName = await ev(() => window.pixelAtelier.doc.expressions[1].name);
  check('La combinaison applique l\'expression', ex.startsWith(exName), `${ex} / ${exName}`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  // 5. lexique
  await ev(() => window.pixelAtelier.openGuide('lexique'));
  await p.waitForTimeout(400);
  const lex = await ev(() => document.querySelector('#guide-lexique-lx-project')?.textContent || '');
  await p.screenshot({ path: `${H.OUT}/lexique.png` });
  check('Lexique : raccourcis du projet listés', /Ctrl\+Maj\+1/.test(lex) && /Alt\+B/.test(lex) && /Alt\+Maj\+P/.test(lex), lex.slice(0, 160));
  const single = await ev(() => document.querySelectorAll('#guide-lexique-lx-single dt').length);
  check('Lexique : touches simples de l\'éditeur', single > 20, single);
  H.summary(errs);
  await b.close();
})();
