// Guide complet : accès, chapitres, recherche, boutons « Essayer », mobile, anglais.
const H = require('./h.js');
(async () => {
  for (const mode of ['desktop', 'mobile', 'en']) {
    const { b, p, errs } = await H.open(mode === 'mobile' ? { device: 'iPhone 12' } : {});
    const { check } = H;
    const ev = (f, a) => p.evaluate(f, a);
    if (mode === 'en') {
      await ev(() => { window.pixelAtelier.setState({ lang: 'en' }); window.pixelAtelier.savePrefs?.flush?.(); });
      await p.reload();
      await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc);
      await p.waitForTimeout(600);
      await p.keyboard.press('Escape');
    }
    const open = () => ev(() => !!document.querySelector('.guide-dlg'));
    const close = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(150); };
    if (mode !== 'mobile') {
      // accès : barre d'outils, barre du haut, F1, « ? » de la barre d'options
      await p.locator('.tb-help button').click(); await p.waitForTimeout(400);
      check(`[${mode}] bouton Guide de la barre d'outils`, await open()); await close();
      await p.locator('#btn-guide').click(); await p.waitForTimeout(300);
      check(`[${mode}] bouton Guide près des paramètres`, await open()); await close();
      await ev(() => window.pixelAtelier.tools.select('wand'));
      await p.keyboard.press('F1'); await p.waitForTimeout(400);
      const sec = await ev(() => document.querySelector('.guide-sec.flash')?.id || document.querySelector('.guide-chap.on')?.textContent);
      check(`[${mode}] F1 ouvre l'aide de l'outil actif (baguette)`, sec === 'guide-select-select-tools', sec); await close();
      await p.locator('.opt-help').click(); await p.waitForTimeout(300);
      check(`[${mode}] bouton « ? » de la barre d'options`, await open()); await close();
    }
    // menu
    await p.click('#btn-menu'); await p.waitForTimeout(200);
    await p.locator('.popup-menu button', { hasText: mode === 'en' ? 'Complete guide' : 'Guide complet' }).first().click();
    await p.waitForTimeout(400);
    check(`[${mode}] menu ☰ > Guide complet`, await open());
    // chaque chapitre
    const n = await ev(() => document.querySelectorAll('.guide-chap').length);
    let okCh = 0;
    for (let i = 0; i < n; i++) {
      await p.locator('.guide-chap').nth(i).click();
      await p.waitForTimeout(80);
      const ok = await ev((i) => { const t = document.querySelector('.guide-main h2')?.textContent; const secs = document.querySelectorAll('.guide-main .guide-sec').length; return !!t && secs > 0 && document.querySelectorAll('.guide-chap')[i].classList.contains('on'); }, i);
      if (ok) okCh++;
      if (i === 2) await p.screenshot({ path: `${H.OUT}/guide_${mode}_outils.png` });
    }
    check(`[${mode}] ${n} chapitres affichés`, okCh === n && n >= 16, `${okCh}/${n}`);
    // suivant / précédent
    await p.locator('.guide-chap').first().click();
    await p.locator('.guide-foot .btn.primary').click(); await p.waitForTimeout(100);
    check(`[${mode}] bouton chapitre suivant`, await ev(() => document.querySelectorAll('.guide-chap')[1].classList.contains('on')));
    // recherche
    await p.fill('.guide-search', mode === 'en' ? 'microphone' : 'micro');
    await p.waitForTimeout(400);
    const hits = await ev(() => document.querySelectorAll('.guide-hit').length);
    check(`[${mode}] recherche`, hits >= 2, hits);
    await p.screenshot({ path: `${H.OUT}/guide_${mode}_recherche.png` });
    await p.locator('.guide-hit-title').first().click(); await p.waitForTimeout(300);
    check(`[${mode}] clic sur un résultat ouvre la section`, await ev(() => !!document.querySelector('.guide-sec.flash')));
    // langue du contenu
    const txt = await ev(() => document.querySelector('.guide-main').textContent);
    const fr = /\b(le|les|des|pour|avec)\b/.test(txt), en = /\b(the|with|your|and)\b/.test(txt);
    check(`[${mode}] contenu dans la bonne langue`, mode === 'en' ? en && !fr : fr, txt.slice(0, 80));
    // boutons « Essayer » : outil
    await p.locator('.guide-chap').nth(2).click(); await p.waitForTimeout(100);
    await p.locator('.guide-try').filter({ hasText: mode === 'en' ? 'Use the eraser' : 'Prendre la gomme' }).click();
    await p.waitForTimeout(300);
    check(`[${mode}] « Essayer » sélectionne l'outil et ferme le guide`, !(await open()) && (await ev(() => window.pixelAtelier.tools.current.id)) === 'eraser');
    // tous les boutons « Essayer » sans erreur
    await ev(() => window.pixelAtelier.openGuide());
    await p.waitForTimeout(300);
    const targets = await ev(async () => { const { GUIDE } = await import('./js/ui/guide-content.js'); const t = []; for (const c of GUIDE) for (const s of c.sections) for (const bl of s.body) if (bl.try) t.push([c.id, s.id, bl.try]); return t; });
    await close();
    const before = errs.length;
    let fine = 0;
    for (const [c, s, t] of targets) {
      await ev(([c, s]) => window.pixelAtelier.openGuide(c, s), [c, s]);
      await p.waitForTimeout(250);
      const btn = p.locator(`#guide-${c}-${s} .guide-try`).first();
      if (await btn.count()) { await btn.click(); fine++; }
      await p.waitForTimeout(450);
      for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(80); }
      await ev(() => { const app = window.pixelAtelier; if (app.timelineOpen) app.actions.toggleAnimation(); app.closeDrawer?.(); });
    }
    check(`[${mode}] ${targets.length} boutons « Essayer » sans erreur`, fine === targets.length && errs.length === before, `${fine}/${targets.length} ${errs.slice(before)[0] || ''}`);
    // débordement mobile
    if (mode === 'mobile') {
      await ev(() => window.pixelAtelier.openGuide('draw'));
      await p.waitForTimeout(300);
      const o = await ev(() => { const d = document.querySelector('.guide-dlg').getBoundingClientRect(); return { l: d.left, r: d.right, w: innerWidth, sw: document.documentElement.scrollWidth }; });
      check('[mobile] le guide tient dans l\'écran', o.l >= -1 && o.r <= o.w + 1 && o.sw <= o.w + 1, JSON.stringify(o));
      await p.screenshot({ path: `${H.OUT}/guide_mobile.png` });
    }
    if (mode === 'en') await ev(() => { window.pixelAtelier.setState({ lang: 'fr' }); window.pixelAtelier.savePrefs?.flush?.(); });
    H.summary(errs);
    H.results.length = 0;
    await b.close();
  }
})();
