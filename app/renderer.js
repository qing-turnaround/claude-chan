// Sprites: transparent WebP, feet on the bottom edge of the image. Assets are already normalized by hair width, so just multiply everything by DISPLAY when drawing
// One directory per outfit, assets/skins/<skin>/, with identical file names inside
const DISPLAY = 0.6;   // assets are stored at about 1.7x their 100% size, enough for 150% DPI
const STILLS = ['idle', 'blink', 'happy', 'think', 'wait', 'done', 'walk0', 'walk1', 'walk2', 'walk3', 'drag', 'work', 'eat', 'sleep', 'pout'];
let SPRITES = {}, skin = 'hoodie';
// Per state: which image, which effect, how long (ms; 0 = lasts until interrupted by another).
// clip = H3 frame sequence; loop clips repeat for as long as the state lasts, the others play once and end the state.
const MODES = {
  idle:  { sprite: 'idle',  anim: 'breathe',   dur: 0 },
  happy: { sprite: 'happy', anim: 'bounce',    dur: 1600, clip: 'happy_anim' },
  think: { sprite: 'think', anim: 'sway',      dur: [4000, 7000] },
  eat:   { sprite: 'eat',   anim: 'wiggle',    dur: [4000, 6000], clip: 'eat_anim' },
  stretch: { sprite: 'idle', anim: 'breathe',  dur: 3000, clip: 'stretch_anim' },
  yawn:  { sprite: 'idle',  anim: 'breathe',   dur: 3000, clip: 'yawn_anim' },
  wave:  { sprite: 'idle',  anim: 'breathe',   dur: 3000, clip: 'wave_anim' },
  idleA: { sprite: 'idle',  anim: 'breathe',   dur: 3000, clip: 'idleA_anim' },    // outfit-specific fidget
  idleB: { sprite: 'idle',  anim: 'breathe',   dur: 3000, clip: 'idleB_anim' },    // look around
  wakeup: { sprite: 'idle', anim: 'breathe',   dur: 1500, clip: 'wakeup_anim' },
  pout:  { sprite: 'pout',  anim: 'wiggle',    dur: 2600 },
  sleep: { sprite: 'sleep', anim: 'breathe-s', dur: 0, clip: 'sleep_loop', loop: true },
  walk:  { sprite: 'walk0', anim: 'still',     dur: [3500, 8000] },
  drag:  { sprite: 'drag',  anim: 'still',     dur: 0 },
  work:  { sprite: 'work',  anim: 'type',      dur: 10 * 60e3, clip: 'work_loop', loop: true },
  wait:  { sprite: 'wait',  anim: 'bounce',    dur: 0, clip: 'wait_loop', loop: true },
  done:  { sprite: 'done',  anim: 'bounce',    dur: 3200, clip: 'cheer_anim' },
};

const $ = (id) => document.getElementById(id);
const body = $('body'), img = $('sprite'), bubble = $('bubble'), fx = $('fx');

let scale = 1, roam = true;
let mode = null, modeUntil = 0, nextIdleAct = Date.now() + 6000;
let walkDir = 1, status = null, autoSleep = false;
// Hit-testing keeps pixels only for the image currently shown (a canvas for each of the 284 would eat hundreds of MB)
const hitCanvas = document.createElement('canvas');
const hitCtx = hitCanvas.getContext('2d', { willReadFrequently: true });
let hitName = null;

// Frame-animation clips (frame sequences cut from H3 video): <skin>/<clip>/000.webp..., with frame count and fps in meta.json.
// If a clip is missing, that state falls back to the static image + CSS effect.
let CLIPS = {};
const src = (name) => `assets/skins/${skin}/${name}.webp`;

// Outfit switch: reload the whole set, keep showing the old one until loading finishes
async function loadSkin(name) {
  const base = `assets/skins/${name}/`;
  const sprites = Object.fromEntries(STILLS.map(n => [n, {}])), clips = {};
  for (const m of Object.values(MODES)) {
    if (!m.clip || clips[m.clip]) continue;
    try {
      const meta = await (await fetch(`${base}${m.clip}/meta.json`)).json();
      const names = [...Array(meta.count).keys()].map(i => `${m.clip}/${String(i).padStart(3, '0')}`);
      names.forEach(n => sprites[n] = {});
      clips[m.clip] = { ...meta, names };
    } catch {}
  }
  await Promise.all(Object.keys(sprites).map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => { sprites[n].ok = true; sprites[n].h = im.naturalHeight; res(); };
    im.onerror = () => res();
    im.src = `${base}${n}.webp`;
  })));
  SPRITES = sprites; CLIPS = clips; skin = name; hitName = null;
}

