// Interface anglaise : recherche des textes restés en français.
const H = require('./h.js');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { const app = window.pixelAtelier; app.setState({ lang: 'en' }); app.savePrefs?.flush?.(); });
  await p.reload();
  await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc);
  await p.waitForTimeout(800);
  await p.keyboard.press('Escape');
  await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter } = await import('./js/library/character.js');
    const { DEFAULT_COLORS } = await import('./js/library/builder.js');
    app.setDoc(buildCharacter({ colors: DEFAULT_COLORS }));
  });
  const found = new Map();
  const FR = /[éèêàùçôîûœ]|\b(le|la|les|des|du|et|pour|avec|sur|dans|calque|calques|ajouter|supprimer|fermer|annuler|aucun|aucune|couleur|couleurs|taille|nouveau|nouvelle|enregistrer|ouvrir|tête|yeux|bouche|cheveux|corps|vue|pièce|pièces|profil|groupe|fichier|outil|outils|grille|réglages|paramètres|clic)\b/i;
  const scan = async (where) => {
    const items = await ev(() => {
      const out = [];
      const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
      const walk = (n) => {
        if (n.nodeType === 1) {
          if (n.closest('[translate=no]') || ['SCRIPT', 'STYLE'].includes(n.tagName)) return;
          for (const a of ['title', 'aria-label', 'placeholder']) if (n.getAttribute(a) && vis(n)) out.push(n.getAttribute(a));
          for (const c of n.childNodes) walk(c);
        } else if (n.nodeType === 3) {
          const t = n.textContent.trim();
          if (t && n.parentElement && vis(n.parentElement) && !n.parentElement.closest('[translate=no]')) out.push(t);
        }
      };
      walk(document.body);
      return out;
    });
    for (const t of items) if (FR.test(t) && !/^(Language: )?Français$/.test(t) && !found.has(t)) found.set(t, where);
  };
  await scan('principal');
  // menu
  await p.click('#btn-menu', { timeout: 3000 }); await p.waitForTimeout(200); await scan('menu'); await p.keyboard.press('Escape');
  const actions = [
    ['newDocument'], ['newCharacter'], ['openProjects'], ['exportDialog'], ['resizeDialog'], ['openLibrary'], ['recolor'], ['openPngtuber'], ['replaceColorDialog'], ['outlineDialog'],
  ];
  for (const [a] of actions) {
    await ev((a) => { window.pixelAtelier.actions[a](); }, a);
    await p.waitForTimeout(700);
    await scan(a);
    if (a === 'openLibrary') {
      for (const cat of ['Bodies', 'Heads', 'Hair', 'Eyes', 'Eyebrows', 'Noses', 'Mouths', 'Clothes', 'Accessories', 'Hands']) {
        const c = p.locator('.tabs-row .chip', { hasText: cat }).first();
        if (await c.count()) { await c.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(250); await scan('library/' + cat); }
      }
      for (const view of ['3/4', 'Detailed portrait']) {
        const v = p.locator('.chip', { hasText: new RegExp('^' + view.replace('/', '\\/') + '$') }).first();
        if (await v.count()) { await v.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(250); for (const cat of ['Hair', 'Eyes', 'Accessories', 'Clothes', 'Bodies']) { const c = p.locator('.tabs-row .chip', { hasText: cat }).first(); if (await c.count()) { await c.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(250); await scan(`library ${view}/${cat}`); } } }
      }
    }
    if (a === 'newCharacter') {
      for (const view of ['3q', '3qd']) {
        await p.selectOption('.dlg label.field:has-text("View") select', view).catch(() => {});
        await p.waitForTimeout(300);
        await scan('newCharacter ' + view);
      }
    }
    for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(80); }
  }
  await ev(async () => (await import('./js/ui/tilemap.js')).openTilemap(window.pixelAtelier));
  await p.waitForTimeout(500); await scan('tilemap');
  for (let i = 0; i < 2; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(80); }
  await ev(() => window.pixelAtelier.openSettings());
  await p.waitForTimeout(300);
  const tabs = await ev(() => [...document.querySelectorAll('.set-tab')].length);
  for (let i = 0; i < tabs; i++) { await p.locator('.set-tab').nth(i).click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(500); await ev(() => document.querySelectorAll('.settings-body details').forEach((d) => { d.open = true; })); await scan('settings' + i); }
  await p.keyboard.press('Escape');
  for (const t of ['Expressions', 'Grid', 'History', 'Layers']) { const c = p.locator('#panel-tabs button', { hasText: t }).first(); if (await c.count()) { await c.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(200); await scan('panel ' + t); } }
  await p.keyboard.press('?'); await p.waitForTimeout(300); await scan('aide'); await p.keyboard.press('Escape');
  await ev(() => window.pixelAtelier.actions.toggleAnimation()); await p.waitForTimeout(400); await scan('timeline');
  await ev(() => window.pixelAtelier.startTutorial()); await p.waitForTimeout(400); await scan('tutoriel'); await p.keyboard.press('Escape');
  for (const id of ['pencil', 'fill', 'line', 'select', 'move', 'gradient', 'shade']) { await ev((id) => window.pixelAtelier.tools.select(id), id); await p.waitForTimeout(100); await scan('options ' + id); }
  console.log(`\n${found.size} textes encore en français :`);
  for (const [t, w] of found) console.log(`  [${w}] ${t.slice(0, 140)}`);
  check('Interface anglaise complète', found.size === 0, found.size + ' textes');
  // retour au français
  await ev(() => { window.pixelAtelier.setState({ lang: 'fr' }); window.pixelAtelier.savePrefs?.flush?.(); });
  H.summary(errs);
  await b.close();
})();
