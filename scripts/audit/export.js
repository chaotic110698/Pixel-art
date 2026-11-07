// Animation, exports (fichiers relus en Python), projets, persistance.
const H = require('./h.js');
const fs = require('fs');
const { execFileSync } = require('child_process');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);

  // personnage complet + animation
  const info = await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter, DEFAULT_CHARACTER } = await import('./js/library/character.js');
    const { DEFAULT_COLORS } = await import('./js/library/builder.js');
    const ops = await import('./js/core/layer-ops.js');
    const d = buildCharacter({ colors: DEFAULT_COLORS, sel: DEFAULT_CHARACTER, name: 'Audit' });
    app.setDoc(d);
    ops.saveProfile(app, 'Profil A');
    return { layers: d.allLayers().length, expr: d.expressions.length, groups: d.variantGroups().length };
  });
  check('Personnage créé', info.layers > 10 && info.expr === 7, JSON.stringify(info));

  // timeline
  await ev(() => window.pixelAtelier.actions.toggleAnimation());
  await p.waitForTimeout(400);
  check('Timeline affichée', await ev(() => !document.getElementById('timeline').hidden));
  const tl = await ev(async () => {
    const app = window.pixelAtelier;
    const tlm = await import('./js/ui/timeline.js');
    const names = Object.keys(tlm);
    const d = app.doc;
    // ajouter 3 images via les fonctions exportées si disponibles, sinon via le doc
    if (tlm.addFrame) { tlm.addFrame(app); tlm.addFrame(app); tlm.addFrame(app); }
    return { names, frames: d.frames.length };
  });
  console.log('   timeline exports:', tl.names.join(', '));
  check('Ajout d\'images d\'animation', tl.frames >= 4, tl.frames);

  // boutons de la timeline : on clique sur tout ce qui ressemble à « ajouter »
  const btns = await ev(() => [...document.querySelectorAll('#timeline button')].map((x) => x.title || x.getAttribute('aria-label') || x.textContent).filter(Boolean));
  console.log('   boutons timeline:', btns.slice(0, 30).join(' | '));
  await p.screenshot({ path: H.OUT + '/timeline.png' });

  await ev(async () => { const t = await import('./js/ui/timeline.js'); t.setFrame(window.pixelAtelier, 0); });
  // exports
  const kinds = ['png', 'pack', 'pngtuber', 'obs', 'psd', 'layers', 'variants', 'expressions', 'profiles', 'combos', 'sheet', 'gif', 'frames'];
  for (const kind of kinds) {
    const r = await ev(async (kind) => {
      const app = window.pixelAtelier;
      const { runExport } = await import('./js/export/exporter.js');
      try {
        const t0 = performance.now();
        const r = await runExport(app, kind, { scale: 2, crop: 'none', includeProject: true, includeCombos: false, sheetCols: 4, spacing: 1, sheetJson: true, perTag: false });
        const buf = new Uint8Array(await r.blob.arrayBuffer());
        let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return { ok: true, name: r.filename, count: r.count, size: buf.length, b64: btoa(s), ms: Math.round(performance.now() - t0) };
      } catch (e) { return { ok: false, err: String(e && e.stack || e) }; }
    }, kind);
    if (!r.ok) { check(`Export ${kind}`, false, r.err); continue; }
    const f = H.OUT + '/' + r.name;
    fs.writeFileSync(f, Buffer.from(r.b64, 'base64'));
    let verdict = '';
    try { verdict = execFileSync('python3', [__dirname + '/verify.py', f], { encoding: 'utf8' }).trim(); } catch (e) { verdict = e.code === 'ENOENT' ? 'non relu (python3 absent)' : 'ERREUR ' + (e.stdout || e.message); }
    check(`Export ${kind} → ${r.name}`, !verdict.startsWith('ERREUR'), `${r.count} img, ${r.size} o, ${r.ms} ms — ${verdict}`);
  }

  // sauvegarde + rechargement
  const id = await ev(async () => { const app = window.pixelAtelier; await app.storage.saveNow(); return app.doc.id; });
  await p.reload();
  await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc);
  await p.waitForTimeout(800);
  const after = await ev(() => { const d = window.pixelAtelier.doc; return { id: d.id, name: d.name, layers: d.allLayers().length, frames: d.frames.length, profiles: d.profiles.length, expr: d.expressions.length }; });
  check('Rechargement : projet restauré', after.id === id && after.layers === info.layers && after.frames >= 4 && after.profiles === 1, JSON.stringify(after));

  // fichier projet : sérialiser / relire
  const rt = await ev(async () => {
    const app = window.pixelAtelier;
    const ser = await import('./js/storage/serialize.js');
    const names = Object.keys(ser);
    const toJ = ser.docToFileJSON;
    const fromJ = ser.fileJSONToDoc;
    if (!toJ || !fromJ) return { names };
    const j = await toJ(app.doc);
    const d2 = await fromJ(typeof j === 'string' ? j : JSON.stringify(j));
    const a = app.doc.allLayers(), b2 = d2.allLayers();
    let same = a.length === b2.length;
    for (let i = 0; same && i < a.length; i++) for (let f = 0; f < a[i].cels.length; f++) { const x = a[i].cels[f], y = b2[i].cels[f]; if (x.length !== y.length || x.some((v, k) => v !== y[k])) { same = false; break; } }
    return { names, same, frames: d2.frames.length };
  });
  check('Fichier projet : aller-retour identique', rt.same === true, JSON.stringify(rt));

  // fenêtre Projets
  await ev(() => window.pixelAtelier.actions.openProjects());
  await p.waitForTimeout(600);
  const nProj = await ev(() => document.querySelectorAll('.dlg-body .card, .dlg-body .project').length);
  check('Fenêtre Projets', nProj >= 1, nProj);
  await p.screenshot({ path: H.OUT + '/projects.png' });
  await p.keyboard.press('Escape');

  // fenêtre Export (UI)
  await ev(() => window.pixelAtelier.actions.exportDialog());
  await p.waitForTimeout(500);
  const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await p.locator('.dlg-foot button', { hasText: 'Exporter' }).click();
  const d = await dl;
  check('Export depuis la fenêtre (téléchargement)', !!d, d ? d.suggestedFilename() : 'aucun');
  await p.keyboard.press('Escape');

  H.summary(errs);
  await b.close();
})();