function show(name) {
  if (!SPRITES[name]?.ok) name = 'idle';
  const s = SPRITES[name];
  img.src = src(name);
  img.style.height = (s.h * DISPLAY * scale) + 'px';
  img.dataset.name = name;
}

// Actions that only make sense with a clip (stretch, yawn, wave): don't pick them if the clip isn't installed
const hasClip = (name) => { const c = CLIPS[MODES[name].clip]; return !!c && c.names.every(n => SPRITES[n].ok); };

function rand([a, b]) { return a + Math.random() * (b - a); }

function setMode(name, opts = {}) {
  const m = MODES[name];
  if (mode === 'walk' && name !== 'walk') window.pet.walk(0);
  mode = name;
  const clip = m.clip && hasClip(name) ? CLIPS[m.clip] : null;
  playing = clip ? { clip, i: 0, t0: performance.now(), loop: !!m.loop } : null;
  show(clip ? clip.names[0] : m.sprite);
  body.className = clip ? 'still' : m.anim;
  let d = Array.isArray(m.dur) ? rand(m.dur) : m.dur;
  if (clip && !m.loop) d = clip.count / clip.fps * 1000;     // one-shot clips end the state when they finish
  if (opts.dur) d = opts.dur;
  modeUntil = d ? Date.now() + d : 0;
  img.classList.toggle('flip', name === 'walk' && walkDir < 0);
  if (name === 'walk') window.pet.walk(walkDir);
  bubble.hidden = name !== 'wait';
  if (name === 'wait') { bubble.textContent = '!'; requestAnimationFrame(placeBubble); }
  if (name === 'happy') burst('❤', 5);
  if (name === 'done') burst('✦', 7);
  autoSleep = !!opts.autoSleep;
  afterMode = opts.next || null;
  seeking = !!opts.seek;
}
let seeking = false;
let afterMode = null;

function back() {
  // After a temporary action ends, return to the work status pushed by Claude Code (if any), otherwise idle
  if (status === 'work' || status === 'wait') setMode(status);
  else setMode('idle');
  nextIdleAct = Date.now() + rand([8000, 20000]);
}

// Bubbles and particles follow the top of the character's head (height varies a lot between poses)
function headBox() {
  const r = img.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function placeBubble() {
  const b = headBox();
  bubble.style.left = (b.x + b.w * 0.72) + 'px';
  bubble.style.top = Math.max(2, b.y - 8) + 'px';
}

function burst(ch, n, cls = '') {
  const b = headBox();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'p ' + cls; p.textContent = ch;
    p.style.left = (b.x + b.w * (0.25 + Math.random() * 0.5)) + 'px';
    p.style.top = (b.y + b.h * (0.05 + Math.random() * 0.2)) + 'px';
    p.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
    p.style.animationDelay = (i * 0.09) + 's';
    fx.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
}

// ---------- Clip playback ----------
let playing = null;
function clipStep(now) {
  if (playing) {
    const { clip } = playing;
    const f = Math.floor((now - playing.t0) / 1000 * clip.fps);
    const i = playing.loop ? f % clip.count : Math.min(clip.count - 1, f);
    if (i !== playing.i) { playing.i = i; show(clip.names[i]); }
  }
  requestAnimationFrame(clipStep);
}
requestAnimationFrame(clipStep);

// ---------- Walk frame loop (the bobbing is drawn into the frames, no longer faked in code) ----------
const WALK_FPS = 7;
let walkFrame = 0;
setInterval(() => {
  if (mode !== 'walk') return;
  walkFrame = (walkFrame + 1) % 4;
  show('walk' + walkFrame);
}, 1000 / WALK_FPS);

// ---------- Blinking ----------
function blinkLoop() {
  setTimeout(() => {
    if (mode === 'idle' && SPRITES.blink.ok) {
      show('blink');
      setTimeout(() => { if (mode === 'idle') show('idle'); }, 130);
    }
    blinkLoop();
  }, rand([2500, 6000]));
}

// ---------- Time of day (local clock) ----------
function dayPart() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  if (h >= 23 || h < 5) return 'night';
  if (h >= 6 && h < 9.5) return 'morning';
  if ((h >= 11.5 && h < 13.5) || (h >= 17.5 && h < 19.5)) return 'meal';
  return 'day';
}
// Weights of what she does on her own; the time of day multiplies some of them
const IDLE_POOL = { walk: 28, think: 10, eat: 8, stretch: 8, yawn: 5, wave: 8, idleA: 16, idleB: 14 };
const DAY_BIAS = {
  morning: { stretch: 2.5, yawn: 2 },
  meal:    { eat: 4 },
  night:   { yawn: 3, walk: 0.4, wave: 0.5, doze: 12 },     // doze: nod off standing for a few seconds
  day:     {},
};
const CLIP_ONLY = new Set(['stretch', 'yawn', 'wave', 'idleA', 'idleB']);
let lastPick = null;

