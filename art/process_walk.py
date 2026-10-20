"""4-frame walk sheet -> app/assets/walk0..3.webp (same canvas, feet on the bottom edge, aligned by head to avoid jitter during playback).

This time the relay returned a transparent background directly (not green screen), with semi-transparent red/yellow fringe on the edges: tighten alpha + keep only large connected blobs.
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

import sys
from process import key
SKIN = sys.argv[1] if len(sys.argv) > 1 else 'hoodie'
SHEET = 'raw/walksheet_a.png' if SKIN == 'hoodie' else f'raw/{SKIN}/walksheet.png'
OUT = f'../app/assets/skins/{SKIN}'
TARGET_H = 0.97   # relative to the idle image height (walking is slightly shorter than standing)


def main():
    a = np.array(Image.open(SHEET).convert('RGBA')).astype(np.float32)
    if a[..., 3].min() < 250:      # the relay sometimes returns a transparent background directly (with red/yellow fringe)
        alpha = np.clip((a[..., 3] - 110) / 120, 0, 1)
    else:                           # normal green screen
        rgb, alpha = key(a[..., :3])
        a[..., :3] = rgb
    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool); keep[1:] = sizes >= sizes.max() * 0.004
    alpha *= ndimage.binary_dilation(keep[lab], iterations=2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    a[..., 1] = np.minimum(g, np.maximum(r, b))        # remove green fringe

    # split into 4 frames at blank columns
    cols = alpha.max(0) > 0.05
    runs, x = [], 0
    while x < len(cols):
        if cols[x]:
            s = x
            while x < len(cols) and cols[x]: x += 1
            runs.append([s, x])
        x += 1
    merged = []
    for r in runs:                       # merge small gaps such as the ahoge star back in
        if merged and r[0] - merged[-1][1] < 25: merged[-1][1] = r[1]
        else: merged.append(r)
    merged = sorted(merged, key=lambda r: r[1] - r[0], reverse=True)[:4]
    merged.sort()
    assert len(merged) == 4, merged

    idle_h = json.load(open(f'{OUT}/sprites.json'))['idle']['h']
    frames = []
    for x0, x1 in merged:
        al = alpha[:, x0:x1]; rgb = a[:, x0:x1, :3]
        ys = np.where(al.max(1) > 0.05)[0]
        y0, y1 = ys.min(), ys.max() + 1
        al, rgb = al[y0:y1], rgb[y0:y1]
        # head center: x of the centroid of the top 35% of pixels
        top = al[: int(al.shape[0] * 0.35)]
        hx = (top.sum(0) * np.arange(top.shape[1])).sum() / top.sum()
        frames.append((rgb, al, hx))
    k = idle_h * TARGET_H / max(f[1].shape[0] for f in frames)

    left = max(f[2] for f in frames) * k
    right = max((f[1].shape[1] - f[2]) for f in frames) * k
    W = int(left + right) + 4
    H = int(max(f[1].shape[0] for f in frames) * k) + 2
    for i, (rgb, al, hx) in enumerate(frames):
        im = Image.fromarray(np.dstack([rgb, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        canvas = Image.new('RGBA', (W, H))
        canvas.alpha_composite(im, (int(left - hx * k) + 2, H - im.height))
        canvas.save(f'{OUT}/walk{i}.webp', quality=90, method=6)
        print(f'walk{i}', im.size, 'canvas', (W, H))


if __name__ == '__main__':
    main()
