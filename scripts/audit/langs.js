// Langues de l'interface : chaque fichier de langue est complet, ses modèles de messages
// sont cohérents avec les motifs, et l'interface s'affiche sans erreur dans chaque langue.
const H = require('./h.js');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  const info = await ev(async () => {
    const { LANGS } = await import('./js/ui/i18n.js');
    const { EN } = await import('./js/ui/i18n-en.js');
    const src = await (await fetch('./js/ui/i18n.js')).text();
    const pats = src.split('\n').filter((l) => /^ {2}\[\/\^/.test(l)).map((l) => l.slice(l.indexOf('/') + 1, l.indexOf('/, ')));
    const groups = pats.map((r) => { try { return new RegExp(r).exec('') ? 0 : (new RegExp(r + '|').exec('').length - 1); } catch (_) { return -1; } });
    const out = {};
    for (const [id] of LANGS) {
      if (id === 'fr' || id === 'en') continue;
      const mod = await import(`./js/ui/lang/${id}.js`);
      const missing = Object.keys(EN).filter((k) => !(k in mod.DICT)).length;
      const empty = Object.values(mod.DICT).filter((v) => !String(v).trim()).length;
      const bad = [];
      (mod.P || []).forEach((t, i) => {
        if (!t) return;
        for (const m of t.matchAll(/\{[?TCK]?(\d)/g)) if (+m[1] > groups[i]) bad.push(`${i}:{${m[1]}}`);
      });
      out[id] = { missing, empty, patterns: (mod.P || []).length, expected: pats.length, bad };
    }
    return out;
  });
  for (const [id, r] of Object.entries(info)) {
    check(`[${id}] dictionnaire complet et modèles cohérents`, r.missing === 0 && r.empty === 0 && r.patterns === r.expected && !r.bad.length, JSON.stringify(r));
  }
  // affichage réel dans chaque langue
  for (const id of Object.keys(info)) {
    await ev((l) => { const app = window.pixelAtelier; app.setState({ lang: l }); app.savePrefs.flush?.(); }, id);
    await p.reload();
    await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc);
    await p.waitForTimeout(500);
    await p.keyboard.press('Escape');
    const r = await ev(async (l) => {
      const { DICT } = await import(`./js/ui/lang/${l}.js`);
      const app = window.pixelAtelier;
      app.toast('Projet enregistré sur cet appareil');
      await new Promise((res) => setTimeout(res, 200));
      const toast = [...document.querySelectorAll('.toast, #toast, [role=status]')].map((e) => e.textContent).join(' ');
      return { html: document.documentElement.lang, title: document.querySelector('#btn-menu')?.getAttribute('title'), want: DICT['Menu principal'] || DICT.Menu, toast, wantToast: DICT['Projet enregistré sur cet appareil'] };
    }, id);
    check(`[${id}] interface traduite (menu, messages)`, r.html === id && r.toast.includes(r.wantToast), JSON.stringify(r).slice(0, 200));
  }
  await ev(() => { window.pixelAtelier.setState({ lang: 'fr' }); window.pixelAtelier.savePrefs.flush?.(); });
  H.summary(errs);
  await b.close();
})();
