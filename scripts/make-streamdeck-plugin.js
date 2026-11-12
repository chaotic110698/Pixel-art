// Fabrique le plugin Stream Deck : images (touches, actions, effets, fonds) dans
// stream-deck/plugin/com.pixelatelier.avatar.sdPlugin/imgs, puis le paquet installable
// stream-deck/com.pixelatelier.avatar.streamDeckPlugin (archive ZIP du dossier .sdPlugin) et
// stream-deck/version.json (version publiée, lue par les plugins installés pour se mettre à jour).
// Usage : node scripts/make-streamdeck-plugin.js   (site servi sur le port 8123)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PLUGIN = path.join(ROOT, 'stream-deck', 'plugin', 'com.pixelatelier.avatar.sdPlugin');
// nouveautés de la version (affichées dans l'inspecteur du plugin à mettre à jour)
const NOTES = 'memes retouchés (Deal with it, Forever alone, deep fried, cerveau galactique, Bonk, clown) et nouveau « Plan subtil »';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(process.env.AUDIT_URL || 'http://localhost:8123/');
  await p.waitForFunction(() => window.pixelAtelier);
  const files = await p.evaluate(async () => {
    const { effectIcon, sceneIcon } = await import('./js/pngtuber/streamdeck.js');
    const { EFFECTS, SCENE_NAMES } = await import('./js/pngtuber/effects.js');
    const out = [];
    const put = (name, c) => out.push({ name, b64: c.toDataURL('image/png').split(',')[1] });
    const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
    const ACCENT = '#ff5ab4';
    /** Variante « allumée » : cadre de couleur d'accent. */
    const lit = (src) => {
      const [c, g] = canvas(src.width, src.height);
      g.drawImage(src, 0, 0);
      const k = Math.round(src.width / 18);
      g.fillStyle = ACCENT;
      g.fillRect(0, 0, c.width, k); g.fillRect(0, c.height - k, c.width, k); g.fillRect(0, 0, k, c.height); g.fillRect(c.width - k, 0, k, c.height);
      return c;
    };
    // ---------- effets et fonds (144×144) ----------
    for (const e of EFFECTS.filter((x) => x.kind !== 'voice')) {
      const c = effectIcon(e.id);
      put(`fx/${e.id}.png`, c);
      put(`fx/${e.id}_on.png`, lit(c));
    }
    for (const id of Object.keys(SCENE_NAMES)) {
      const c = sceneIcon(id);
      put(`bg/${id}.png`, c);
      put(`bg/${id}_on.png`, lit(c));
    }
    const SOLID = { green: '#00ff00', blue: '#0047bb', magenta: '#ff00ff', black: '#000000', white: '#ffffff', transparent: null };
    for (const [id, col] of Object.entries(SOLID)) {
      const [c, g] = canvas(144);
      if (col) { g.fillStyle = col; g.fillRect(0, 0, 144, 144); } else {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#9a9aa8' : '#d8d8e2'; g.fillRect(x * 18, y * 18, 18, 18); }
      }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 120, 144, 24);
      put(`bg/${id}.png`, c);
      put(`bg/${id}_on.png`, lit(c));
    }
    // ---------- pictogrammes des actions (grille 12×12) ----------
    const GLYPH = {
      expression: ['...wwwwww...', '..w......w..', '.w........w.', 'w..ww..ww..w', 'w..ww..ww..w', 'w..........w', 'w..........w', 'w.w......w.w', 'w..w....w..w', '.w..wwww..w.', '..w......w..', '...wwwwww...'],
      effect: ['.....w......', '.....w......', '....www.....', 'wwwwwwwwww..', '..wwwwwww...', '...wwwww....', '...ww.ww..w.', '..ww...ww.w.', '..w.....wwww', '..........w.', '..........w.', '............'],
      background: ['wwwwwwwwwwww', 'w..........w', 'w.......ww.w', 'w.......ww.w', 'w...w......w', 'w..www.....w', 'w.wwwww..w.w', 'wwwwwwwwwwww', 'wwwwwwwwwwww', 'w..........w', 'wwwwwwwwwwww', '............'],
      profile: ['....wwww....', '...wwwwww...', '...wwwwww...', '...wwwwww...', '....wwww....', '.....ww.....', '..wwwwwwww..', '.wwwwwwwwww.', 'wwwwwwwwwwww', 'wwwwwwwwwwww', 'wwwwwwwwwwww', '............'],
      talk: ['....wwww....', '...wwwwww...', '...wwwwww...', '...wwwwww...', '...wwwwww...', '.w.wwwwww.w.', '.w..wwww..w.', '..w......w..', '...wwwwww...', '.....ww.....', '...wwwwww...', '............'],
    };
    const glyph = (g, rows, x, y, k, col) => { g.fillStyle = col; rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'w') g.fillRect(x + i * k, y + j * k, k, k); })); };
    for (const [id, rows] of Object.entries(GLYPH)) {
      // icônes de la liste des actions : blanches sur fond transparent (20 et 40 px)
      for (const [s, k] of [[20, 1], [40, 3]]) {
        const [c, g] = canvas(s);
        glyph(g, rows, Math.floor((s - 12 * k) / 2), Math.floor((s - 12 * k) / 2), k, '#ffffff');
        put(`actions/${id}${s === 40 ? '@2x' : ''}.png`, c);
      }
      // images des touches (72 et 144 px) : fond sombre, pictogramme en haut, titre en bas
      for (const [s, k] of [[72, 4], [144, 8]]) {
        for (const on of [false, true]) {
          const [c, g] = canvas(s);
          const gr = g.createLinearGradient(0, 0, 0, s);
          gr.addColorStop(0, on ? '#5a2f63' : '#3a2f5c'); gr.addColorStop(1, on ? '#3a1a44' : '#1f1a33');
          g.fillStyle = gr; g.fillRect(0, 0, s, s);
          glyph(g, rows, Math.floor((s - 12 * k) / 2), Math.round(s * 0.12), k, on ? '#ffd1ea' : '#ffffff');
          put(`keys/${id}${on ? '_on' : ''}${s === 144 ? '@2x' : ''}.png`, on ? lit(c) : c);
        }
      }
    }
    // icône de catégorie (28 et 56 px, blanche) : visage
    for (const [s, k] of [[28, 2], [56, 4]]) {
      const [c, g] = canvas(s);
      glyph(g, GLYPH.expression, Math.floor((s - 12 * k) / 2), Math.floor((s - 12 * k) / 2), k, '#ffffff');
      put(`category${s === 56 ? '@2x' : ''}.png`, c);
    }
    // icône du plugin : celle de l'appli (256 et 512 px)
    const app = new Image();
    app.src = './icons/icon-512.png';
    await app.decode();
    for (const s of [256, 512]) {
      const [c, g] = canvas(s);
      g.drawImage(app, 0, 0, s, s);
      put(`plugin${s === 512 ? '@2x' : ''}.png`, c);
    }
    return out;
  });
  await b.close();
  const imgs = path.join(PLUGIN, 'imgs');
  fs.rmSync(imgs, { recursive: true, force: true });
  for (const f of files) {
    const dest = path.join(imgs, f.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(f.b64, 'base64'));
  }
  // paquet installable : archive ZIP dont la racine est le dossier .sdPlugin
  const pkg = path.join(ROOT, 'stream-deck', 'com.pixelatelier.avatar.streamDeckPlugin');
  fs.rmSync(pkg, { force: true });
  execFileSync('python3', ['-c', `
import os, zipfile, sys
root, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(root)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for d, _, fs in os.walk(root):
        for f in sorted(fs):
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, base).replace(os.sep, '/'))
`, PLUGIN, pkg]);
  // fichier de version lu par le plugin installé (proposition de mise à jour)
  const version = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(PLUGIN, 'bin', 'plugin.js'), 'utf8'))[1];
  fs.writeFileSync(path.join(ROOT, 'stream-deck', 'version.json'), JSON.stringify({ version, url: 'stream-deck/com.pixelatelier.avatar.streamDeckPlugin', notes: NOTES }, null, 2) + '\n');
  console.log(`${files.length} images écrites ; paquet : ${path.relative(ROOT, pkg)} (${fs.statSync(pkg).size} octets)`);
})();
