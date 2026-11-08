#!/usr/bin/env python3
"""Assemble une langue de l'interface : js/ui/lang/<code>.js

Source : un fichier texte (par ex. i18n/es.txt) qui suit l'ordre des clés de
js/ui/i18n-en.js (texte français -> anglais), en blocs repérés par « #N » (N = index
de la première ligne du bloc), une traduction par ligne. Les messages dynamiques
(motifs PATTERNS de js/ui/i18n.js) sont dans un bloc « #P », dans l'ordre des motifs,
avec des repères {1} {2}… (groupes), {T1} (groupe traduit), {C1} (groupe traduit en
minuscules), {K1} (touche), {?2:texte} (texte si le groupe 2 existe).

Usage :
  python3 scripts/i18n-lang.py i18n/es.txt          # écrit js/ui/lang/es.js
  python3 scripts/i18n-lang.py --missing es         # clés ajoutées depuis (à traduire)
  python3 scripts/i18n-lang.py --keys               # liste « index<TAB>anglais » à traduire

Pour une nouvelle clé : l'ajouter à la fin de i18n-en.js (jamais au milieu), puis
ajouter sa traduction à la fin du fichier de chaque langue et relancer le script.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = {
    'es': 'Español', 'de': 'Deutsch', 'it': 'Italiano', 'pt': 'Português', 'nl': 'Nederlands',
    'pl': 'Polski', 'ru': 'Русский', 'tr': 'Türkçe', 'ja': '日本語', 'zh': '中文（简体）', 'ko': '한국어',
}


def keys():
    out = subprocess.run(['node', '-e', f"import('{ROOT}/js/ui/i18n-en.js').then(m => process.stdout.write(JSON.stringify(Object.entries(m.EN))))"],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def pattern_count():
    src = open(os.path.join(ROOT, 'js/ui/i18n.js'), encoding='utf-8').read()
    return len(re.findall(r'^  \[/', src, re.M))


def parse(path):
    blocks, cur, start = {}, None, None
    for raw in open(path, encoding='utf-8').read().split('\n'):
        line = raw.rstrip('\r')
        m = re.match(r'^#(P|\d+)\s*$', line)
        if m:
            cur = []
            start = m.group(1)
            blocks[start] = cur
            continue
        if cur is None or line == '':
            continue
        cur.append(line)
    return blocks


def build(path):
    code = os.path.basename(path).split('.')[0]
    entries = keys()
    blocks = parse(path)
    tr = {}
    errors = []
    starts = sorted(int(k) for k in blocks if k != 'P')
    for i, s in enumerate(starts):
        lines = blocks[str(s)]
        nxt = starts[i + 1] if i + 1 < len(starts) else None
        if nxt is not None and s + len(lines) != nxt:
            errors.append(f'bloc #{s} : {len(lines)} lignes, attendu {nxt - s}')
        for j, t in enumerate(lines):
            if s + j < len(entries):
                tr[entries[s + j][0]] = t
    pats = blocks.get('P', [])
    if len(pats) != pattern_count():
        errors.append(f'bloc #P : {len(pats)} motifs, attendu {pattern_count()}')
    if errors:
        print('\n'.join(errors))
        sys.exit(1)
    missing = len(entries) - len(tr)
    os.makedirs(os.path.join(ROOT, 'js/ui/lang'), exist_ok=True)
    out = os.path.join(ROOT, 'js/ui/lang', f'{code}.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(f'// {NAMES.get(code, code)} : traduction de l\'interface (clé = texte français).\n')
        f.write('// Fichier généré par scripts/i18n-lang.py depuis i18n/' + os.path.basename(path) + ' : ne pas modifier à la main.\n\n')
        f.write('export const DICT = {\n')
        for k, v in tr.items():
            f.write(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)},\n')
        f.write('};\n\n// Messages dynamiques (dans l\'ordre des motifs de i18n.js)\nexport const P = [\n')
        for p in pats:
            f.write(f'  {json.dumps(None if p == "-" else p, ensure_ascii=False)},\n')
        f.write('];\n')
    print(f'{out} : {len(tr)} textes, {len(pats)} motifs' + (f', {missing} à traduire (repli en anglais)' if missing else ''))


def main():
    a = sys.argv[1:]
    if a and a[0] == '--keys':
        for i, (_, en) in enumerate(keys()):
            print(f'{i}\t{en}')
    elif a and a[0] == '--missing':
        code = a[1]
        have = sum(len(v) for k, v in parse(os.path.join(ROOT, 'i18n', code + '.txt')).items() if k != 'P')
        for i, (_, en) in enumerate(keys()):
            if i >= have:
                print(f'{i}\t{en}')
    else:
        for p in a:
            build(p)


if __name__ == '__main__':
    main()
