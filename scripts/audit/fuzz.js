// Fuzz : opérations aléatoires, puis annuler tout / rétablir tout avec comparaison exacte des états.
const H = require('./h.js');
(async () => {
  const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
  const { b, p, errs } = await H.open();
  const { check } = H;
  for (const seed of seeds) {
    const r = await p.evaluate(async ([seed, N]) => {
      const app = window.pixelAtelier;
      const ops = await import('./js/core/layer-ops.js');
      const img = await import('./js/core/image-ops.js');
      const tl = await import('./js/ui/timeline.js');
      const { Doc } = await import('./js/core/doc.js');
      const { buildCharacter } = await import('./js/library/character.js');
      const { DEFAULT_COLORS } = await import('./js/library/builder.js');
      let s = seed * 9301 + 49297;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const ri = (n) => Math.floor(rnd() * n);
      app.setDoc(seed % 2 ? buildCharacter({ colors: DEFAULT_COLORS }) : (() => { const d = new Doc(24, 20, 'F'); const l = d.createLayer('A'); d.insert(l, 'root'); d.activeId = l.id; return d; })());
      const hashCel = (c) => { let h = 2166136261; for (let i = 0; i < c.length; i++) { h ^= c[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
      const state = () => {
        const d = app.doc;
        const nodes = [];
        const visit = (n, depth) => {
          nodes.push([n.id, n.type, n.name, n.visible, n.locked, n.opacity, n.variant || false, n.active || null, depth, n.type === 'layer' ? n.cels.map(hashCel).join('.') : '']);
          if (n.children) for (const c of n.children) visit(d.get(c), depth + 1);
        };
        visit(d.root, 0);
        return JSON.stringify([d.width, d.height, d.frames.length, d.frames.map((f) => f.duration), d.tags, d.expressions.map((e) => [e.name, e.states]), d.profiles.map((p) => p.name), nodes]);
      };
      const diff = (a, b) => {
        const lab = ['w', 'h', 'frames', 'durations', 'tags', 'expr', 'profiles'];
        for (let i = 0; i < 7; i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return `${lab[i]}: ${JSON.stringify(a[i]).slice(0, 200)} ≠ ${JSON.stringify(b[i]).slice(0, 200)}`;
        const A = a[7], B = b[7];
        if (A.length !== B.length) return `nb nœuds ${A.length} ≠ ${B.length}`;
        const f = ['id', 'type', 'name', 'visible', 'locked', 'opacity', 'variant', 'active', 'depth', 'cels'];
        for (let i = 0; i < A.length; i++) for (let j = 0; j < f.length; j++) if (JSON.stringify(A[i][j]) !== JSON.stringify(B[i][j])) return `nœud ${i} (${A[i][2]}) ${f[j]}: ${JSON.stringify(A[i][j]).slice(0, 80)} ≠ ${JSON.stringify(B[i][j]).slice(0, 80)}`;
        return '?';
      };
      const layers = () => app.doc.allLayers().filter((l) => !l.reference);
      const paint = () => {
        const d = app.doc;
        const l = layers()[ri(layers().length)];
        if (!l || l.locked) return 'skip';
        d.activeId = l.id;
        const t = app.history.beginPixels(l);
        const x0 = ri(d.width), y0 = ri(d.height), w = 1 + ri(6), h = 1 + ri(6), c = (0xff000000 | ri(0xffffff)) >>> 0;
        for (let y = y0; y < Math.min(d.height, y0 + h); y++) for (let x = x0; x < Math.min(d.width, x0 + w); x++) t.cel[y * d.width + x] = rnd() < 0.15 ? 0 : c;
        app.markLayerDirty(t.cel, x0, y0, x0 + w, y0 + h);
        app.history.endPixels(t, 'Fuzz');
        return 'paint';
      };
      const OPS = [
        [6, paint],
        [1, () => { ops.addLayer(app); return 'add'; }],
        [1, () => { ops.duplicate(app); return 'dup'; }],
        [1, () => { if (layers().length > 1) { ops.removeNode(app, layers()[ri(layers().length)].id); return 'rm'; } return 'skip'; }],
        [1, () => { const l = layers()[ri(layers().length)]; ops.moveNode(app, l.id, rnd() < 0.5 ? -1 : 1); return 'move'; }],
        [1, () => { const l = layers()[ri(layers().length)]; ops.toggleVisible(app, l.id); return 'vis'; }],
        [1, () => { const all = layers(); if (all.length < 2) return 'skip'; app.doc.activeId = all[ri(all.length)].id; ops.mergeDown(app); return 'merge'; }],
        [1, () => { app.doc.activeId = layers()[ri(layers().length)].id; ops.groupActive(app, rnd() < 0.5); return 'group'; }],
        [1, () => { tl.addFrame(app, ['empty', 'copy', 'linked'][ri(3)]); return 'frame+'; }],
        [0.5, () => { if (app.doc.frames.length > 1) { tl.deleteFrame(app); return 'frame-'; } return 'skip'; }],
        [1, () => { tl.setFrame(app, ri(app.doc.frames.length)); return 'setframe'; }],
        [0.5, () => { img.flipDoc(app, rnd() < 0.5 ? 'h' : 'v'); return 'flip'; }],
        [0.4, () => { img.rotateDoc(app, rnd() < 0.5 ? 1 : -1); return 'rot'; }],
        [0.4, () => { img.resizeCanvas(app, 16 + ri(24), 16 + ri(24), ['c', 'tl', 'b'][ri(3)]); return 'resize'; }],
        [0.4, () => { const d = app.doc; app.selection.apply(app.selection.rectMask(ri(d.width), ri(d.height), ri(d.width), ri(d.height))); app.selection.lift(); app.selection.moveFloating(ri(5) - 2, ri(5) - 2); app.selection.commitFloating(); app.selection.deselect(); return 'selmove'; }],
        [0.5, () => { ops.saveExpression(app, 'E' + ri(100)); return 'expr'; }],
        [0.3, () => { if (app.doc.expressions.length) { ops.applyExpression(app, app.doc.expressions[ri(app.doc.expressions.length)].id); return 'applyexpr'; } return 'skip'; }],
        [0.3, () => { ops.saveProfile(app, 'P' + ri(100)); return 'profile'; }],
        [0.3, () => { const n = app.doc.frames.length; const a = ri(n); tl.addTag(app, 'T' + ri(9), a, Math.min(n - 1, a + ri(3))); return 'tag'; }],
      ];
      const total = OPS.reduce((a, [w]) => a + w, 0);
      const pick = () => { let x = rnd() * total; for (const [w, f] of OPS) { if ((x -= w) <= 0) return f; } return OPS[0][1]; };
      app.history.clear?.();
      const states = [state()];
      const log = [];
      const steps = [];
      const multi = [];
      const depth0 = app.history.undoStack.length;
      for (let i = 0; i < N; i++) {
        const before = app.history.undoStack.length;
        let name;
        try { name = pick()(); } catch (e) { return { err: `étape ${i} (${log.slice(-3).join(',')}) : ${e.message}\n${e.stack}` }; }
        const after = app.history.undoStack.length;
        if (after > before) { states.push(state()); log.push(name); steps.push(after - before); if (after - before > 1 && name !== 'selmove') multi.push(name + '×' + (after - before)); }
        else if (after < before) return { err: `étape ${i} ${name} : pile d'annulation réduite` };
        else if (state() !== states[states.length - 1] && name !== 'setframe') { log.push(name + '(SANS HISTORIQUE)'); states[states.length - 1] = state(); }
      }
      // annuler tout
      const mism = [];
      for (let k = states.length - 1; k > 0; k--) {
        for (let q = 0; q < steps[k - 1]; q++) app.history.undo();
        if (state() !== states[k - 1]) { mism.push(`annuler → ${k - 1} après « ${log[k - 1]} » (précédent : ${log.slice(Math.max(0, k - 4), k - 1).join(',')}) ` + diff(JSON.parse(state()), JSON.parse(states[k - 1]))); break; }
      }
      for (let k = 1; k < states.length; k++) {
        for (let q = 0; q < steps[k - 1]; q++) app.history.redo();
        if (state() !== states[k]) { mism.push(`rétablir → ${k} « ${log[k - 1]} »`); break; }
      }
      const noHist = log.filter((x) => x.includes('SANS'));
      return { multi: [...new Set(multi)], n: states.length - 1, mism, noHist: [...new Set(noHist)], final: states[states.length - 1].length, depth0 };
    }, [seed, 250]);
    if (r.err) { check(`Fuzz ${seed}`, false, r.err); continue; }
    check(`Fuzz ${seed} : ${r.n} actions, annuler/rétablir exacts`, r.mism.length === 0, r.mism.join(' | '));
    check(`Fuzz ${seed} : une action = une entrée d'historique`, r.multi.length === 0, r.multi.join(','));
    check(`Fuzz ${seed} : toutes les actions annulables`, r.noHist.length === 0, r.noHist.join(','));
    // persistance
    const h1 = await p.evaluate(async () => { const app = window.pixelAtelier; await app.storage.saveNow(); const d = app.doc; let h = 0; for (const l of d.allLayers()) for (const c of l.cels) for (let i = 0; i < c.length; i += 1) h = (h * 31 + c[i]) | 0; return [d.id, h, d.allLayers().length, d.frames.length, d.width, d.height].join('/'); });
    await p.reload();
    await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc);
    await p.waitForTimeout(700);
    await p.keyboard.press('Escape');
    const h2 = await p.evaluate(() => { const d = window.pixelAtelier.doc; let h = 0; for (const l of d.allLayers()) for (const c of l.cels) for (let i = 0; i < c.length; i += 1) h = (h * 31 + c[i]) | 0; return [d.id, h, d.allLayers().length, d.frames.length, d.width, d.height].join('/'); });
    check(`Fuzz ${seed} : identique après rechargement`, h1 === h2, `${h1} vs ${h2}`);
  }
  H.summary(errs);
  await b.close();
})();
