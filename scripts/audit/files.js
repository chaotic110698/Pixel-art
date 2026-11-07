const H = require('./h.js');
const fs = require('fs');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  const files = [[H.OUT + '/audit_pngtuber.zip', 'application/zip'], [__dirname + '/fixtures/test.ase', 'application/octet-stream']];
  for (const [f, type] of files) {
    if (!fs.existsSync(f)) { console.log('absent (lancer export.js avant) :', f); continue; }
    const b64 = fs.readFileSync(f).toString('base64');
    const r = await ev(async ([b64, name, type]) => {
      const app = window.pixelAtelier;
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const before = app.doc.id;
      const { openProjectFile } = await import('./js/storage/project-file.js');
      await openProjectFile(app, new File([bin], name, { type }));
      await new Promise((r) => setTimeout(r, 300));
      const d = app.doc;
      return { changed: d.id !== before, name: d.name, layers: d.allLayers().length, frames: d.frames.length, w: d.width, h: d.height, expr: d.expressions.length };
    }, [b64, f.split('/').pop(), type]);
    check(`Ouvrir ${f.split('/').pop()}`, r.changed && r.layers > 0, JSON.stringify(r));
  }
  // settings tabs
  await ev(() => window.pixelAtelier.openSettings());
  await p.waitForTimeout(300);
  const tabs = await ev(() => [...document.querySelectorAll('.set-tab')].map((x) => x.textContent.trim()));
  for (const t of tabs) {
    const n = errs.length;
    await p.locator('.set-tab', { hasText: t }).first().click();
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${H.OUT}/settings_${t.replace(/[^a-z]+/gi, '_')}.png` });
    // basculer chaque interrupteur deux fois
    const sw = p.locator('.dlg-body input[type=checkbox]');
    const k = await sw.count();
    for (let i = 0; i < k; i++) { await sw.nth(i).click({ force: true }).catch(() => {}); await sw.nth(i).click({ force: true }).catch(() => {}); }
    check(`Paramètres : ${t} (${k} interrupteurs)`, errs.length === n, errs.slice(n)[0] || '');
  }
  await p.keyboard.press('Escape');
  H.summary(errs);
  await b.close();
})();
