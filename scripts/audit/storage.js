const { chromium } = require('playwright');
const H = require('./h.js');
(async () => {
  for (const mode of ['no-idb', 'no-ls', 'idb-fail']) {
    const b = await chromium.launch();
    const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
    await p.addInitScript((mode) => {
      if (mode === 'no-idb') Object.defineProperty(window, 'indexedDB', { get() { return undefined; } });
      if (mode === 'no-ls') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
      if (mode === 'idb-fail') { const o = indexedDB.open.bind(indexedDB); indexedDB.open = () => { const r = { }; setTimeout(() => { r.error = new DOMException('quota', 'QuotaExceededError'); r.onerror && r.onerror({ target: r }); }, 10); return r; }; }
    }, mode);
    await p.goto(H.BASE + '?t=' + Date.now());
    const ok = await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc, null, { timeout: 8000 }).then(() => true).catch(() => false);
    let drew = false;
    if (ok) {
      await p.keyboard.press('Escape');
      drew = await p.evaluate(async () => {
        const app = window.pixelAtelier; const l = app.doc.activeLayer || app.doc.allLayers()[0];
        if (!l) return 'pas de calque';
        const t = app.history.beginPixels(l); t.cel[0] = 0xff0000ff; app.markLayerDirty(t.cel, 0, 0, 1, 1); app.history.endPixels(t, 'x');
        try { await app.storage?.saveNow(); } catch (e) { return 'saveNow lève : ' + e.message; }
        return true;
      });
    }
    await p.waitForTimeout(300);
    const toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ')).catch(() => '');
    H.check(`${mode} : démarre, dessine, prévient si la sauvegarde échoue`, ok && drew === true && !errs.length && (mode === 'no-ls' || /Sauvegarde automatique impossible/.test(toast)), `démarrage ${ok ? 'OK' : 'ÉCHEC'}, dessin+sauvegarde ${drew}, erreurs ${errs.length ? errs.join(' / ') : 'aucune'} ${toast ? '— message : ' + toast : ''}`);
    void 0;
    await b.close();
  }
  H.summary();
})();
