"""Green-screen source -> transparent WebP: key out green, remove green fringe, remove specks, crop, and normalize character size by hair width.

Usage: python process.py <skin>   (hoodie reads raw/, the others read raw/<skin>/; writes ../app/assets/skins/<skin>/)
"""
import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = {  # output name -> source image
    'idle': 'idle', 'blink': 'blink', 'happy': 'happy', 'think': 'think', 'wait': 'wait',
    'done': 'done', 'walk': 'walk', 'drag': 'drag2', 'work': 'work', 'eat': 'eat', 'sleep': 'sleep', 'pout': 'pout',
}
ASSETS = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets', 'skins')
HAIR_PX = 300   # hair width after normalization (px); scaled down 2x again at display time
IDLE_H = 699    # height of the hoodie idle image; other outfits are aligned to it as a set


def key(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    greenness = g - np.maximum(r, b)          # pure green background ~170, character <0
    alpha = np.clip((90 - greenness) / 60, 0, 1)
    # Remove green fringe: for semi-transparent and edge pixels, clamp g to the max of r/b
    spill = greenness > 0
    g2 = np.where(spill, np.maximum(r, b), g)
    out = np.stack([r, g2, b], -1)
    return out, alpha


def clean(alpha, min_frac=0.004):
    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    if n == 0:
        return alpha
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= sizes.max() * min_frac     # the star ahoge is a separate piece and must be kept; action lines and sparkle specks are dropped
    mask = keep[lab]
    mask = ndimage.binary_dilation(mask, iterations=3)
    return alpha * mask


def hair_width(rgb, alpha):
    r, g, b = [rgb[..., i] for i in range(3)]
    hair = (alpha > 0.9) & (r > 170) & (r - b > 70) & (g > 80) & (g < 175)
    lab, n = ndimage.label(hair)
    sizes = ndimage.sum(hair, lab, range(1, n + 1))
    big = lab == (np.argmax(sizes) + 1)        # largest orange blob = hair (the star on the hoodie is much smaller)
    xs = np.where(big.any(0))[0]
    return xs[-1] - xs[0]


def halo_width(rgb, alpha):
    """The star spirit's hair is off-white and can't be measured; measure the floating star halo above the head instead (fixed ratio to the head)."""
    r, g, b = [rgb[..., i] for i in range(3)]
    orange = (alpha > 0.5) & (r > 190) & (r - b > 90)
    ys = np.where(alpha.max(1) > 0.5)[0]
    top = ys.min() + (ys.max() - ys.min()) * 0.22
    lab, n = ndimage.label(orange)
    best = 0
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl[0].stop <= top:                         # the whole blob is within the top 22%
            best = max(best, sl[0].stop - sl[0].start)   # measure height: the outer halo ring is flat, so measuring width would be inflated by it
    return best


NORM = {'spirit': (halo_width, 100)}

# Manual correction: long hair spreads out in sitting poses/actions so the auto-measured hair width is off; these factors were set by eye after aligning head size across poses to idle.
# Both auto methods (hair width, face width) were tried and neither has a single correct answer, so no more algorithm piling.
FIX = {
    'hoodie':  {'pout': 1.1},
    'scholar': {'pout': 1.3, 'happy': 1.1, 'think': 1.1, 'wait': 1.1, 'done': 1.05, 'drag': 1.2, 'walk': 1.3, 'work': 1.3, 'eat': 1.2, 'sleep': 0.95},
    'maid':    {'happy': 1.3, 'think': 0.95, 'wait': 1.05, 'done': 1.1, 'drag': 1.05, 'work': 1.3, 'eat': 1.4, 'sleep': 1.5},
    'spirit':  {'happy': 1.05, 'think': 0.87, 'wait': 0.87, 'done': 1.05, 'eat': 0.97, 'sleep': 0.97},
}    # skin -> (method, target px); defaults to hair width HAIR_PX


def main(skin):
    OUT = f'{ASSETS}/{skin}'
    raw = 'raw' if skin == 'hoodie' else f'raw/{skin}'
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    # Measure idle first: multiply the whole set by skin_k so the idle height matches the hoodie (IDLE_H). Long-haired characters have wide hair, so normalizing by hair alone would make the whole set too small/large
    skin_k = 1.0
    if skin != 'hoodie':
        im = np.array(Image.open(f'{raw}/idle.png').convert('RGB'))
        rgb, a = key(im); a = clean(a)
        measure, target = NORM.get(skin, (hair_width, HAIR_PX))
        ys = np.where(a.max(1) > 0.02)[0]
        skin_k = IDLE_H / ((ys.max() + 1 - ys.min()) * target / measure(rgb, a))
    for name, src in SRC.items():
        if skin != 'hoodie' and src == 'drag2':
            src = 'drag'
        if not os.path.exists(f'{raw}/{src}.png'):
            print(name, 'missing, skip'); continue
        im = np.array(Image.open(f'{raw}/{src}.png').convert('RGB'))
        rgb, a = key(im)
        a = clean(a)
        measure, target = NORM.get(skin, (hair_width, HAIR_PX))
        hw = measure(rgb, a)
        ys, xs = np.where(a > 0.02)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
        k = target / hw
        img = Image.fromarray(rgba, 'RGBA')
        k *= skin_k * FIX.get(skin, {}).get(name, 1.0)
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
        img.save(f'{OUT}/{name}.webp', quality=90, method=6)
        meta[name] = {'w': img.width, 'h': img.height, 'hair': int(hw), 'k': round(k, 3)}
        print(name, meta[name])
    json.dump(meta, open(f'{OUT}/sprites.json', 'w'), indent=1)


if __name__ == '__main__':
    import sys
    main(sys.argv[1])
