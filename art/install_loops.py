"""Install every finished H3 loop/fidget clip that isn't installed yet.

h3/out/loop_<skin>_<type>/*.mp4  ->  app/assets/skins/<skin>/<clip>/
Scale: the first frames were built so that the idle pose is 700 px tall (h3/charH.json), so each clip is
scaled against the still it starts from.
"""
import glob, json, os, re, sys
import process_video

TYPES = {  # type -> (clip folder, still the clip is measured against)
    'wait': ('wait_loop', 'wait'),
    'work': ('work_loop', 'work'),
    'sleep': ('sleep_loop', 'sleep'),
    'idleA': ('idleA_anim', 'idle'),
    'idleB': ('idleB_anim', 'idle'),
    'wakeup': ('wakeup_anim', 'idle'),    # ends on the idle pose; scale by idle
}
H = json.load(open('../h3/charH.json'))
force = '--force' in sys.argv

for d in sorted(glob.glob('../h3/out/loop_*')):
    m = re.match(r'loop_(\w+?)_(\w+)$', os.path.basename(d))
    vids = glob.glob(f'{d}/*.mp4')
    if not m or not vids:
        continue
    skin, t = m.groups()
    clip, still = TYPES[t]
    if os.path.exists(f'../app/assets/skins/{skin}/{clip}/meta.json') and not force:
        continue
    process_video.main(sorted(vids)[-1], skin, clip, H[skin][still], still)
