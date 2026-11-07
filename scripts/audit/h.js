// Harnais commun des tests d'audit (Playwright). Voir scripts/audit/run.sh.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const os = require('os');
const BASE = process.env.AUDIT_URL || 'http://localhost:8123/';
const OUT = process.env.AUDIT_OUT || require('path').join(os.tmpdir(), 'pixel-atelier-audit');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, info = '') {
  results.push({ name, ok: !!ok, info });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
}

async function open({ device = null, viewport = { width: 1280, height: 860 }, lang = null, fresh = true } = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext(device ? { ...devices[device] } : { viewport, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  // détecte les textes parasites (« null », « undefined », « NaN », « [object … »)
  await p.addInitScript(() => {
    const bad = /^(null|undefined|NaN|\[object [A-Za-z]+\])$|undefined|NaN px|\[object /;
    const seen = new Set();
    const scan = (n) => {
      if (n.nodeType === 3) {
        const t = n.textContent.trim();
        if (t && bad.test(t) && !n.parentElement?.closest('script,style,textarea,pre')) {
          const k = t + '|' + (n.parentElement?.outerHTML || '').slice(0, 120);
          if (!seen.has(k)) { seen.add(k); console.error('TEXTE PARASITE « ' + t + ' » dans ' + (n.parentElement?.outerHTML || '').slice(0, 160)); }
        }
      } else if (n.nodeType === 1) for (const c of n.childNodes) scan(c);
    };
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) scan(n); }).observe(document, { childList: true, subtree: true, characterData: false });
  });
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto(BASE + '?t=' + Date.now());
  await p.waitForFunction(() => window.pixelAtelier && window.pixelAtelier.doc);
  await p.waitForTimeout(600);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  return { b, ctx, p, errs };
}

/** Nouveau document vierge w×h (sans passer par la fenêtre). */
async function blank(p, w = 32, h = 32) {
  await p.evaluate(async ([w, h]) => {
    const app = window.pixelAtelier;
    const { Doc } = await import('./js/core/doc.js');
    const d = new Doc(w, h, 'Test');
    const l = d.createLayer('Calque 1');
    d.insert(l, 'root');
    d.activeId = l.id;
    app.setDoc(d);
    app.viewport.fit();
  }, [w, h]);
  await p.waitForTimeout(150);
}

/** Position écran (page) du centre du pixel (x, y) du document. */
async function scr(p, x, y) {
  return p.evaluate(([x, y]) => {
    const app = window.pixelAtelier;
    const r = document.getElementById('view').getBoundingClientRect();
    const [sx, sy] = app.viewport.toScreen(x + 0.5, y + 0.5);
    return [r.left + sx, r.top + sy];
  }, [x, y]);
}

async function drag(p, pts, { button = 'left', mods = [] } = {}) {
  for (const m of mods) await p.keyboard.down(m);
  const [x0, y0] = await scr(p, ...pts[0]);
  await p.mouse.move(x0, y0);
  await p.mouse.down({ button });
  for (const pt of pts.slice(1)) {
    const [x, y] = await scr(p, ...pt);
    await p.mouse.move(x, y, { steps: 4 });
  }
  await p.mouse.up({ button });
  for (const m of mods) await p.keyboard.up(m);
  await p.waitForTimeout(60);
}

async function tool(p, id) {
  await p.evaluate((id) => window.pixelAtelier.tools.select(id), id);
}

/** Nombre de pixels non transparents du calque actif (image courante). */
async function count(p, which = null) {
  return p.evaluate((which) => {
    const d = window.pixelAtelier.doc;
    const l = which ? d.get(which) : d.activeLayer;
    let n = 0;
    for (const c of l.cels[d.frame]) if (c >>> 24) n++;
    return n;
  }, which);
}

async function px(p, x, y) {
  return p.evaluate(([x, y]) => {
    const d = window.pixelAtelier.doc;
    return d.activeLayer.cels[d.frame][y * d.width + x] >>> 0;
  }, [x, y]);
}

function summary(errs) {
  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} vérifications OK`);
  if (errs && errs.length) console.log('ERREURS PAGE :\n' + [...new Set(errs)].join('\n'));
  else console.log('Aucune erreur dans la page.');
}

module.exports = { BASE, open, blank, scr, drag, tool, count, px, check, summary, results, OUT, devices };
