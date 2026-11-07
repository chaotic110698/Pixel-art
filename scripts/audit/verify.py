import sys, zipfile, io, json, struct
from PIL import Image
f = sys.argv[1]
def png_ok(data, name=''):
    im = Image.open(io.BytesIO(data)); im.load()
    return f'{im.size[0]}x{im.size[1]} {im.mode}'
try:
    if f.endswith('.zip'):
        z = zipfile.ZipFile(f)
        bad = z.testzip()
        if bad: print('ERREUR zip', bad); sys.exit()
        names = z.namelist(); pngs = [n for n in names if n.endswith('.png')]
        sizes = set()
        for n in pngs: sizes.add(png_ok(z.read(n)))
        extra = ''
        if 'manifest.json' in names:
            m = json.loads(z.read('manifest.json')); extra = ' manifest:' + ','.join(sorted(m.keys()))[:80]
        print(f'{len(names)} fichiers, {len(pngs)} png, tailles {sorted(sizes)[:3]}{extra}')
    elif f.endswith('.png'):
        print(png_ok(open(f,'rb').read()))
    elif f.endswith('.gif'):
        im = Image.open(f); n = getattr(im, 'n_frames', 1); im.load(); print(f'GIF {im.size} {n} images')
    elif f.endswith('.psd'):
        d = open(f,'rb').read(); assert d[:4] == b'8BPS', 'signature'
        w, h = struct.unpack('>II', d[14:22])[::-1] if False else (struct.unpack('>I', d[18:22])[0], struct.unpack('>I', d[14:18])[0])
        print(f'PSD {w}x{h}')
    elif f.endswith('.html'):
        s = open(f, encoding='utf8').read(); assert '<script>' in s and 'createAvatar' in s; print(f'HTML {len(s)//1024} Ko')
    elif f.endswith('.json'):
        json.load(open(f)); print('JSON ok')
    else:
        print('?')
except Exception as e:
    print('ERREUR', e)
