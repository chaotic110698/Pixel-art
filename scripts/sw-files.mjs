// Usage : node scripts/sw-files.mjs        -> vérifie la liste de précache de sw.js
//         node scripts/sw-files.mjs --write -> la régénère
// (aucune étape de build : ce script sert juste d'aide pour la maintenance)
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons'];
const files = [];
const walk = (p) => {
  if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f));
  else files.push('./' + p.replace(/\\/g, '/'));
};
roots.forEach(walk);
const list = ['./', ...files];
const sw = readFileSync('sw.js', 'utf8');
const block = `const PRECACHE = ${JSON.stringify(list, null, 2)};`;
const re = /const PRECACHE = \[[\s\S]*?\];/;
if (process.argv.includes('--write')) {
  writeFileSync('sw.js', sw.replace(re, block));
  console.log(`sw.js : ${list.length} fichiers en précache`);
} else {
  const current = sw.match(re)?.[0];
  if (current !== block) {
    console.error('La liste de précache de sw.js n\'est pas à jour : lancez node scripts/sw-files.mjs --write');
    process.exit(1);
  }
  console.log('sw.js à jour');
}
