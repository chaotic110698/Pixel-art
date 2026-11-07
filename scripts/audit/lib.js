// Bibliothèque : chaque pièce, chaque état ; nouveaux personnages au hasard ; recoloration.
const H = require('./h.js');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  const r = await ev(async () => {
    const app = window.pixelAtelier;
    const lib = await import('./js/library/library.js');
    const ch = await import('./js/library/character.js');
    const { DEFAULT_COLORS, roleColors } = await import('./js/library/builder.js');
    const out = { empty: [], err: [], missingStates: [], badRole: [], n: 0, dupIds: [] };
    const ids = new Set();
    const known = new Set(Object.keys(roleColors(DEFAULT_COLORS)).map((k) => k.charCodeAt(0)));
    const STATES = { eyes: ['open', 'closed', 'happy', 'surprised'], mouth: ['closed', 'half', 'open', 'smile', 'sad', 'surprised'], brows: ['normal', 'high', 'angry', 'sad'] };
    for (const c of lib.CATEGORIES) {
      for (const piece of c.pieces) {
        out.n++;
        if (ids.has(piece.id)) out.dupIds.push(piece.id);
        ids.add(piece.id);
        const bts = piece.fitsBody ? (lib.viewOf(piece) === '3q' ? ['3q-fin', '3q-moyen', '3q-costaud', '3q-rond'] : ['fin', 'moyen', 'large', 'rond', 'entier-fin', 'entier-moyen']) : [lib.bodyTypeForView('moyen', lib.viewOf(piece))];
        for (const bt of bts) {
          let layers;
          try { layers = piece.build({ bodyType: bt }); } catch (e) { out.err.push(piece.id + ': ' + e.message); continue; }
          for (const L of layers) {
            const grids = L.variants ? L.variants.map((v) => v.grid) : [L.grid];
            for (const g of grids) {
              if (!g || g.isEmpty?.() || !g.a.some((v) => v)) out.empty.push(`${piece.id}/${L.name}`);
              else for (const v of g.a) if (v && !known.has(v)) { out.badRole.push(`${piece.id}:${String.fromCharCode(v)}`); break; }
            }
            if (L.variants && STATES[L.role]) {
              const have = new Set(L.variants.map((v) => v.state));
              const miss = STATES[L.role].filter((s) => !have.has(s));
              if (miss.length) out.missingStates.push(`${piece.id}: ${miss.join(',')}`);
            }
          }
        }
        // insertion réelle dans un document
        try {
          const base = lib.VIEW_BASE[lib.viewOf(piece)];
          const d = ch.buildCharacter({ colors: DEFAULT_COLORS, sel: lib.viewOf(piece) === '3q' ? ch.DEFAULT_CHARACTER_3Q : ch.DEFAULT_CHARACTER });
          lib.insertPiece(d, piece, { replace: true });
          void base;
        } catch (e) { out.err.push('insert ' + piece.id + ': ' + e.message); }
      }
    }
    // personnages au hasard (chaque vue)
    let built = 0;
    for (let i = 0; i < 30; i++) {
      const view = i % 2 ? '3q' : 'front';
      const sel = { accessories: [] };
      for (const k of ['body', 'head', 'hair', 'eyes', 'brows', 'nose', 'mouth', 'top']) {
        const list = lib.CATEGORIES.find((c) => c.id === k).pieces.filter((p) => lib.viewOf(p) === view);
        sel[k] = list[Math.floor(Math.random() * list.length)].id;
      }
      const acc = lib.CATEGORIES.find((c) => c.id === 'accessory').pieces.filter((p) => lib.viewOf(p) === view);
      sel.accessories = [acc[i % acc.length].id];
      try {
        const d = ch.buildCharacter({ colors: DEFAULT_COLORS, sel, scale: i % 4 === 0 ? 2 : 1 });
        if (d.expressions.length === 7 && d.pngtuber.mouthGroup && d.pngtuber.eyesGroup) built++;
        else out.err.push('perso incomplet ' + JSON.stringify(sel));
      } catch (e) { out.err.push('perso ' + e.message); }
    }
    out.built = built;
    // recoloration annulable
    const { recolorDoc } = await import('./js/library/library-ui.js');
    app.setDoc(ch.buildCharacter({ colors: DEFAULT_COLORS }));
    const l = app.doc.allLayers().find((x) => x.part?.category === 'head');
    const before = l.cels[0].slice();
    recolorDoc(app, { ...DEFAULT_COLORS, skin: '#7a4428' });
    const changed = l.cels[0].some((v, i) => v !== before[i]);
    app.history.undo();
    const restored = l.cels[0].every((v, i) => v === before[i]) || app.doc.allLayers().find((x) => x.part?.category === 'head').cels[0].every((v, i) => v === before[i]);
    out.recolor = { changed, restored };
    return out;
  });
  check(`${r.n} pièces construites sans erreur`, r.err.length === 0, r.err.slice(0, 6).join(' | '));
  check('Identifiants de pièces uniques', r.dupIds.length === 0, r.dupIds.join(','));
  check('Aucune grille vide', r.empty.length === 0, r.empty.slice(0, 10).join(' | '));
  check('Rôles de couleur connus', r.badRole.length === 0, [...new Set(r.badRole)].slice(0, 10).join(' | '));
  check('Tous les états (yeux, bouche, sourcils)', r.missingStates.length === 0, r.missingStates.join(' | '));
  check('30 personnages au hasard (face / 3/4, ×1 / ×2)', r.built === 30, r.built);
  check('Recoloration + annuler', r.recolor.changed && r.recolor.restored, JSON.stringify(r.recolor));

  // fenêtres (UI) : bibliothèque dans les deux vues, recherche, favoris
  await ev(() => window.pixelAtelier.actions.openLibrary('hair'));
  await p.waitForTimeout(600);
  await p.locator('.lib-card .fav').first().click();
  check('Favori ajouté', await ev(() => (window.pixelAtelier.state.libFavorites || []).length >= 1));
  await p.fill('.dlg-body input[type=search]', 'lunettes');
  await p.waitForTimeout(300);
  check('Recherche « lunettes »', (await p.locator('.lib-card').count()) >= 4, await p.locator('.lib-card').count());
  await p.keyboard.press('Escape');
  H.summary(errs);
  await b.close();
})();