function pickIdle() {
  const bias = DAY_BIAS[dayPart()];
  const pool = Object.entries({ ...IDLE_POOL, doze: bias.doze || 0 })
    .map(([n, w]) => [n, n === 'doze' ? w : w * (bias[n] || 1)])
    .filter(([n, w]) => w > 0 && n !== lastPick && (!CLIP_ONLY.has(n) || hasClip(n)));    // never the same thing twice in a row
  let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0), pick = pool[0][0];
  for (const [n, w] of pool) { if ((r -= w) < 0) { pick = n; break; } }
  lastPick = pick;
  return pick;
}

// ---------- Main loop: autonomous behavior ----------
const SEEK_AFTER = 25 * 60e3;      // no interaction for this long while you're at the computer -> she comes over to you
let lastInteract = Date.now();

setInterval(async () => {
  const now = Date.now();
  if (mode === 'drag') return;
  if (modeUntil && now > modeUntil) {
    if (mode === 'work') status = null;
    if (afterMode) { const n = afterMode; setMode(n.name, n.opts); return; }
    back();
    return;
  }
  if (autoPaused) return;           // screen recording: only scripted actions, no wandering / dozing / seeking
  // Away from the computer -> yawn, then sleep (sooner late at night); wake up when the user is back
  const idleSec = await window.pet.idleSeconds();
  const sleepAfter = dayPart() === 'night' ? 120 : 300;
  if (idleSec > sleepAfter && ['idle', 'think', 'walk', 'idleA', 'idleB'].includes(mode)) {
    if (hasClip('yawn')) setMode('yawn', { next: { name: 'sleep', opts: { autoSleep: true } } });
    else setMode('sleep', { autoSleep: true });
    return;
  }
  if (mode === 'sleep' && autoSleep && idleSec < 3) { setMode(hasClip('wakeup') ? 'wakeup' : 'happy'); return; }
  if (mode === 'sleep') { if (Math.random() < 0.5) burst('z', 1, 'z'); return; }

  // Walking over to the cursor to get your attention
  if (seeking && mode === 'walk') {
    const { cursor, bounds } = await window.pet.cursor();
    const dx = cursor.x - (bounds.x + bounds.width / 2);
    if (Math.abs(dx) < 140) { setMode('wave'); lastInteract = now; return; }
    const dir = dx > 0 ? 1 : -1;
    if (dir !== walkDir) { walkDir = dir; img.classList.toggle('flip', dir < 0); window.pet.walk(dir); }
    return;
  }

  if (mode === 'idle' && roam && idleSec < 30 && now - lastInteract > SEEK_AFTER) {
    const { cursor, bounds } = await window.pet.cursor();
    walkDir = cursor.x > bounds.x + bounds.width / 2 ? 1 : -1;
    setMode('walk', { seek: true, dur: 20000 });
    lastInteract = now;              // whether or not she reaches you, wait another round before trying again
    return;
  }

  if (mode === 'idle' && roam && now > nextIdleAct) {
    const pick = pickIdle();
    if (pick === 'walk') walkDir = Math.random() < 0.5 ? -1 : 1;
    if (pick === 'doze') setMode('sleep', { dur: rand([8000, 15000]), next: hasClip('wakeup') ? { name: 'wakeup' } : null });
    else setMode(pick);
    nextIdleAct = now + rand([6000, 15000]);
  }
}, 1000);

