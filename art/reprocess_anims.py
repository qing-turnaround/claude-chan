"""Re-key every one-shot action clip (all outfits) with the current process_video settings."""
import glob, os
import process_video

ACTS = ['happy', 'cheer', 'eat', 'stretch', 'yawn', 'wave']
for skin in ['hoodie', 'scholar', 'maid', 'spirit']:
    for a in ACTS:
        if skin == 'hoodie':
            d = '../h3/out/pet_hoodie_happy' if a == 'happy' else f'../h3/out/pet_{a}'
        else:
            d = f'../h3/out/pet_{skin}_{a}'
        vids = sorted(glob.glob(f'{d}/*.mp4'))
        if not vids:
            print('missing', skin, a); continue
        process_video.main(vids[-1], skin, f'{a}_anim', 700, 'idle')
