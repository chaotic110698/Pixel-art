// Outils de dessin, historique, sélection, calques (vraie souris sur le canevas).
const H = require('./h.js');
(async () => {
  const { b, p, errs } = await H.open();
  const { check, drag, tool, count, px, blank } = H;
  await blank(p, 32, 32);
  const ev = (f, a) => p.evaluate(f, a);

  // --- crayon
  await tool(p, 'pencil');
  await drag(p, [[2, 2], [12, 2]]);
  check('Crayon : trait de 11 px', (await count(p)) === 11, await count(p));
  // clic droit = couleur B
  await drag(p, [[2, 4], [4, 4]], { button: 'right' });
  const a = await px(p, 2, 2), bb = await px(p, 2, 4);
  check('Clic droit = couleur B (différente de A)', a !== bb && bb >>> 24, `${a.toString(16)} / ${bb.toString(16)}`);
  // Maj = ligne depuis le dernier point
  await drag(p, [[4, 4]]);
  await drag(p, [[4, 10]], { mods: ['Shift'] });
  check('Crayon Maj : ligne droite depuis le dernier point', (await px(p, 4, 7)) >>> 24 !== 0);
  // taille 3
  await ev(() => window.pixelAtelier.setState({ brushSize: 3 }));
  const before = await count(p);
  await drag(p, [[20, 20]]);
  check('Pinceau taille 3', (await count(p)) - before >= 8, (await count(p)) - before);
  await ev(() => window.pixelAtelier.setState({ brushSize: 1 }));

  // --- gomme
  await tool(p, 'eraser');
  await drag(p, [[2, 2], [6, 2]]);
  check('Gomme', (await px(p, 3, 2)) === 0 && (await px(p, 8, 2)) !== 0);

  // --- annuler / rétablir
  const n1 = await count(p);
  await ev(() => window.pixelAtelier.history.undo());
  check('Annuler la gomme', (await count(p)) > n1);
  await ev(() => window.pixelAtelier.history.redo());
  check('Rétablir la gomme', (await count(p)) === n1);
  await p.keyboard.press('Control+z');
  check('Ctrl+Z', (await count(p)) > n1);
  await p.keyboard.press('Control+y');
  check('Ctrl+Y', (await count(p)) === n1);

  // --- remplissage
  await blank(p, 32, 32);
  await tool(p, 'rect');
  await ev(() => window.pixelAtelier.setState({ shapeFill: false }));
  await drag(p, [[5, 5], [15, 15]]);
  const rectN = await count(p);
  check('Rectangle (contour) 11×11', rectN === 40, rectN);
  await tool(p, 'fill');
  await drag(p, [[10, 10]]);
  check('Remplissage intérieur', (await count(p)) === 121, await count(p));
  await drag(p, [[0, 0]]);
  check('Remplissage extérieur (tout le reste)', (await count(p)) === 1024, await count(p));
  await ev(() => window.pixelAtelier.history.undo());

  // --- pipette
  await ev(() => window.pixelAtelier.setColor('primary', '#123456'));
  await tool(p, 'picker');
  await drag(p, [[5, 5]]);
  const prim = await ev(() => window.pixelAtelier.state.primary);
  check('Pipette', prim.toLowerCase() !== '#123456', prim);

  // --- ligne, ellipse, dégradé, ombrage
  await blank(p, 32, 32);
  await tool(p, 'line');
  await drag(p, [[0, 0], [31, 31]]);
  check('Ligne diagonale 32 px', (await count(p)) === 32, await count(p));
  await blank(p, 32, 32);
  await tool(p, 'ellipse');
  await drag(p, [[4, 4], [20, 14]]);
  check('Ellipse', (await count(p)) > 20, await count(p));
  await blank(p, 32, 32);
  await tool(p, 'gradient');
  await drag(p, [[0, 16], [31, 16]]);
  const gN = await count(p);
  check('Dégradé tramé', gN > 100, gN);
  await tool(p, 'shade');
  const c0 = await px(p, 16, 16);
  await drag(p, [[16, 16]], { button: 'right' });
  const c1 = await px(p, 16, 16);
  check('Ombrage (change la couleur)', c0 !== c1 || c0 === 0, `${c0.toString(16)} → ${c1.toString(16)}`);

  // --- symétrie
  await blank(p, 32, 32);
  await ev(() => window.pixelAtelier.setState({ symmetry: 'v' }));
  await tool(p, 'pencil');
  await drag(p, [[3, 3]]);
  check('Symétrie verticale', (await px(p, 28, 3)) >>> 24 !== 0);
  await ev(() => window.pixelAtelier.setState({ symmetry: 'none' }));

  // --- sélection rectangle + déplacement + annuler
  await blank(p, 32, 32);
  await tool(p, 'rect');
  await ev(() => window.pixelAtelier.setState({ shapeFill: true }));
  await drag(p, [[2, 2], [5, 5]]);
  await tool(p, 'select');
  await drag(p, [[1, 1], [6, 6]]);
  check('Sélection rectangle active', await ev(() => window.pixelAtelier.selection.active));
  await tool(p, 'move');
  await drag(p, [[3, 3], [13, 13]]);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(80);
  check('Déplacer la sélection (+10,+10)', (await px(p, 13, 13)) !== 0 && (await px(p, 3, 3)) === 0, `${await px(p, 13, 13)} / ${await px(p, 3, 3)}`);
  await ev(() => window.pixelAtelier.history.undo());
  check('Annuler le déplacement', (await px(p, 3, 3)) !== 0 && (await px(p, 13, 13)) === 0);

  // copier / coller / supprimer
  await p.keyboard.press('Control+a');
  await p.keyboard.press('Control+c');
  await p.keyboard.press('Control+v');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Control+d');
  check('Copier / coller sans erreur', (await count(p)) === 16, await count(p));
  await tool(p, 'select');
  await drag(p, [[0, 0], [31, 31]]);
  await p.keyboard.press('Delete');
  check('Suppr efface la sélection', (await count(p)) === 0, await count(p));
  await p.keyboard.press('Control+z');
  check('Annuler Suppr', (await count(p)) === 16);
  await p.keyboard.press('Escape');

  // baguette magique + lasso
  await tool(p, 'wand');
  await drag(p, [[3, 3]]);
  const wandN = await ev(() => { const s = window.pixelAtelier.selection; let n = 0; for (const v of s.mask) n += v ? 1 : 0; return n; });
  check('Baguette magique (16 px)', wandN === 16, wandN);
  await tool(p, 'lasso');
  await drag(p, [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]);
  const lassoN = await ev(() => { const s = window.pixelAtelier.selection; let n = 0; for (const v of s.mask) n += v ? 1 : 0; return n; });
  check('Lasso', lassoN > 60, lassoN);
  await p.keyboard.press('Escape');

  // flèches + miroir + rotation libre
  await tool(p, 'wand');
  await drag(p, [[3, 3]]);
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  check('Flèche → déplace de 1 px', (await px(p, 6, 3)) !== 0 && (await px(p, 2, 3)) === 0);
  await p.keyboard.press('Control+z');
  await tool(p, 'wand');
  await drag(p, [[3, 3]]);
  await p.keyboard.press('Control+t');
  await ev(() => window.pixelAtelier.actions.updateTransform({ angle: 45 }));
  await p.keyboard.press('Enter');
  await p.waitForTimeout(100);
  check('Rotation libre 45°', (await count(p)) >= 10, await count(p));
  await p.keyboard.press('Control+z');
  check('Annuler rotation', (await count(p)) === 16, await count(p));
  await p.keyboard.press('Escape');

  // --- calques
  const L = await ev(async () => {
    const app = window.pixelAtelier;
    const ops = await import('./js/core/layer-ops.js');
    const d = app.doc;
    const base = d.activeId;
    ops.addLayer(app);
    const l2 = d.activeId;
    ops.duplicate(app);
    const n3 = d.allLayers().length;
    ops.groupActive(app, true);
    const g = d.get(d.activeId).type === 'group' ? d.activeId : d.get(d.activeId).parent;
    const isVar = d.get(g)?.variant;
    app.history.undo();
    app.history.undo();
    ops.toggleLock(app, base);
    d.activeId = base;
    return { n3, isVar, after: d.allLayers().length, locked: d.get(base).locked, l2 };
  });
  check('Calques : ajouter + dupliquer', L.n3 === 3, L.n3);
  check('Grouper en variantes', L.isVar === true);
  check('Annuler groupe + duplication', L.after === 2, L.after);
  await tool(p, 'pencil');
  const lockedBefore = await count(p);
  await drag(p, [[25, 25]]);
  check('Calque verrouillé : pas de dessin', (await count(p)) === lockedBefore);
  await ev(async () => { const ops = await import('./js/core/layer-ops.js'); const app = window.pixelAtelier; ops.toggleLock(app, app.doc.activeId); });
  const mg = await ev(async () => {
    const app = window.pixelAtelier;
    const ops = await import('./js/core/layer-ops.js');
    const d = app.doc;
    // calque du dessus avec un pixel, fusion vers le bas
    ops.addLayer(app);
    const top = d.activeLayer;
    top.cels[0][31 * 32 + 31] = 0xff0000ff;
    app.markLayerDirty(top.cels[0]);
    ops.mergeDown(app);
    const merged = d.activeLayer;
    return { layers: d.allLayers().length, px: merged.cels[0][31 * 32 + 31] >>> 0 };
  });
  check('Fusionner vers le bas', mg.layers === 2 && mg.px === 0xff0000ff, JSON.stringify(mg));

  // --- opérations d'image
  const io = await ev(async () => {
    const app = window.pixelAtelier;
    const img = await import('./js/core/image-ops.js');
    const r = {};
    img.resizeCanvas(app, 48, 40, 'c'); r.resize = app.doc.width + 'x' + app.doc.height;
    img.scaleImage(app, 96, 80); r.scale = app.doc.width + 'x' + app.doc.height;
    img.flipDoc(app, 'x'); img.rotateDoc(app, 1); r.rot = app.doc.width + 'x' + app.doc.height;
    img.cropToContent(app); r.crop = app.doc.width + 'x' + app.doc.height;
    for (let i = 0; i < 5; i++) app.history.undo();
    r.undo = app.doc.width + 'x' + app.doc.height;
    return r;
  });
  check('Taille du canevas / échelle / rotation / recadrage / annuler', io.resize === '48x40' && io.scale === '96x80' && io.rot === '80x96' && io.undo === '32x32', JSON.stringify(io));

  // --- raccourcis d'outils
  const keys = { b: 'pencil', e: 'eraser', g: 'fill', i: 'picker', l: 'line', u: 'rect', o: 'ellipse', m: 'select', q: 'lasso', w: 'wand', v: 'move', h: 'hand', k: 'shade', j: 'gradient' };
  let okKeys = 0;
  for (const [k, id] of Object.entries(keys)) {
    await p.keyboard.press(k);
    if ((await ev(() => window.pixelAtelier.tools.current.id)) === id) okKeys++;
  }
  check('Raccourcis d\'outils', okKeys === Object.keys(keys).length, `${okKeys}/${Object.keys(keys).length}`);

  H.summary(errs);
  await b.close();
})();