// ---------- Mouse ----------
let overLast = false, down = null, dragging = false, clicks = [], lastHeadClick = 0;

function overPixel(cx, cy) {
  const name = img.dataset.name, c = hitCanvas;
  if (!name || !img.complete || !img.naturalWidth) return false;
  if (hitName !== name) {
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    hitCtx.drawImage(img, 0, 0); hitName = name;
  }
  const r = img.getBoundingClientRect();
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false;
  let u = (cx - r.left) / r.width;
  if (img.classList.contains('flip')) u = 1 - u;
  const x = Math.floor(u * c.width), y = Math.floor((cy - r.top) / r.height * c.height);
  return hitCtx.getImageData(x, y, 1, 1).data[3] > 40;
}

// Petting: rubbing the mouse back and forth over her head
let petDir = 0, petFlips = [], petCooldown = 0;
function petting(e) {
  const r = img.getBoundingClientRect();
  if (e.clientY > r.top + r.height * 0.35) return;               // head only
  const dir = Math.sign(e.movementX);
  if (!dir) return;
  const now = Date.now();
  if (petDir && dir !== petDir) petFlips.push(now);
  petDir = dir;
  petFlips = petFlips.filter(t => now - t < 1500);
  if (petFlips.length >= 4 && now > petCooldown) {
    petFlips = []; petCooldown = now + 4000; lastInteract = now;
    if (mode === 'work' || mode === 'wait' || mode === 'sleep') burst('❤', 3);
    else setMode('happy');
  }
}

window.addEventListener('mousemove', (e) => {
  if (down && !dragging && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 5) {
    dragging = true;
    window.pet.dragStart();
    setMode('drag');
  }
  if (dragging) return;
  const over = overPixel(e.clientX, e.clientY);
  if (over !== overLast) { overLast = over; window.pet.hit(over); }
  if (over && !down) petting(e);
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && overPixel(e.clientX, e.clientY)) down = { x: e.screenX, y: e.screenY };
});
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  if (dragging) { dragging = false; window.pet.dragEnd(); lastInteract = Date.now(); }
  else if (down) {
    const now = Date.now();
    lastInteract = now;
    // raising her hand for approval: a double-click on her head approves the request (once)
    const r = img.getBoundingClientRect(), onHead = e.clientY < r.top + r.height * 0.4;
    if (mode === 'wait' && onHead && now - lastHeadClick < 450) { lastHeadClick = 0; burst('❤', 3); window.pet.patApprove(); down = null; return; }
    lastHeadClick = onHead ? now : 0;
    clicks = clicks.filter(t => now - t < 3000); clicks.push(now);
    if (clicks.length >= 5 && mode !== 'wait' && mode !== 'work') {   // poked too many times -> pout
      clicks = []; setMode('pout'); burst('💢', 1);
    }
    else if (mode === 'sleep') setMode(hasClip('wakeup') ? 'wakeup' : 'happy');
    else if (mode === 'wait' || mode === 'work') burst('❤', 3);
    else if (mode !== 'pout') setMode(hasClip('wave') && Math.random() < 0.3 ? 'wave' : 'happy');
  }
  down = null;
});
window.addEventListener('contextmenu', (e) => { e.preventDefault(); window.pet.menu(); });

