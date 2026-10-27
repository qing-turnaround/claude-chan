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

// ---------- Holiday decorations around her (holidays.js in the main process says which, if any) ----------
// Drawn on a canvas in front of her that never takes the mouse: Halloween bats and a jack-o-lantern, Christmas snow
// and a little tree, Lunar New Year lanterns and the odd firework. Positions follow her drawn size, so they scale.
const deco = $('deco'), dg = deco.getContext('2d');
let holiday = null, decoTimer = null;
const flakes = Array.from({ length: 26 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 1.2 + Math.random() * 1.8, v: 0.25 + Math.random() * 0.35, ph: i }));
let fireworks = [], nextFirework = 0;

function bat(x, y, s, flap) {
  dg.save(); dg.translate(x, y); dg.scale(s * 1.25, s * 1.25);
  const w = Math.sin(flap) * 6;
  dg.beginPath();
  dg.moveTo(0, 0);
  dg.quadraticCurveTo(-6, -9 - w, -14, -6 - w); dg.quadraticCurveTo(-11, 0, -12, 3); dg.quadraticCurveTo(-8, 1, -6, 4); dg.quadraticCurveTo(-3, 1, 0, 3);
  dg.quadraticCurveTo(3, 1, 6, 4); dg.quadraticCurveTo(8, 1, 12, 3); dg.quadraticCurveTo(11, 0, 14, -6 - w); dg.quadraticCurveTo(6, -9 - w, 0, 0);
  dg.fillStyle = '#3B2A4A'; dg.fill();
  dg.beginPath(); dg.arc(0, 0, 3.4, 0, Math.PI * 2); dg.fill();
  dg.fillStyle = '#F6C445'; dg.fillRect(-1.6, -1, 1, 1); dg.fillRect(0.6, -1, 1, 1);
  dg.restore();
}
function lantern(x, y, s, t) {
  dg.save(); dg.translate(x, y); dg.rotate(Math.sin(t) * 0.08); dg.scale(s, s);
  dg.strokeStyle = '#2B2220'; dg.lineWidth = 1.4;
  dg.beginPath(); dg.moveTo(0, -30); dg.lineTo(0, -12); dg.stroke();
  dg.fillStyle = '#C9A13B'; dg.fillRect(-5, -13, 10, 3); dg.fillRect(-5, 11, 10, 3);
  dg.beginPath(); dg.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); dg.fillStyle = '#D9302B'; dg.fill(); dg.stroke();
  dg.strokeStyle = 'rgba(143,30,26,.7)'; dg.beginPath(); dg.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2); dg.stroke();
  dg.strokeStyle = '#C9A13B'; dg.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) { dg.beginPath(); dg.moveTo(i * 1.6, 14); dg.lineTo(i * 1.6, 22); dg.stroke(); }
  dg.restore();
}
function pumpkin(x, y, s, now) {
  dg.save(); dg.translate(x, y); dg.scale(s, s);
  dg.beginPath(); dg.moveTo(0, -10); dg.quadraticCurveTo(1, -15, 4, -16); dg.strokeStyle = '#4E6B2E'; dg.lineWidth = 2.4; dg.stroke();
  dg.strokeStyle = '#2B2220'; dg.lineWidth = 1.8;
  [[-7, 7], [7, 7], [0, 8.5]].forEach(([px, r]) => { dg.beginPath(); dg.ellipse(px, 0, r, 10, 0, 0, Math.PI * 2); dg.fillStyle = '#F28C28'; dg.fill(); dg.stroke(); });
  dg.fillStyle = `rgba(255,214,90,${0.75 + Math.sin(now / 170) * 0.25})`;
  dg.beginPath(); dg.moveTo(-7, -2); dg.lineTo(-3, -2); dg.lineTo(-5, -6); dg.fill();
  dg.beginPath(); dg.moveTo(3, -2); dg.lineTo(7, -2); dg.lineTo(5, -6); dg.fill();
  dg.beginPath(); dg.moveTo(-6, 3); dg.lineTo(6, 3); dg.lineTo(3, 6); dg.lineTo(0, 4.5); dg.lineTo(-3, 6); dg.closePath(); dg.fill();
  dg.restore();
}
function tree(x, y, s, now) {
  dg.save(); dg.translate(x, y); dg.scale(s, s);
  dg.strokeStyle = '#2B2220'; dg.lineWidth = 1.8; dg.lineJoin = 'round';
  dg.fillStyle = '#7A4A2E'; dg.fillRect(-3, -6, 6, 6); dg.strokeRect(-3, -6, 6, 6);
  [[0, -6, 16], [0, -16, 13], [0, -25, 9]].forEach(([tx, ty, w]) => {
    dg.beginPath(); dg.moveTo(tx - w, ty); dg.lineTo(tx, ty - 14); dg.lineTo(tx + w, ty); dg.closePath(); dg.fillStyle = '#3E8E5A'; dg.fill(); dg.stroke();
  });
  [[-7, -10, '#D94A3D'], [6, -14, '#F6C445'], [-3, -21, '#3D7DD9'], [4, -26, '#D94A3D']].forEach(([bx, by, c], i) => {
    dg.beginPath(); dg.arc(bx, by, 1.9, 0, Math.PI * 2); dg.fillStyle = c; dg.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(now / 400 + i)); dg.fill(); dg.globalAlpha = 1;
  });
  dg.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2 : 4.5; dg.lineTo(Math.cos(a) * r, -41 + Math.sin(a) * r); }
  dg.closePath(); dg.fillStyle = '#F6C445'; dg.fill(); dg.lineWidth = 1.2; dg.stroke();
  dg.restore();
}

