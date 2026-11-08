// Carte de tuiles : peinture (pinceau, hasard, rectangle), annuler, suivi du dessin,
// enregistrement dans le projet, exports PNG et Tiled.
const H = require('./h.js');
const fs = require('fs');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);
  await ev(async () => {
    const app = window.pixelAtelier;
    const { Doc } = await import('./js/core/doc.js');
    const d = new Doc(32, 32, 'Tuiles');
    const l = d.createLayer('Calque 1'); d.insert(l, 'root'); d.activeId = l.id;
    const C = [0xff3fa04a, 0xff2b5a8a, 0xffd88a3a, 0xff3a3ab0];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) l.cels[0][y * 32 + x] = C[(y >> 4) * 2 + (x >> 4)];
    d.grid.cellW = 16; d.grid.cellH = 16;
    app.setDoc(d);
    (await import('./js/ui/tilemap.js')).openTilemap(app);
  });
  await p.waitForTimeout(400);
  const ts = await p.locator('.tm-tileset').boundingBox();
  const mp = await p.locator('.tm-map').boundingBox();
  const cw = mp.width / 20, ch = mp.height / 12;
  await p.mouse.click(ts.x + ts.width * 0.75, ts.y + ts.height * 0.25);
  await p.mouse.move(mp.x + cw * 0.5, mp.y + ch * 0.5); await p.mouse.down();
  for (let i = 1; i < 6; i++) await p.mouse.move(mp.x + cw * (i + 0.5), mp.y + ch * 0.5);
  await p.mouse.up();
  const line = await ev(() => window.pixelAtelier.doc.tilemaps[0].cells.slice(0, 7));
  check('Pinceau : une ligne de 6 tuiles', line.slice(0, 6).every((v) => v === 1) && line[6] === -1, JSON.stringify(line));
  await p.mouse.click(ts.x + ts.width * 0.25, ts.y + ts.height * 0.75);
  await p.keyboard.down('Shift'); await p.mouse.click(ts.x + ts.width * 0.75, ts.y + ts.height * 0.75); await p.keyboard.up('Shift');
  await p.locator('.tm-head button[aria-label="Rectangle de tuiles"]').click();
  await p.mouse.move(mp.x + cw * 2.5, mp.y + ch * 3.5); await p.mouse.down(); await p.mouse.move(mp.x + cw * 12.5, mp.y + ch * 9.5); await p.mouse.up();
  const cnt = await ev(() => { const c = {}; for (const v of window.pixelAtelier.doc.tilemaps[0].cells) c[v] = (c[v] || 0) + 1; return c; });
  check('Rectangle 11 × 7 avec 2 tuiles au hasard', (cnt[2] || 0) + (cnt[3] || 0) === 77 && cnt[2] > 0 && cnt[3] > 0, JSON.stringify(cnt));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  const afterUndo = await ev(() => window.pixelAtelier.doc.tilemaps[0].cells.filter((v) => v >= 0).length);
  check('Annuler (Ctrl+Z dans la fenêtre)', afterUndo === 6, afterUndo);
  await p.keyboard.press('Control+y'); await p.waitForTimeout(150);
  check('Rétablir', (await ev(() => window.pixelAtelier.doc.tilemaps[0].cells.filter((v) => v >= 0).length)) === 83);
  // le dessin change : la carte rendue suit
  const px = await ev(async () => {
    const app = window.pixelAtelier;
    const l = app.doc.allLayers()[0];
    const t = app.history.beginPixels(l); t.cel[16] = 0xffffffff; app.markLayerDirty(t.cel, 16, 0, 16, 0); app.history.endPixels(t, 'Point');
    const { renderTilemap } = await import('./js/ui/tilemap.js');
    const r = renderTilemap(app.doc, app.doc.tilemaps[0]);
    return r.px[0] === 0xffffffff && r.px[16] === 0xffffffff;
  });
  check('Les tuiles suivent le dessin', px);
  const saved = await ev(async () => { const s = await import('./js/storage/serialize.js'); const d = await s.fileJSONToDoc(await s.docToFileJSON(window.pixelAtelier.doc)); return d.tilemaps[0].cells.filter((v) => v >= 0).length; });
  check('Carte enregistrée avec le projet', saved === 83, saved);
  // exports
  const [d1] = await Promise.all([p.waitForEvent('download'), p.locator('.tm-head button', { hasText: 'PNG' }).click()]);
  await d1.saveAs(`${H.OUT}/carte.png`);
  const png = fs.readFileSync(`${H.OUT}/carte.png`);
  check('Export PNG de la carte (320 × 192 ou agrandi)', png.readUInt32BE(16) % 320 === 0 && png.readUInt32BE(20) % 192 === 0, `${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`);
  const [d2] = await Promise.all([p.waitForEvent('download'), p.locator('.tm-head button', { hasText: 'Tiled' }).click()]);
  await d2.saveAs(`${H.OUT}/carte_tiled.zip`);
  const z = fs.readFileSync(`${H.OUT}/carte_tiled.zip`).toString('latin1');
  check('Export Tiled : carte .tmj + jeu de tuiles .png', /\.tmj/.test(z) && /_tuiles\.png/.test(z) && /"tilelayer"/.test(z));
  await p.screenshot({ path: `${H.OUT}/tilemap.png` });
  await p.keyboard.press('Escape');
  H.summary(errs);
  await b.close();
})();
