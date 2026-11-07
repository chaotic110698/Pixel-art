const H = require('./h.js');
(async () => {
  for (const vp of [[1024, 640], [1366, 768], [844, 390], [768, 1024], [1920, 1080]]) {
    const { b, p, errs } = await H.open({ viewport: { width: vp[0], height: vp[1] } });
    await p.evaluate(async () => {
      const app = window.pixelAtelier;
      const { buildCharacter, DEFAULT_CHARACTER_3Q, PORTRAIT_COLORS } = await import('./js/library/character.js');
      app.setDoc(buildCharacter({ colors: PORTRAIT_COLORS, sel: DEFAULT_CHARACTER_3Q }));
    });
    await p.waitForTimeout(400);
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight, stage: (() => { const r = document.getElementById('view').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() }));
    H.check(`${vp.join('×')} : pas de débordement, zone de dessin ${o.stage.join('×')}`, o.sw <= o.w + 1 && o.sh <= o.h + 1 && o.stage[0] > 150 && o.stage[1] > 150, JSON.stringify(o));
    await p.screenshot({ path: `${H.OUT}/size_${vp.join('x')}.png` });
    H.summary(errs); H.results.length = 0;
    await b.close();
  }
})();
