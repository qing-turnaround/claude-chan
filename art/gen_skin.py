"""Generate all green-screen source images for one outfit: 10 poses + a 4-frame walk sheet. Two parallel jobs (the relay defaults to 2).

Usage: python gen_skin.py scholar maid spirit      → art/raw/<skin>/*.png
Existing images are skipped; rerunning after failures only fills in what's missing.
"""
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

IDENTITY = {
    'hoodie': 'messy short terracotta-orange hair with a long ahoge antenna ending in a floating orange starburst spark, cream starburst hair clip, '
              'orange over-ear headphones around her neck, oversized cream hoodie with orange starburst logos, backpack straps, black shorts, '
              'white socks and fluffy sheep slippers',
    'scholar': 'shoulder-length wavy terracotta-orange hair, a gold starburst hairpin with a dangling orange ribbon, round thin gold glasses, '
               'cream cable-knit cardigan over a white blouse with a small black ribbon bow, terracotta pleated skirt, white knee socks, brown loafers',
    'maid': 'long fluffy wavy terracotta-orange hair fading to cream at the tips, a small ahoge, frilly cream maid headdress with an orange starburst '
            'in the center and black ribbon bows, terracotta-orange maid dress with puffy short sleeves, white frilly apron with an orange starburst '
            'emblem, big black bow at the collar, white frilly socks with orange bows, black mary-jane shoes',
    'spirit': 'long flowing cream hair with terracotta-orange gradient toward the tips, a small ahoge, an orange starburst hair ornament with ribbons, '
              'a floating orange starburst halo above her head shaped like an asterisk sun with about twelve thin uneven rays radiating from one '
              'center point (rays, not petals, not a flower) with a thin glowing ring, off-shoulder cream flowing dress with a layered petal-like hem '
              'in terracotta and dark brown, small tassels, barefoot, a few tiny orange sparkles',
}

POSES = {
    'idle': 'standing facing the viewer, arms relaxed at her sides, empty hands, gentle closed-mouth smile, eyes open looking at viewer.',
    'drag': 'dangling in the air as if lifted by an invisible hand from above, body hanging, legs dangling and slightly kicking, arms hanging limp, '
            'flustered surprised face with wavy mouth and blush, sweat drop. Only her, no other hands or arms in the picture.',
    'happy': 'standing, both hands pressed against her blushing cheeks, eyes closed in happy arcs, big open-mouth smile, very pleased.',
    'work': 'sitting on the floor cross-legged facing the viewer, an open silver laptop on her lap, typing with both hands, focused determined face.',
    'wait': 'standing facing the viewer, one arm raised high waving to get attention, other arm hugging a closed silver laptop, hopeful slightly anxious face.',
    'done': 'jumping in celebration with both arms raised high, feet off the ground, eyes closed in happy arcs, big open-mouth smile.',
    'sleep': 'sitting curled up on the floor fast asleep, hugging a closed silver laptop like a pillow, eyes closed, peaceful face.',
    'think': 'standing, one finger on her chin, looking up and to the side, pondering expression with slightly pouted mouth.',
    'walk': 'walking toward the right, three-quarter side view, mid-stride with one leg forward, arms swinging, cheerful face.',
    'pout': 'standing facing the viewer, cheeks puffed up in an angry pout, eyebrows furrowed, both fists clenched at her sides, a small anger mark, cute and not scary.',
    'eat': 'sitting on the floor facing the viewer holding a big triangle rice ball onigiri with both hands, taking a bite, cheeks puffed, happy eyes.',
}

WALK = ('TASK: a 4-frame walk cycle sprite sheet, four poses of the same character in ONE horizontal row, evenly spaced, not overlapping, all '
        'standing on the same baseline, all the same size, strict side view facing RIGHT in every frame (never facing the viewer, all 4 from the same '
        'camera angle), cheerful face. Frame 1 CONTACT: right leg stepping forward with heel touching ground, left leg stretched behind, left arm '
        'swinging forward, right arm back. Frame 2 PASSING: right leg straight under the body supporting the weight, left knee bent lifting the left '
        'foot off the ground, body slightly higher, arms near the body. Frame 3 CONTACT: left leg stepping forward with heel touching ground, right '
        'leg stretched behind, right arm swinging forward, left arm back. Frame 4 PASSING: left leg straight under the body, right knee bent lifting '
        'the right foot, body slightly higher.')

BG = 'Background: solid flat pure chroma green (#00D63C) filling the entire image, no floor, no cast shadow, no gradient, no text.'
ENV = {**os.environ, 'HTTPS_PROXY': 'http://127.0.0.1:7898', 'HTTP_PROXY': 'http://127.0.0.1:7898'}
TOOL = os.path.expanduser('~/.claude/tools/image_gen2.py')
HERE = os.path.dirname(os.path.abspath(__file__))


def job(skin, name):
    out = f'{HERE}/raw/{name}.png' if skin == 'hoodie' else f'{HERE}/raw/{skin}/{name}.png'
    if os.path.exists(out):
        return f'{skin}/{name} skip'
    ident = f'the same chibi girl with the same face, {IDENTITY[skin]}'
    ref = f'{HERE}/ref_C_main.png' if skin == 'hoodie' else f'{HERE}/ref_{skin}_main.png'
    if name == 'walksheet':
        p = (f'Redraw THE EXACT SAME character from the reference image with IDENTICAL design: {ident}. Same chibi proportions and same clean '
             f'lineart with soft cel shading. {WALK} {BG}')
        size = '2048x768'
    else:
        p = (f'Use the reference image ONLY for character identity and art style: {ident}. Same chibi proportions (about 2.5 heads tall), same clean '
             f'lineart and soft cel shading. NEW POSE: {POSES[name]} Full body, the whole character visible with generous margin on all sides, '
             f'centered, one character only. {BG}')
        size = '1024x1536'
    r = subprocess.run([sys.executable, '-u', TOOL, 'edit', p, '-o', out, '-i', ref, '--fidelity', 'high', '--size', size, '--quality', 'high'],
                       env=ENV, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return f'{skin}/{name} ' + ('OK' if os.path.exists(out) else 'FAIL ' + (r.stdout + r.stderr)[-300:])


if __name__ == '__main__':
    jobs = []
    for skin in sys.argv[1:]:
        os.makedirs(f'{HERE}/raw/{skin}', exist_ok=True)
        if skin != 'hoodie':
            jobs += [(skin, 'idle')]                       # do idle first: H3 uses it as the first/last frame
    for skin in sys.argv[1:]:
        jobs += [(skin, n) for n in POSES if n != 'idle'] + [(skin, 'walksheet')]
    with ThreadPoolExecutor(2) as ex:
        for msg in ex.map(lambda j: job(*j), jobs):
            print(msg, flush=True)
    print('ALL_DONE')
