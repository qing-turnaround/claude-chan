"""H3 green-screen video -> transparent frame sequence app/assets/<name>/000.webp ...

Usage: python process_video.py <video> <skin> <clip name> <character pixel height in the first frame> [matching static sprite name, default idle]
  e.g. python process_video.py ../h3/out/pet_cheer/pet_cheer_v1_00001_.mp4 hoodie cheer_anim 700
All frames share one crop box (the union over all frames), so the character sits in the canvas exactly as in the video and playback doesn't jump.
Scaling aligns the first frame to the static sprite: k = sprite height / character height in the first frame.
"""
import json, os, subprocess, sys, tempfile, glob
import numpy as np
from scipy import ndimage
from PIL import Image
from process import key, clean

FPS = 12


def main(video, skin, name, char_h, still='idle'):
    out = f'../app/assets/skins/{skin}/{name}'
    os.makedirs(out, exist_ok=True)
    for f in glob.glob(f'{out}/*.png') + glob.glob(f'{out}/*.webp'):
        os.remove(f)
    tmp = tempfile.mkdtemp()
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', video, '-vf', f'fps={FPS}', f'{tmp}/%03d.png'], check=True)
    frames = []
    for f in sorted(glob.glob(f'{tmp}/*.png')):
        rgb, a = key(np.array(Image.open(f).convert('RGB')))
        a = clean(a, 0.00001)
        # H3's chroma edges carry a 1–2 px olive fringe (green spill mixed into hair): pull the matte in by ~1 px
        a = np.minimum(a, ndimage.grey_erosion(a, size=(3, 3)) * 0.6 + a * 0.4)
        frames.append((rgb, a))   # video resolution is low, so the default threshold would clear the halo's fine dots as noise; H3 green screens are clean anyway
    union = np.zeros_like(frames[0][1], bool)
    for _, a in frames:
        union |= a > 0.02
    ys, xs = np.where(union)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    k = json.load(open(f'../app/assets/skins/{skin}/sprites.json'))[still]['h'] / char_h
    for i, (rgb, a) in enumerate(frames):
        im = Image.fromarray(np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1], 'RGBA')
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(f'{out}/{i:03d}.webp', quality=88, method=6)   # WebP with alpha, about 1/5 the size of PNG
    meta = {'count': len(frames), 'fps': FPS, 'w': im.width, 'h': im.height}
    json.dump(meta, open(f'{out}/meta.json', 'w'))
    print(name, meta)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), *sys.argv[5:])
