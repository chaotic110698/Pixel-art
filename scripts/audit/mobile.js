// Mobile : mise en page (pas de débordement), barre du bas, tiroirs, gestes tactiles.
const H = require('./h.js');
(async () => {
  for (const dev of ['iPhone SE', 'iPhone 12', 'Pixel 5', 'iPad Mini']) {
    const { b, p, errs } = await H.open({ device: dev });
    const { check } = H;
    const ev = (f, a) => p.evaluate(f, a);
    await ev(async () => {
      const app = window.pixelAtelier;
      const { buildCharacter } = await import('./js/library/character.js');
      const { DEFAULT_COLORS } = await import('./js/library/builder.js');
      app.setDoc(buildCharacter({ colors: DEFAULT_COLORS }));
    });
    await p.waitForTimeout(300);
    const overflow = async () => ev(() => {
      const W = window.innerWidth;
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).position === 'fixed' && r.right <= W + 1) continue;
        if (r.right > W + 2 && !el.closest('#optionsbar, .tabs-row, .chips, #variantbar, .scroll-x, #timeline, .frames, .cards') && getComputedStyle(el).visibility !== 'hidden') bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} →${Math.round(r.right)}`);
      }
      return { W, scroll: document.documentElement.scrollWidth, bad: [...new Set(bad)].slice(0, 6) };
    });
    const o = await overflow();
    check(`[${dev}] pas de défilement horizontal`, o.scroll <= o.W + 1, JSON.stringify(o));
    await p.screenshot({ path: `${H.OUT}/m_${dev.replace(/ /g, '_')}.png` });
    // barre du bas : chaque bouton
    const nav = await ev(() => [...document.querySelectorAll('#mobilenav button')].filter((x) => x.offsetParent).map((x) => x.getAttribute('aria-label') || x.textContent.trim()));
    for (const lbl of nav) {
      const n = errs.length;
      await p.locator(`#mobilenav button[aria-label="${lbl}"]`).first().tap().catch(async () => p.locator('#mobilenav button', { hasText: lbl }).first().tap());
      await p.waitForTimeout(500);
      const o2 = await overflow();
      await p.screenshot({ path: `${H.OUT}/m_${dev.replace(/ /g, '_')}_${lbl.replace(/[^a-z]+/gi, '_').slice(0, 20)}.png` });
      check(`[${dev}] barre du bas « ${lbl} »`, errs.length === n && o2.scroll <= o2.W + 1, (errs.slice(n)[0] || '') + (o2.scroll > o2.W + 1 ? ' débordement ' + JSON.stringify(o2.bad) : ''));
      for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(60); }
      await ev(() => window.pixelAtelier.closeDrawer?.());
    }
    // dialogues : débordement
    for (const a of ['newCharacter', 'exportDialog', 'openLibrary', 'openPngtuber', 'openProjects']) {
      await ev((a) => window.pixelAtelier.actions[a](), a);
      await p.waitForTimeout(700);
      const o3 = await overflow();
      const dlgFits = await ev(() => { const d = document.querySelector('.dlg'); if (!d) return 'aucune'; const r = d.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 ? 'ok' : `${Math.round(r.left)}..${Math.round(r.right)}`; });
      await p.screenshot({ path: `${H.OUT}/m_${dev.replace(/ /g, '_')}_${a}.png` });
      check(`[${dev}] fenêtre ${a} tient dans l'écran`, dlgFits === 'ok' && o3.scroll <= o3.W + 1, dlgFits + ' ' + JSON.stringify(o3.bad));
      for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(80); }
    }
    // tactile : un doigt dessine
    await H.blank(p, 32, 32);
    await ev(() => window.pixelAtelier.tools.select('pencil'));
    const cdp = await p.context().newCDPSession(p);
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
    const [x0, y0] = await H.scr(p, 5, 5), [x1, y1] = await H.scr(p, 20, 5);
    await touch('touchStart', [[x0, y0]]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[x0 + ((x1 - x0) * i) / 6, y0]]);
    await touch('touchEnd', []);
    await p.waitForTimeout(150);
    const n1 = await H.count(p);
    check(`[${dev}] 1 doigt dessine`, n1 >= 10, n1);
    // deux doigts : zoom sans tracé
    const z0 = await ev(() => window.pixelAtelier.viewport.zoom);
    const [cx, cy] = await H.scr(p, 16, 20);
    await touch('touchStart', [[cx - 20, cy], [cx + 20, cy]]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - 20 - i * 10, cy], [cx + 20 + i * 10, cy]]);
    await touch('touchEnd', []);
    await p.waitForTimeout(150);
    const z1 = await ev(() => window.pixelAtelier.viewport.zoom);
    check(`[${dev}] 2 doigts : zoom sans tracer`, z1 > z0 * 1.3 && (await H.count(p)) === n1, `zoom ${z0.toFixed(1)}→${z1.toFixed(1)}, px ${await H.count(p)}`);
    // tape à deux doigts = annuler
    await touch('touchStart', [[cx - 20, cy], [cx + 20, cy]]);
    await p.waitForTimeout(60);
    await touch('touchEnd', []);
    await p.waitForTimeout(250);
    check(`[${dev}] tape à 2 doigts = annuler`, (await H.count(p)) === 0, await H.count(p));
    H.summary(errs);
    H.results.length = 0;
    await b.close();
  }
})();