function drawDeco() {
  const W = deco.clientWidth, H = deco.clientHeight, dpr = devicePixelRatio || 1;
  if (deco.width !== Math.round(W * dpr)) { deco.width = Math.round(W * dpr); deco.height = Math.round(H * dpr); }
  dg.setTransform(dpr, 0, 0, dpr, 0, 0); dg.clearRect(0, 0, W, H);
  if (!holiday) return;
  const r = img.getBoundingClientRect(), now = performance.now(), s = Math.max(0.9, r.height / 140);
  const cx = r.left + r.width / 2, top = r.top, bottom = H;
  if (holiday === 'halloween') {
    // three bats on loops round her head, at different speeds
    [[0, 1.0, 1], [2.1, 0.8, 0.8], [4.2, 1.25, 0.65]].forEach(([ph, sp, sz]) => {
      const t = now / 1000 * sp + ph;
      bat(cx + Math.cos(t) * (r.width * 0.62 + 14 * sz), top + 22 * s + Math.sin(t * 2) * 14 * s, s * sz, now / 70 + ph * 3);
    });
    pumpkin(cx - r.width * 0.7, bottom - 13 * s, s * 1.1, now);
  } else if (holiday === 'xmas') {
    dg.fillStyle = 'rgba(255,255,255,.95)'; dg.strokeStyle = 'rgba(150,170,200,.6)'; dg.lineWidth = 0.8;
    for (const f of flakes) {
      f.y += f.v / H * 2.2; if (f.y > 1) { f.y = 0; f.x = Math.random(); }
      const x = f.x * W + Math.sin(now / 900 + f.ph) * 8, y = f.y * H;
      dg.beginPath(); dg.arc(x, y, f.r * s, 0, Math.PI * 2); dg.fill(); dg.stroke();
    }
    tree(cx + r.width * 0.72, bottom, s * 1.1, now);
  } else if (holiday === 'cny') {
    lantern(cx - r.width * 0.66, top + 24 * s, s * 0.95, now / 900);
    lantern(cx + r.width * 0.66, top + 16 * s, s * 0.85, now / 900 + 1.7);
    if (now > nextFirework) {                     // a small burst of sparks now and then, above one side
      nextFirework = now + 5000 + Math.random() * 4000;
      const x0 = cx + (Math.random() < 0.5 ? -1 : 1) * r.width * (0.4 + Math.random() * 0.3), y0 = top - 6 * s + Math.random() * 20 * s;
      fireworks.push({ x: x0, y: y0, t0: now, col: ['#F6C445', '#D9302B', '#F28C28'][Math.floor(Math.random() * 3)] });
    }
    fireworks = fireworks.filter((f) => now - f.t0 < 1100);
    for (const f of fireworks) {
      const p = (now - f.t0) / 1100;
      dg.fillStyle = f.col; dg.globalAlpha = 1 - p;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, d = p * 28 * s; dg.beginPath(); dg.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d + p * p * 10, 2 * s * (1 - p * 0.5), 0, Math.PI * 2); dg.fill(); }
      dg.globalAlpha = 1;
    }
  }
}
window.pet.on('holiday', (h) => {
  holiday = h;
  clearInterval(decoTimer); decoTimer = null;
  if (h) decoTimer = setInterval(drawDeco, 33);
  drawDeco();
});
