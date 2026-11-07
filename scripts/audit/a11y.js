const H = require('./h.js');
(async () => {
  const { b, p, errs } = await H.open();
  const ev = (f, a) => p.evaluate(f, a);
  await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter } = await import('./js/library/character.js');
    const { DEFAULT_COLORS } = await import('./js/library/builder.js');
    app.setDoc(buildCharacter({ colors: DEFAULT_COLORS }));
  });
  const scan = (where) => ev((where) => {
    const out = [];
    for (const el of document.querySelectorAll('button, [role=button], input, select')) {
      if (!el.offsetParent) continue;
      const txt = (el.textContent || '').trim();
      const lab = el.getAttribute('aria-label') || el.getAttribute('title') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
      if (!txt && !lab && el.type !== 'hidden') out.push(`${where}: <${el.tagName.toLowerCase()} class="${el.className}"> ${el.outerHTML.slice(0, 90)}`);
    }
    return out;
  }, where);
  let all = [...await scan('principal')];
  for (const a of ['openLibrary', 'exportDialog', 'newCharacter', 'openPngtuber', 'openProjects']) {
    await ev((a) => { window.pixelAtelier.actions[a](); }, a);
    await p.waitForTimeout(600);
    all.push(...await scan(a));
    for (let i = 0; i < 3; i++) await p.keyboard.press('Escape');
  }
  for (const t of ['expressions', 'grid', 'history']) { await ev((t) => document.querySelector(`#panel-tabs button[data-tab="${t}"]`)?.click(), t); await p.waitForTimeout(200); all.push(...await scan('panneau ' + t)); }
  await ev(() => window.pixelAtelier.openSettings()); await p.waitForTimeout(300);
  for (let i = 0; i < 5; i++) { await p.locator('.set-tab').nth(i).click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(150); all.push(...await scan('paramètres ' + i)); }
  await p.keyboard.press('Escape');
  all = [...new Set(all)];
  H.check('Contrôles sans libellé accessible', all.length === 0, all.length + '\n  ' + all.slice(0, 25).join('\n  '));
  // saisie : taper dans un champ ne déclenche pas les raccourcis
  await ev(() => document.querySelector('#panel-tabs button[data-tab="layers"]')?.click());
  const t0 = await ev(() => window.pixelAtelier.tools.current.id);
  await ev(() => window.pixelAtelier.actions.exportDialog());
  await p.waitForTimeout(400);
  await p.keyboard.press('Escape');
  await ev(() => { const i = document.createElement('input'); i.id = 'tmpin'; document.body.append(i); i.focus(); });
  await p.keyboard.type('begilmouv');
  const t1 = await ev(() => window.pixelAtelier.tools.current.id);
  H.check('Taper dans un champ ne change pas d\'outil', t0 === t1, `${t0} → ${t1}`);
  await ev(() => document.getElementById('tmpin').remove());
  // pngtuber ouvert : les touches ne changent pas l'outil de l'éditeur
  await ev(() => window.pixelAtelier.actions.openPngtuber()); await p.waitForTimeout(500);
  await p.keyboard.press('e');
  const t2 = await ev(() => window.pixelAtelier.tools.current.id);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.keyboard.press('e');
  const t3 = await ev(() => window.pixelAtelier.tools.current.id);
  H.check('Mode PNGtuber isole les raccourcis', t2 === t0 && t3 === 'eraser', `${t2} / ${t3}`);
  H.summary(errs);
  await b.close();
})();
