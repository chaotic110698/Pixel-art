#!/usr/bin/env python3
"""Fabrique les icônes de l'application à partir de l'image déposée dans icone-a-deposer/.

Usage : python3 scripts/make-icons.py [image] [--bg #15151c] [--out dossier]
- image : par défaut, la première image (png, jpg, jpeg, webp) de icone-a-deposer/
  (hors icone-maskable.png, utilisée telle quelle si présente).
- Petites images (≤ 256 px) : agrandissement au plus proche voisin (pixel art net) ;
  grandes images : réduction de bonne qualité (Lanczos).
Produit dans icons/ : icon-192.png, icon-512.png, icon-maskable-512.png,
apple-touch-icon.png (180, fond opaque), favicon-32.png, favicon-16.png.
Nécessite Pillow (pip install pillow).
"""
import sys, os, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DROP = os.path.join(ROOT, 'icone-a-deposer')
OUT = os.path.join(ROOT, 'icons')
if '--out' in sys.argv:
    OUT = sys.argv[sys.argv.index('--out') + 1]
EXT = ('.png', '.jpg', '.jpeg', '.webp')

args = [a for i, a in enumerate(sys.argv[1:]) if not a.startswith('--') and not (i > 0 and sys.argv[i] in ('--bg', '--out'))]
bg = '#15151c'
if '--bg' in sys.argv:
    bg = sys.argv[sys.argv.index('--bg') + 1]

def find_source():
    if args:
        return args[0]
    files = sorted(f for f in glob.glob(os.path.join(DROP, '*')) if f.lower().endswith(EXT) and os.path.basename(f).lower() not in ('icone-maskable.png', 'icone-pleine.png'))
    if not files:
        sys.exit(f'Aucune image dans {DROP} : déposez-y un PNG carré (512×512 conseillé).')
    return files[0]

def square(im):
    im = im.convert('RGBA')
    w, h = im.size
    if w == h:
        return im
    s = max(w, h)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(im, ((s - w) // 2, (s - h) // 2))
    return out

def native(im):
    """Pixel art déjà agrandi (blocs k×k identiques) : on revient à la grille d'origine."""
    try:
        import numpy as np
    except ImportError:
        return im
    a = np.array(im)
    w = a.shape[0]
    for k in range(64, 1, -1):
        if w % k == 0 and (a[::k, ::k].repeat(k, 0).repeat(k, 1) == a).all():
            print(f'Pixel art détecté : grille {w // k}×{w // k} agrandie ×{k}')
            return im.resize((w // k, w // k), Image.NEAREST)
    return im

def resized(im, size):
    w = im.size[0]
    if w <= 256 and size >= w:
        # pixel art : plus grand multiple entier au plus proche voisin, centré (jamais de flou)
        k = size // w
        if k == 1 and size > w * 1.25:
            return im.resize((size, size), Image.NEAREST)
        big = im.resize((w * k, w * k), Image.NEAREST)
        if w * k == size:
            return big
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(big, ((size - w * k) // 2, (size - w * k) // 2))
        return out
    return im.resize((size, size), Image.LANCZOS)

def on_bg(im, size, scale=1.0, color=bg):
    out = Image.new('RGBA', (size, size), color)
    inner = max(1, round(size * scale))
    ic = resized(im, inner)
    out.alpha_composite(ic, ((size - inner) // 2, (size - inner) // 2))
    return out

src_path = find_source()
src = native(square(Image.open(src_path)))
print(f'Source : {os.path.relpath(src_path, ROOT)} ({src.size[0]}×{src.size[1]})')
os.makedirs(OUT, exist_ok=True)
outputs = {
    'icon-192.png': resized(src, 192),
    'icon-512.png': resized(src, 512),
    'apple-touch-icon.png': None,  # voir plus bas
    'favicon-32.png': resized(src, 32),
    'favicon-16.png': resized(src, 16),
}
mask_path = os.path.join(DROP, 'icone-maskable.png')
if os.path.exists(mask_path):
    outputs['icon-maskable-512.png'] = resized(square(Image.open(mask_path)), 512)
else:
    # zone de sécurité des icônes adaptatives : 80 % du diamètre
    outputs['icon-maskable-512.png'] = on_bg(src, 512, 0.8)
# iPhone : image pleine, sans transparence (iOS arrondit lui-même les coins) :
# icone-pleine.png si fournie, sinon la version maskable
full_path = os.path.join(DROP, 'icone-pleine.png')
if os.path.exists(full_path) or os.path.exists(mask_path):
    outputs['apple-touch-icon.png'] = resized(square(Image.open(full_path if os.path.exists(full_path) else mask_path)), 180).convert('RGB')
else:
    outputs['apple-touch-icon.png'] = on_bg(src, 180, 1.0).convert('RGB')
for name, im in outputs.items():
    im.save(os.path.join(OUT, name), optimize=True)
    print(f'  icons/{name} ({im.size[0]}×{im.size[1]})')
print('Pensez à : node scripts/sw-files.mjs --write, puis incrémenter VERSION dans sw.js.')