// While held she hangs like a pendulum: feet trail behind the drag direction, swing a couple of times after release, then settle.
// The angle must go through a spring; if it jumped straight with mouse speed it would snap back the moment the hand stops, looking like a ghost image.
let ang = 0, angV = 0, swingTarget = 0, vxs = 0, swinging = false;
window.pet.on('drag-move', (vx) => {
  if (mode !== 'drag') return;
  vxs = vxs * 0.75 + vx * 0.25;
  swingTarget = Math.max(-28, Math.min(28, vxs * 1.6));
});
// Integrate in real time: per-frame stepping would finish the whole swing in 0.2 s on high-refresh screens (144Hz+), looking like a smear
const SWING_K = 80, SWING_C = 4;   // ω≈9 rad/s，swing period ~0.7s, damping ratio ~0.22
let lastT = performance.now();
function swingStep(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (mode !== 'drag') swingTarget = 0;
  angV += ((swingTarget - ang) * SWING_K - angV * SWING_C) * dt;
  ang += angV * dt;
  const active = mode === 'drag' || Math.abs(ang) > 0.3 || Math.abs(angV) > 3;
  if (active) {
    swinging = true;
    body.style.transformOrigin = '50% 0%';
    body.style.transform = `translateX(-50%) rotate(${ang.toFixed(2)}deg)`;
  } else if (swinging) {           // hand back to the breathing animation only once the swing stops (a CSS animation overrides the inline transform)
    swinging = false; ang = angV = vxs = 0;
    body.style.transform = ''; body.style.transformOrigin = '';
    body.className = MODES[mode].anim;
  }
  requestAnimationFrame(swingStep);
}
requestAnimationFrame(swingStep);

window.pet.on('landed', () => {
  setMode('idle');
  if (swinging) body.className = 'still';
  else { body.className = 'squash'; setTimeout(() => { if (mode === 'idle' && !swinging) body.className = 'breathe'; }, 360); }
});
window.pet.on('turn', (dir) => { walkDir = dir; img.classList.toggle('flip', dir < 0); });

// ---------- Menu / external status ----------
window.pet.on('action', (name) => {
  if (name === 'walk') walkDir = Math.random() < 0.5 ? -1 : 1;
  if (name === 'work' || name === 'wait') status = name;
  if (name === 'done' || name === 'idle') status = null;
  setMode(name);
});
window.pet.on('status', (s) => {
  if (mode === 'drag') { status = s === 'done' || s === 'idle' ? null : s; return; }
  const busy = s === 'work' || s === 'wait';
  // Woken by Claude Code: get up first instead of jumping straight from sleeping to typing
  if (busy && mode === 'sleep' && hasClip('wakeup')) { status = s; setMode('wakeup', { next: { name: s } }); return; }
  if (busy && mode === 'wakeup') { status = s; afterMode = { name: s }; return; }      // let her finish getting up
  // Repeated work/wait only refreshes the timeout when she is actually in that state; otherwise it would stretch
  // whatever temporary action is playing (a yawn could last 10 minutes)
  if (s === status && busy) { if (mode === s) modeUntil = s === 'work' ? Date.now() + MODES.work.dur : 0; return; }
  status = (s === 'work' || s === 'wait') ? s : null;
  setMode(s);
});
window.pet.on('scale', (s) => { scale = s; if (img.dataset.name) show(img.dataset.name); });
window.pet.on('roam', (r) => { roam = r; });
let autoPaused = false;
window.pet.on('auto', (on) => { autoPaused = !on; });
window.pet.on('skin', async (name) => {
  await loadSkin(name);
  setMode(status === 'work' || status === 'wait' ? status : 'wave');   // wave after changing clothes
});

(async () => {
  const st = await window.pet.settings();
  roam = st.roam;
  await loadSkin(st.skin && st.skin !== 'clawd' ? st.skin : 'hoodie');   // the Clawd outfit hides this window
  setMode('idle');
  blinkLoop();
})();

// Linux: no click-through forwarding there, so the window is shaped to a padded box around what's on screen
// (her, the "!" bubble, any hearts / sparkles), refreshed 10 times a second. Clicks outside it pass through.
if (window.pet.platform === 'linux') {
  let last = '';
  setInterval(() => {
    const boxes = [img, bubble, ...fx.children].filter((el) => el && !el.hidden && el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
    if (!boxes.length) return;
    const pad = 12;
    const x0 = Math.max(0, Math.floor(Math.min(...boxes.map((r) => r.left)) - pad));
    const y0 = Math.max(0, Math.floor(Math.min(...boxes.map((r) => r.top)) - pad));
    const x1 = Math.min(innerWidth, Math.ceil(Math.max(...boxes.map((r) => r.right)) + pad));
    const y1 = Math.min(innerHeight, Math.ceil(Math.max(...boxes.map((r) => r.bottom)) + pad));
    const key = [x0, y0, x1, y1].join();
    if (key !== last) { last = key; window.pet.shape([{ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }]); }
  }, 100);
}
