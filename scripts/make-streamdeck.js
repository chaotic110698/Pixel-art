// Régénère le dossier stream-deck/ (icônes 144×144 des effets et des décors) à partir
// de js/pngtuber/streamdeck.js. Usage : node scripts/make-streamdeck.js (serveur sur le port 8123).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const out = path.join(__dirname, '..', 'stream-deck');
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(process.env.AUDIT_URL || 'http://localhost:8123/');
  await p.waitForFunction(() => window.pixelAtelier);
  const files = await p.evaluate(async () => {
    const { streamDeckFiles } = await import('./js/pngtuber/streamdeck.js');
    const fl = await streamDeckFiles(null);
    return fl.filter((f) => f.name.endsWith('.png')).map((f) => { let s = ''; for (const c of f.data) s += String.fromCharCode(c); return { name: f.name, b64: btoa(s) }; });
  });
  for (const f of files) {
    const dest = path.join(out, f.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(f.b64, 'base64'));
  }
  console.log(`${files.length} icônes écrites dans stream-deck/`);
  await b.close();
})();
