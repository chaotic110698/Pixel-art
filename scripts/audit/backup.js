// Sauvegardes : dossier de l'ordinateur (simulé par le système de fichiers privé du navigateur),
// Google Drive (API simulée par interception réseau), archive ZIP, restauration, onglet Paramètres.
const H = require('./h.js');
const fs = require('fs');
(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  const ev = (f, a) => p.evaluate(f, a);

  // --- faux Google Drive (fichiers en mémoire) ---
  const drive = new Map();
  let nextId = 1;
  await p.route('https://www.googleapis.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const auth = req.headers().authorization || '';
    if (auth !== 'Bearer JETON-TEST') return route.fulfill({ status: 401, body: 'no' });
    const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    const parts = (body) => { const m = body.split(/--pxa\w+/); return { meta: JSON.parse(m[1].split('\r\n\r\n')[1]), media: m[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '') }; };
    if (url.pathname === '/drive/v3/files' && req.method() === 'POST') { const id = 'F' + nextId++; drive.set(id, { ...JSON.parse(req.postData()), id }); return json({ id }); }
    if (url.pathname === '/upload/drive/v3/files' && req.method() === 'POST') { const { meta, media } = parts(req.postData()); const id = 'F' + nextId++; drive.set(id, { ...meta, id, media }); return json({ id }); }
    let m = url.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/);
    if (m && req.method() === 'PATCH') { const f = drive.get(m[1]); if (!f) return route.fulfill({ status: 404, body: 'x' }); const { meta, media } = parts(req.postData()); Object.assign(f, meta, { media }); return json({ id: f.id }); }
    m = url.pathname.match(/^\/drive\/v3\/files\/(\w+)$/);
    if (m) { const f = drive.get(m[1]); if (!f) return route.fulfill({ status: 404, body: 'x' }); return url.searchParams.get('alt') === 'media' ? route.fulfill({ status: 200, body: f.media }) : json({ id: f.id, trashed: false }); }
    if (url.pathname === '/drive/v3/files') { const pid = (url.searchParams.get('q') || '').match(/'(\w+)' in parents/)?.[1]; return json({ files: [...drive.values()].filter((f) => f.parents?.includes(pid)).map((f) => ({ id: f.id, name: f.name, modifiedTime: new Date().toISOString(), size: String(f.media?.length || 0) })) }); }
    return route.fulfill({ status: 400, body: 'route inconnue ' + url.pathname });
  });

  // deux projets
  await ev(async () => {
    const app = window.pixelAtelier;
    const { buildCharacter } = await import('./js/library/character.js');
    const { DEFAULT_COLORS } = await import('./js/library/builder.js');
    const d1 = buildCharacter({ colors: DEFAULT_COLORS, name: 'Projet Un' });
    app.setDoc(d1); await app.storage.saveNow();
    const d2 = buildCharacter({ colors: DEFAULT_COLORS, name: 'Projet Deux' });
    app.setDoc(d2); await app.storage.saveNow();
  });

  // --- dossier de l'ordinateur ---
  const folder = await ev(async () => {
    const app = window.pixelAtelier;
    const B = await import('./js/storage/backup.js');
    const root = await navigator.storage.getDirectory();
    try { await root.removeEntry('bk', { recursive: true }); } catch (_) { /* premier passage */ }
    window.showDirectoryPicker = async () => root.getDirectoryHandle('bk', { create: true });
    await B.chooseFolder(app);
    const dir = await root.getDirectoryHandle('bk');
    const names = [];
    for await (const [n, e] of dir.entries()) names.push(e.kind === 'directory' ? n + '/' : n);
    const hist = [];
    for await (const [n] of (await dir.getDirectoryHandle('historique')).entries()) hist.push(n);
    // renommage : l'ancien fichier est remplacé
    app.doc.name = 'Projet Deux renommé';
    await B.backupCurrent(app, { force: true });
    const after = [];
    for await (const [n, e] of dir.entries()) if (e.kind === 'file') after.push(n);
    const list = await B.listFolder();
    return { names, hist, after, listed: list.length, status: !!B.status.folder };
  });
  check('Dossier : un fichier par projet + historique du jour', folder.names.filter((n) => n.endsWith('.pxa.json')).length === 2 && folder.names.includes('historique/') && folder.hist.length === 2, JSON.stringify(folder.names));
  check('Dossier : projet renommé = fichier renommé (pas de doublon)', folder.after.length === 2 && folder.after.some((n) => n.startsWith('projet_deux_renomme__')), JSON.stringify(folder.after));
  check('Dossier : liste pour restaurer (fichiers + historique)', folder.listed >= 4, folder.listed);

  // --- Google Drive ---
  const drv = await ev(async () => {
    const app = window.pixelAtelier;
    const B = await import('./js/storage/backup.js');
    app.setState({ driveClientId: 'test.apps.googleusercontent.com' });
    // la fenêtre Google est simulée : elle renvoie le jeton comme le ferait oauth.html
    window.open = (url) => {
      const st = new URL(url).searchParams.get('state');
      setTimeout(() => window.postMessage({ type: 'pixel-atelier-oauth', hash: `#access_token=JETON-TEST&expires_in=3600&state=${st}` }, location.origin), 50);
      return { closed: false };
    };
    const ok = await B.driveConnect(app);
    const n = await B.backupAll(app, { folder: false, drive: true });
    app.doc.name = 'Projet Deux v2';
    await B.backupCurrent(app, { force: true });
    const files = await B.listDrive();
    const text = await files[0].read();
    return { ok, n, files: files.map((f) => f.name), parsed: JSON.parse(text).format || Object.keys(JSON.parse(text)).slice(0, 3).join(',') };
  });
  check('Google Drive : connexion (jeton) et envoi de tous les projets', drv.ok && drv.n >= 2, JSON.stringify(drv));
  check('Google Drive : mise à jour du même fichier (pas de doublon)', drv.files.length === drv.n && drv.files.some((n) => n.startsWith('projet_deux_v2__')), JSON.stringify(drv.files));
  check('Google Drive : relecture d\'une sauvegarde', !!drv.parsed, drv.parsed);
  check('Google Drive : dossier « Pixel Atelier » créé', [...drive.values()].some((f) => f.mimeType === 'application/vnd.google-apps.folder' && f.name === 'Pixel Atelier'));

  // --- restauration : on supprime un projet puis on le restaure depuis le Drive ---
  const rest = await ev(async () => {
    const app = window.pixelAtelier;
    const B = await import('./js/storage/backup.js');
    const metas = await app.storage.list();
    const other = metas.find((m) => m.id !== app.doc.id && m.name === 'Projet Un');
    await app.storage.remove(other.id);
    const before = (await app.storage.list()).length;
    const files = (await B.listDrive()).filter((f) => f.name.includes(other.id));
    await B.restoreFiles(app, files);
    const back = (await app.storage.list()).find((m) => m.id === other.id);
    const doc = await app.storage.load(other.id);
    return { before, restored: !!back, layers: doc.allLayers().length, current: app.doc.name };
  });
  check('Restauration d\'un projet supprimé (sans changer le projet ouvert)', rest.restored && rest.layers > 5 && rest.current === 'Projet Deux v2', JSON.stringify(rest));

  // --- archive ZIP ---
  await ev(() => window.pixelAtelier.openSettings('backup'));
  await p.waitForTimeout(600);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.locator('.dlg button', { hasText: 'Télécharger tous les projets (ZIP)' }).click()]);
  const zp = `${H.OUT}/sauvegarde.zip`;
  await dl.saveAs(zp);
  const zbuf = fs.readFileSync(zp);
  let n = 0;
  for (let i = 0; i + 30 < zbuf.length; i++) if (zbuf.readUInt32LE(i) === 0x04034b50) { const l = zbuf.readUInt16LE(i + 26); if (zbuf.slice(i + 30, i + 30 + l).toString().endsWith('.pxa.json')) n++; }
  check('Archive ZIP : tous les projets', n >= 2, n);
  const tab = await ev(() => document.querySelector('.settings-body').textContent);
  check('Onglet Sauvegarde : dossier, Google Drive, archive, rappel', /Dossier de l'ordinateur/.test(tab) && /Google Drive/.test(tab) && /Archive de tous les projets/.test(tab) && /Me rappeler/.test(tab));
  await p.screenshot({ path: `${H.OUT}/backup_tab.png` });
  await p.keyboard.press('Escape');

  H.summary(errs);
  await b.close();
})();
