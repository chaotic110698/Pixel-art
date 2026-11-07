// Interface : chaque entrée du menu, chaque bouton des panneaux, fenêtres, imports de fichiers.
const H = require('./h.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  const FX = __dirname + '/fixtures';
  let nextFile = null;
  p.on('filechooser', async (fc) => { if (nextFile) await fc.setFiles(nextFile); });
  await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter } = await import('./js/library/character.js');
    const { DEFAULT_COLORS } = await import('./js/library/builder.js');
    app.setDoc(buildCharacter({ colors: DEFAULT_COLORS }));
  });

  const menuLabels = await (async () => {
    await p.click('#btn-menu');
    await p.waitForTimeout(200);
    const l = await ev(() => [...document.querySelectorAll('.popup-menu button')].map((x) => x.textContent.trim()));
    await p.keyboard.press('Escape');
    return l;
  })();
  console.log('   menu :', menuLabels.length, 'entrées');
  const skip = /Langue|Language/;
    // images de test générées avec l'encodeur PNG de l'application
  for (const [name, w, hh] of [['big.png', 200, 120], ['ref.png', 48, 48]]) {
    const b64 = await ev(async ([w, hh]) => {
      const { encodePNG } = await import('./js/export/png.js');
      const px = new Uint32Array(w * hh); for (let i = 0; i < px.length; i++) px[i] = 0xff000000 | ((i * 2654435761) >>> 8);
      const bytes = await encodePNG(px, w, hh);
      let s = ''; for (const c of bytes) s += String.fromCharCode(c); return btoa(s);
    }, [w, hh]);
    fs.writeFileSync(H.OUT + '/' + name, Buffer.from(b64, 'base64'));
  }
  const files = { 'Ouvrir un fichier': FX + '/test.ase', 'Importer une image comme calque': H.OUT + '/big.png', 'Importer une image de référence': H.OUT + '/ref.png' };
  for (const label of menuLabels) {
    if (skip.test(label)) continue;
    const before = errs.length;
    nextFile = Object.entries(files).find(([k]) => label.startsWith(k))?.[1] || null;
    await p.click('#btn-menu');
    await p.waitForTimeout(150);
    const dl = p.waitForEvent('download', { timeout: 1500 }).catch(() => null);
    await p.locator('.popup-menu button', { hasText: label }).first().click();
    await p.waitForTimeout(700);
    const dlg = await ev(() => [...document.querySelectorAll('.dlg h2')].map((x) => x.textContent).join(' / '));
    // fenêtres d'import : on valide avec le bouton principal
    if (nextFile && dlg) {
      const prim = p.locator('.dlg-foot .btn.primary').last();
      if (await prim.count()) { await prim.click(); await p.waitForTimeout(600); }
    }
    const d = await dl;
    const dlg2 = await ev(() => [...document.querySelectorAll('.dlg h2')].map((x) => x.textContent).join(' / '));
    await p.screenshot({ path: `${H.OUT}/menu_${label.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}.png` });
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(80); }
    await ev(() => { const app = window.pixelAtelier; if (app.freeTransform) app.actions.endTransform(true); });
    const newErr = errs.slice(before);
    check(`Menu « ${label} »`, newErr.length === 0, (dlg2 || dlg || (d ? 'téléchargement ' + d.suggestedFilename() : '')) + (newErr.length ? ' ERREUR ' + newErr[0] : ''));
  }
  const after = await ev(() => { const d = window.pixelAtelier.doc; return { name: d.name, layers: d.allLayers().length, refs: d.allLayers().filter((l) => l.reference).length, w: d.width }; });
  console.log('   document après le menu :', JSON.stringify(after));

  // panneaux latéraux : chaque onglet, chaque bouton d'icône sûr
  const tabs = await ev(() => [...document.querySelectorAll('#panel-tabs button')].filter((x) => x.offsetParent).map((x) => x.textContent.trim()));
  for (const t of tabs) {
    const before = errs.length;
    await p.locator('#panel-tabs button', { hasText: t }).first().click();
    await p.waitForTimeout(250);
    check(`Onglet ${t}`, errs.length === before);
  }
  // bouton ⋯ des calques + chaque entrée
  await p.locator('#panel-tabs button', { hasText: 'Calques' }).first().click();
  const layerBtns = await ev(() => [...document.querySelectorAll('#panel-layers .icon-btn')].slice(0, 12).map((x) => x.title || x.getAttribute('aria-label')));
  console.log('   boutons calques :', layerBtns.join(' | '));
  for (const t of layerBtns) {
    if (!t || /Supprimer/.test(t)) continue;
    const before = errs.length;
    await p.locator(`#panel-layers .icon-btn[title="${t}"]`).first().click().catch(() => {});
    await p.waitForTimeout(250);
    for (let i = 0; i < 2; i++) await p.keyboard.press('Escape');
    check(`Calques : « ${t} »`, errs.length === before, errs.slice(before)[0] || '');
  }
  // paramètres : chaque onglet, chaque thème
  await ev(() => window.pixelAtelier.openSettings());
  await p.waitForTimeout(400);
  const stabs = await ev(() => [...document.querySelectorAll('.dlg .tabs-row button, .dlg [role=tab]')].map((x) => x.textContent.trim()));
  for (const t of stabs) {
    const before = errs.length;
    await p.locator('.dlg .tabs-row button, .dlg [role=tab]', { hasText: t }).first().click();
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${H.OUT}/settings_${t.replace(/[^a-z]+/gi, '_')}.png` });
    check(`Paramètres : onglet ${t}`, errs.length === before);
  }
  await p.keyboard.press('Escape');
  const themes = await ev(async () => { const s = await import('./js/ui/settings.js'); return Object.keys(s.THEMES); });
  for (const th of themes) {
    await ev(async (th) => { const app = window.pixelAtelier; const s = await import('./js/ui/settings.js'); app.setState({ ui: { ...(app.state.ui || {}), theme: th } }); s.applyAppearance(app); }, th);
    await p.waitForTimeout(120);
    await p.screenshot({ path: `${H.OUT}/theme_${th}.png` });
  }
  check('Thèmes appliqués', errs.length === 0, themes.join(','));
  // aide raccourcis + tutoriel
  await p.keyboard.press('?');
  await p.waitForTimeout(300);
  check('Aide des raccourcis (?)', await ev(() => !!document.querySelector('.dlg')));
  await p.keyboard.press('Escape');
  H.summary(errs);
  await b.close();
})();
