"""Make one closed-eye frame per idle image: the mask opens only the eye region for redrawing, then only that patch (feathered) is pasted back onto the original, leaving every other pixel untouched."""
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFilter

BOX = {'scholar': (320, 335, 650, 445), 'maid': (300, 425, 650, 570), 'spirit': (310, 465, 625, 585)}
EXTRA = {'scholar': ' Her round gold glasses stay exactly the same.'}
ENV = {**os.environ, 'HTTPS_PROXY': 'http://127.0.0.1:7898', 'HTTP_PROXY': 'http://127.0.0.1:7898'}


def run(skin):
    src, full, out = f'raw/{skin}/idle.png', f'raw/{skin}/blink_full.png', f'raw/{skin}/blink.png'
    x0, y0, x1, y1 = BOX[skin]
    im = Image.open(src)
    m = Image.new('RGBA', im.size, (0, 0, 0, 255)); ImageDraw.Draw(m).rectangle((x0 - 10, y0 - 10, x1 + 10, y1 + 10), fill=(0, 0, 0, 0))
    m.save(f'raw/{skin}/eyemask.png')
    if not os.path.exists(full):
        p = ('Same image, only change: both eyes are gently closed in a blink, drawn as soft curved closed-eye lines with eyelashes, '
             'same position and size as the open eyes. Everything else identical.' + EXTRA.get(skin, ''))
        subprocess.run([sys.executable, os.path.expanduser('~/.claude/tools/image_gen2.py'), 'edit', p, '-o', full, '-i', src,
                        '--mask', f'raw/{skin}/eyemask.png', '--size', '1024x1536', '--quality', 'high'], env=ENV, capture_output=True)
    if not os.path.exists(full):
        return f'{skin} FAIL'
    a, b = Image.open(src).convert('RGB'), Image.open(full).convert('RGB')
    feather = Image.new('L', a.size, 0); ImageDraw.Draw(feather).rectangle((x0, y0, x1, y1), fill=255)
    Image.composite(b, a, feather.filter(ImageFilter.GaussianBlur(6))).save(out)
    a.crop((x0 - 40, y0 - 40, x1 + 40, y1 + 40)).save(f'raw/{skin}/_eyes_open.png')
    Image.open(out).crop((x0 - 40, y0 - 40, x1 + 40, y1 + 40)).save(f'raw/{skin}/_eyes_closed.png')
    return f'{skin} OK'


with ThreadPoolExecutor(2) as ex:
    for r in ex.map(run, BOX):
        print(r, flush=True)
