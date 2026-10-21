// The Clawd outfit: Claude Code's mascot (red and/or pink) crawling along the edges of the work area,
// counter-clockwise: floor -> right wall -> ceiling (upside down) -> left wall. Each one is its own small
// transparent window. The main process owns positions and behaviour; the windows only draw (critter.html).
// Off the perimeter (picked up, or falling) a critter is "free": a point with velocity under gravity.
const { BrowserWindow, ipcMain, screen, powerMonitor } = require('electron');
const path = require('path');
const LINUX = process.platform === 'linux';   // no click-through forwarding: windows are shaped instead (critter-shape)

const WIN = 112;           // window size (logical px); room above the head for the heart / "!" bubble
const INSET = 32;          // window centre sits this far from the wall: the feet end 31 px below centre
const TURN = 40;           // virtual path length spent rotating in place at a corner
const SPEED = 0.9;         // px per tick (16 ms)
const GRAVITY = 0.55;      // px per tick², free fall
const STICK = 40;          // released this close to a wall / the ceiling -> grab on instead of falling
const RIDE = 43;           // rider's centre above the carrier's centre (feet on its head)
const KINDS = ['red', 'pink'];
const SPEEDS = { walk: SPEED, chase: 2.0, flee: 1.7, carry: 0.5, run: 1.7, haul: 1.2, fetch: 1.2, hold: 0.6 };
const HOLD_GAP = 78;      // centre to centre while holding hands: body half-width 25 + a reach of 14, each side
// idle: short walks between rests, so they spend well under half the time walking
const RESTS = [['look', 2000, 4000], ['sit', 5000, 12000], ['stretch', 2400, 2400], ['doze', 6000, 12000]];
const WORKING = ['type', 'rally', 'run', 'haul', 'fetch', 'brew', 'eat'];   // modes that belong to the work routine

const C = {};              // kind -> per-critter state, see fresh()
let active = [], getPet = () => null, onMenu = () => {}, waiting = false;
let SC = 1;                // size multiplier from the settings; every length above scales with it
let roam = true;           // off: they stay where they are (drag them anywhere) and only react to Claude Code
let sleeping = false, meetCooldown = 0, chaseCooldown = Date.now() + 40000;
let holdAfterMeet = false, holdLead = null;   // hand in hand: the one in front leads, the other keeps HOLD_GAP behind
// Claude Code working: one Clawd types, the other (if out) helps: cheers it on, fetches coffee, and hauls a
// code block to a pile next to it for every step Claude Code finishes. The pile sparkles away when it's done.
let working = false, queue = 0, coffeeNext = 0;
const pile = { s: 0, count: 0, win: null, flashUntil: 0, side: 1, eatStart: 0 };
const PILE_MAX = 6;        // two rows; then the pink one eats the lot so it never stands in the way
const EAT_MS = 3000;       // gulp the blocks one by one, chew, burp
// angel wings (Settings > Accessory): a gentle throw is caught and it flutters down; thrown hard it still tumbles
// and gets dizzy, losing a couple of feathers. Now and then one flies over to another spot on the edge
let wings = [];           // which kinds wear them
const GLIDE_MAX = 14;     // release speed (px per tick) below which the wings catch it

const rand = (a, b) => a + Math.random() * (b - a);
let fakeCursor = null;     // debug: a scripted cursor, so drags can be tested without moving the real mouse
const cursor = () => fakeCursor || screen.getCursorScreenPoint();
const other = (k) => (k === 'red' ? 'pink' : 'red');

function room() {
  const wa = screen.getPrimaryDisplay().workArea;
  const I = INSET * SC, x0 = wa.x + I, x1 = wa.x + wa.width - I, y0 = wa.y + I, y1 = wa.y + wa.height - I;
  const w = x1 - x0, h = y1 - y0;
  const segs = [
    ['floor', w, (t) => [x0 + t * w, y1], 0],             // facing right
    ['turn', TURN, () => [x1, y1], 0, -90],
    ['right', h, (t) => [x1, y1 - t * h], -90],           // going up
    ['turn', TURN, () => [x1, y0], -90, -180],
    ['ceil', w, (t) => [x1 - t * w, y0], -180],           // upside down, going left
    ['turn', TURN, () => [x0, y0], -180, -270],
    ['left', h, (t) => [x0, y0 + t * h], -270],           // going down
    ['turn', TURN, () => [x0, y1], -270, -360],
  ];
  return { segs, P: 2 * (w + h) + 4 * TURN, x0, x1, y0, y1, w, h };
}

// perimeter position s -> centre point, angle (degrees) of the "feet towards the wall" frame, and which edge
function at(s) {
  const { segs, P } = room();
  s = ((s % P) + P) % P;
  for (const seg of segs) {
    if (s <= seg[1]) {
      const t = seg[1] ? s / seg[1] : 0;
      const [x, y] = seg[2](t);
      return { x, y, angle: seg[0] === 'turn' ? seg[3] + (seg[4] - seg[3]) * t : seg[3], edge: seg[0], floor: seg[0] === 'floor' };
    }
    s -= seg[1];
  }
  return { x: 0, y: 0, angle: 0, edge: 'floor', floor: true };
}

// the inverse, for a point on a given edge
function sOn(edge, x, y) {
  const { x0, x1, y0, y1, w, h } = room();
  const cx = Math.min(x1, Math.max(x0, x)), cy = Math.min(y1, Math.max(y0, y));
  if (edge === 'floor') return cx - x0;
  if (edge === 'right') return w + TURN + (y1 - cy);
  if (edge === 'ceil') return w + TURN + h + TURN + (x1 - cx);
  return 2 * w + h + 3 * TURN + (cy - y0);
}

function create(kind) {
  const w = new BrowserWindow({
    icon: path.join(__dirname, 'assets', 'icon.png'),
    width: Math.round(WIN * SC), height: Math.round(WIN * SC), transparent: true, frame: false, resizable: false, hasShadow: false,
    // The Clawds must be focusable: Chromium answers a click on a window that can never be activated with "don't
    // activate, and eat the press" (WM_MOUSEACTIVATE -> MA_NOACTIVATEANDEAT), so on Windows a real mouse press never
    // reached the page and they couldn't be picked up (a synthesized click doesn't trigger that, so tests passed).
    // They're shown without taking focus; only clicking one gives it focus, as with Claude-chan herself.
    alwaysOnTop: true, skipTaskbar: true, type: 'toolbar', focusable: kind !== 'blocks', backgroundColor: '#00000000', show: false,
    // transparent windows can count as occluded to Chromium and stop compositing unless throttling is off
    webPreferences: { preload: path.join(__dirname, 'critter-preload.js'), backgroundThrottling: false },
  });
  w.showInactive();
  w.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // the pile never takes the mouse; on Linux the Clawds take it inside their shape, elsewhere per pixel
  if (kind === 'blocks') w.setIgnoreMouseEvents(true);
  else if (!LINUX) w.setIgnoreMouseEvents(true, { forward: true });
  w.loadFile('critter.html', { query: { kind } });
  return w;
}

const fresh = (k, P) => ({
  s: k === 'red' ? P * 0.12 : P * 0.6, dir: k === 'red' ? 1 : -1, mode: 'walk', until: 0,
  nextPause: Date.now() + rand(5000, 12000), waveCooldown: 0,
  free: null,                            // { x, y, vx, vy, a, from } while held or falling
  press: null, drag: false, grab: null, trail: [],
  pokes: [], rideOn: null, stackAfterMeet: false, afterLand: null,
  goal: null,                            // { s, then } walk along the edge to s, then call then()
  after: null,                           // called when the current timed mode ends
  mugUntil: 0,                           // a coffee is sitting next to its laptop
  flight: null,                          // { a, b, ctrl, s, t0, dur } flying over to perimeter position s
  flyNext: Date.now() + rand(60000, 180000), featherAt: 0,
});

function setMode(k, mode, ms) { C[k].mode = mode; C[k].until = Date.now() + ms; }
const busy = (st) => st.free || st.press || st.rideOn || st.flight;
// signed shortest distance along the perimeter from a to b
function along(a, b) { const { P } = room(); let d = (((b - a) % P) + P) % P; if (d > P / 2) d -= P; return d; }

function centre(k) {
  const st = C[k];
  if (st.free) return { x: st.free.x, y: st.free.y, angle: st.free.a, edge: 'free', floor: false };
  if (st.flight) {                       // along a curve, upright in the air, turning to the wall it lands on
    const fl = st.flight, r = Math.min(1, (Date.now() - fl.t0) / fl.dur), t = r * r * (3 - 2 * r), u = 1 - t;
    const turn = (a, b, x) => a + (((((b - a) % 360) + 540) % 360) - 180) * Math.max(0, Math.min(1, x));
    const angle = r < 0.5 ? turn(fl.a.angle, 0, r / 0.2) : turn(0, fl.b.angle, (r - 0.75) / 0.25);
    return { x: u * u * fl.a.x + 2 * u * t * fl.ctrl.x + t * t * fl.b.x, y: u * u * fl.a.y + 2 * u * t * fl.ctrl.y + t * t * fl.b.y,
      angle, edge: 'free', floor: false };
  }
  if (st.rideOn) {
    const c = at(C[st.rideOn].s), r = (c.angle * Math.PI) / 180;
    return { ...c, x: c.x + Math.sin(r) * RIDE * SC, y: c.y - Math.cos(r) * RIDE * SC, floor: false };
  }
  return at(st.s);
}

// ---- off the perimeter: held, then let go ----
function release(k) {
  const st = C[k], f = st.free, { x0, x1, y0 } = room();
  st.drag = false; st.press = null;
  if (st.win && !st.win.isDestroyed()) { if (!LINUX) st.win.setIgnoreMouseEvents(true, { forward: true }); st.win.webContents.send('reset-hit'); }
  const n = st.trail.length - 1;
  f.vx = n > 0 ? Math.max(-25, Math.min(25, (st.trail[n].x - st.trail[0].x) / n)) : 0;
  f.vy = n > 0 ? Math.max(-25, Math.min(25, (st.trail[n].y - st.trail[0].y) / n)) : 0;
  st.trail = [];
  // let go gently next to a wall or the ceiling -> it grabs on there
  const slow = Math.hypot(f.vx, f.vy) < 6;
  if (slow && f.y - y0 < STICK * SC) return land(k, 'ceil');
  if (slow && f.x - x0 < STICK * SC) return land(k, 'left');
  if (slow && x1 - f.x < STICK * SC) return land(k, 'right');
  f.from = f.y;
  if (wings.includes(k) && Math.hypot(f.vx, f.vy) < GLIDE_MAX) { f.glide = true; return setMode(k, 'glide', 1e12); }
  setMode(k, 'fall', 1e12);
}

function land(k, edge) {
  const st = C[k], f = st.free, drop = f.y - (f.from ?? f.y);
  st.s = sOn(edge, f.x, f.y);
  st.free = null;
  if (edge === 'floor' && f.glide) setMode(k, 'hop', 800);           // fluttered down: lands on its feet
  else if (edge === 'floor') {
    setMode(k, 'land', 280); st.afterLand = drop > 160 ? 'dizzy' : null;
    if (wings.includes(k) && (drop > 160 || f.crash)) st.featherAt = Date.now();   // a hard landing costs feathers
  }
  else setMode(k, 'look', 900);
}

function physics(k) {
  const st = C[k], f = st.free, { x0, x1, y1 } = room();
  if (st.drag) {
    const c = cursor();
    const nx = c.x + st.grab.x, ny = c.y + st.grab.y, vx = nx - f.x;
    st.trail.push({ x: nx, y: ny }); if (st.trail.length > 4) st.trail.shift();
    f.x = nx; f.y = ny;
    f.a += (Math.max(-40, Math.min(40, -vx * 3)) - f.a) * 0.2;   // dangles against the motion
    return;
  }
  if (f.glide) { f.vy = Math.min(f.vy + GRAVITY * SC * 0.2, 4.5 * SC); f.vx *= 0.96; }   // flapping: a slow float
  else { f.vy += GRAVITY * SC; f.vx *= 0.99; }
  f.x += f.vx; f.y += f.vy;
  if (f.x < x0 || f.x > x1) { if (!f.glide && Math.abs(f.vx) > 6) f.crash = true; f.vx = -f.vx * 0.4; }   // into a wall
  f.x = Math.min(x1, Math.max(x0, f.x));
  f.a = ((f.a + 540) % 360) - 180;       // tumble back upright on the way down
  f.a += (0 - f.a) * 0.1;
  if (f.y >= y1) { f.y = y1; land(k, 'floor'); }
}

// ---- the two of them ----
function startRide(rider) {
  const carrier = other(rider);
  C[rider].rideOn = carrier;
  setMode(rider, 'ride', rand(5000, 8000));
  setMode(carrier, 'carry', C[rider].until - Date.now());
  if (C[rider].win && !C[rider].win.isDestroyed()) C[rider].win.moveTop();
}

// walk off hand in hand, side by side, both facing the same way
function startHold() {
  if (active.length < 2) return;
  const dir = Math.random() < 0.5 ? 1 : -1, R = C.red, K = C.pink;
  holdLead = along(R.s, K.s) * dir > 0 ? 'pink' : 'red';          // whoever is already in front
  R.dir = K.dir = dir;
  C[other(holdLead)].s = C[holdLead].s - dir * HOLD_GAP * SC;
  const ms = rand(4500, 7000);
  setMode('red', 'hold', ms); setMode('pink', 'hold', ms);
  meetCooldown = Date.now() + 30000;
}

function dismount(k) {
  const st = C[k], c = C[st.rideOn];
  st.s = c.s - c.dir * 50; st.dir = c.dir; st.rideOn = null;
  if (c.mode === 'carry') setMode(other(k), 'walk', 0);
  setMode(k, 'hop', 900);
}

function pairs(now, P) {
  if (active.length < 2 || waiting || sleeping || !roam || working) return;
  const R = C.red, K = C.pink;
  if (busy(R) || busy(K)) return;
  const d = (((K.s - R.s) % P) + P) % P, gap = Math.min(d, P - d);
  const ahead = d < P / 2 ? 1 : -1;      // which way pink is from red along the perimeter

  if ((R.mode === 'chase' || K.mode === 'chase') && gap < 36) {     // caught
    R.dir = ahead; K.dir = -ahead;
    setMode('red', 'meet', 2400); setMode('pink', 'meet', 2400);
    meetCooldown = now + 20000;
    return;
  }
  // meeting: stop, face each other, a heart; sometimes one climbs on the other's head afterwards
  if (R.mode === 'walk' && K.mode === 'walk' && now > meetCooldown && gap < 64) {
    R.dir = ahead; K.dir = -ahead;
    setMode('red', 'meet', 2600); setMode('pink', 'meet', 2600);
    meetCooldown = now + 30000;
    const r = Math.random();
    if (r < 0.35) holdAfterMeet = true;
    else if (r < 0.7) C[Math.random() < 0.5 ? 'red' : 'pink'].stackAfterMeet = true;
    return;
  }
  // now and then one starts chasing the other when they're fairly close
  if (R.mode === 'walk' && K.mode === 'walk' && now > chaseCooldown && gap > 120 && gap < 520 && Math.random() < 1 / 300) {
    const chaser = Math.random() < 0.5 ? 'red' : 'pink';
    const towards = chaser === 'red' ? ahead : -ahead;
    C.red.dir = towards; C.pink.dir = towards;             // same direction: one runs, the other follows
    setMode(chaser, 'chase', 9000); setMode(other(chaser), 'flee', 9000);
    chaseCooldown = now + rand(80000, 140000);
  }
}

// ---- the work routine ----
const worker = () => (active.includes('red') ? 'red' : active[0]);
const helper = () => (active.length === 2 ? other(worker()) : null);
const resting = (m) => m === 'walk' || RESTS.some((x) => x[0] === m);

function startWork() {
  working = true; queue = 0; coffeeNext = Date.now() + rand(15000, 30000);
  const w = C[worker()];
  if (w) { pile.side = Math.random() < 0.5 ? 1 : -1; pile.s = w.s + pile.side * 110 * SC; pile.count = 0; pile.flashUntil = 0; pile.eatStart = 0; }
}
function stopWork(done) {
  working = false; queue = 0; pile.eatStart = 0;
  pile.flashUntil = done && pile.count ? Date.now() + 1400 : 0;   // a finished pile sparkles, then goes
  if (!done) pile.count = 0;
  active.forEach((k) => { const st = C[k]; st.goal = null; st.after = null; if (WORKING.includes(st.mode)) setMode(k, 'walk', 0); });
}

// the helper's next errand
function nextErrand(now) {
  const h = helper(), w = worker(), H = C[h], Wk = C[w];
  const beside = (off) => Wk.s - pile.side * off * SC;            // on the other side from the pile
  if (!roam) { H.dir = along(H.s, Wk.s) > 0 ? 1 : -1; return setMode(h, 'rally', rand(4000, 7000)); }
  if (now > coffeeNext) {                                        // off to make a coffee, and back with it
    coffeeNext = now + rand(70000, 140000);
    setMode(h, 'run', 1e12);
    H.goal = { s: beside(260), then: () => {
      setMode(h, 'brew', 1800);
      H.after = () => { setMode(h, 'fetch', 1e12); H.goal = { s: beside(34), then: () => { Wk.mugUntil = Date.now() + 40000; setMode(h, 'hop', 800); } }; };
    } };
    return;
  }
  if (queue > 0) {                                               // pick up a block at the laptop, carry it to the pile
    setMode(h, 'run', 1e12);
    H.goal = { s: Wk.s + pile.side * 30 * SC, then: () => {
      setMode(h, 'haul', 1e12);
      H.goal = { s: pile.s - pile.side * 18 * SC, then: () => {
        queue = Math.max(0, queue - 1); pile.count = Math.min(PILE_MAX, pile.count + 1);
        if (pile.count < PILE_MAX) return setMode(h, 'hop', 700);
        // the pile is full: a step back, turn to it, and eat it in one go
        setMode(h, 'run', 1e12);
        H.goal = { s: pile.s - pile.side * 40 * SC, then: () => {
          H.dir = pile.side; setMode(h, 'eat', EAT_MS); pile.eatStart = Date.now();
          H.after = () => { pile.count = 0; pile.eatStart = 0; setMode(h, 'hop', 700); };
        } };
      } };
    } };
    return;
  }
  // otherwise: stand next to it and cheer
  setMode(h, 'run', 1e12);
  H.goal = { s: beside(38), then: () => { H.dir = along(H.s, Wk.s) > 0 ? 1 : -1; setMode(h, 'rally', rand(4000, 7000)); } };
}

function workTick(now) {
  const w = worker(), h = helper(), Wk = C[w];
  if (!busy(Wk) && !waiting && !sleeping && resting(Wk.mode)) setMode(w, 'type', 1e12);
  // nobody to carry the blocks (one Clawd, or not roaming): they land on the pile by themselves
  if ((!h || !roam) && queue > 0 && now >= pile.flashUntil) {
    pile.count = Math.min(PILE_MAX, pile.count + queue); queue = 0;
    if (pile.count >= PILE_MAX) pile.flashUntil = now + 1400;   // nobody to eat it: a full pile sparkles away
  }
  // an interrupted meal (an approval came up, it was picked up...) still clears the pile
  if (pile.eatStart && !(h && C[h].mode === 'eat')) { pile.count = 0; pile.eatStart = 0; }
  if (!h) return;
  const H = C[h];
  if (busy(H) || waiting || sleeping || H.goal) return;
  if (resting(H.mode)) nextErrand(now);
}

function tick() {
  if (!active.length) return;
  const now = Date.now(), { P } = room();
  // away from the computer -> they doze where they stand; back -> they wake with a hop
  const idle = powerMonitor.getSystemIdleTime();
  if (!sleeping && idle > 300 && !waiting && !working) {   // while Claude Code works they keep at it
    sleeping = true;
    active.forEach((k) => { if (C[k].rideOn) dismount(k); });
    active.forEach((k) => { if (!C[k].free) setMode(k, 'sleep', 1e12); });
  }
  if (sleeping && idle < 3) { sleeping = false; active.forEach((k) => { if (!C[k].free) setMode(k, 'hop', 900); }); }

  for (const k of active) {
    const st = C[k];
    if (st.free) { physics(k); continue; }
    if (st.press) {                      // pressed: becomes a drag once the cursor has moved a few px
      const c = cursor();
      if (Math.hypot(c.x - st.press.x, c.y - st.press.y) > 5) {
        const p = centre(k);
        if (st.rideOn) { setMode(st.rideOn, 'walk', 0); st.rideOn = null; }
        if (C[other(k)] && C[other(k)].rideOn === k) dismount(other(k));
        st.free = { x: p.x, y: p.y, vx: 0, vy: 0, a: p.angle };
        st.grab = { x: p.x - st.press.x, y: p.y - st.press.y };
        st.drag = true; st.trail = []; st.goal = null; st.after = null; st.flight = null;
        setMode(k, 'held', 1e12);
        continue;
      }
    }
    if (st.flight) {                      // flying over; it lands and looks around
      if (now - st.flight.t0 >= st.flight.dur) { st.s = st.flight.s; st.flight = null; setMode(k, 'look', 900); }
      continue;
    }
    if (waiting && st.mode !== 'wait') {   // Claude Code needs approval: stop, hand up
      if (st.rideOn) dismount(k);
      st.goal = null; st.after = null;      // errands start over afterwards
      setMode(k, 'wait', 1e12);
    }
    if (st.mode !== 'walk' && now > st.until) {
      const was = st.mode;
      if (was === 'ride') { dismount(k); continue; }
      if (was === 'slip') {                // lost its grip on the ceiling
        const p = at(st.s);
        st.free = { x: p.x, y: p.y, vx: 0, vy: 0.5, a: p.angle, from: p.y };
        setMode(k, 'fall', 1e12);
        continue;
      }
      if (was === 'land' && st.afterLand) { setMode(k, st.afterLand, 2000); st.afterLand = null; continue; }
      if (st.after) { const f = st.after; st.after = null; f(); continue; }
      if (was === 'meet' && holdAfterMeet) { holdAfterMeet = false; startHold(); continue; }
      if (was === 'hold') { if (k !== holdLead) st.dir = -st.dir; if (k === 'pink') holdLead = null; }   // let go, part ways
      if (was === 'meet' && st.stackAfterMeet) { st.stackAfterMeet = false; startRide(k); continue; }
      if (was === 'meet' && k === 'pink' && !C.pink.rideOn && !(C.red && C.red.rideOn)) st.dir = -st.dir;   // one turns back
      st.mode = 'walk'; st.nextPause = now + rand(2500, 6000);
    }
    if (st.rideOn) continue;              // carried: position comes from the carrier
    if (st.mode === 'hold' && holdLead && k !== holdLead && C[holdLead].mode === 'hold') {   // follows its partner's hand
      st.s = C[holdLead].s - st.dir * HOLD_GAP * SC; continue;
    }
    const speed = roam ? SPEEDS[st.mode] : 0;
    if (speed && st.goal) {                                    // heading somewhere on an errand
      const d = along(st.s, st.goal.s);
      const step = (st.mode === 'run' ? Math.min(5, Math.max(speed, Math.abs(d) / 150)) : speed) * SC;   // far away: hurry
      st.dir = d >= 0 ? 1 : -1;
      if (Math.abs(d) <= step) { st.s = st.goal.s; const f = st.goal.then; st.goal = null; f(); }
      else st.s += st.dir * step;
    } else if (speed) st.s += st.dir * speed * SC;
    if (st.mode === 'walk' && now > st.nextPause) {
      // a short walk, then a rest: look around, sit, stretch or doze; next to the other one, sit together
      const o = C[other(k)];
      if (wings.includes(k) && roam && !working && now > st.flyNext) { st.flyNext = now + rand(150000, 300000); startFlight(k); }
      else if (Math.random() < 0.2) { st.dir = -st.dir; st.nextPause = now + rand(2500, 6000); }
      else if (o && active.includes(other(k)) && !busy(o) && Math.abs(along(st.s, o.s)) < 140 * SC && Math.random() < 0.5) {
        st.dir = along(st.s, o.s) > 0 ? 1 : -1; setMode(k, 'sit', rand(6000, 12000));
      } else {
        const [m, a, b] = RESTS[Math.floor(Math.random() * RESTS.length)];
        setMode(k, m, rand(a, b));
      }
    }
    if (st.mode === 'walk') {
      const pet = getPet(), p = at(st.s);
      if (pet && p.floor && Math.abs(p.x - (pet.x + pet.width / 2)) < 110 && now > st.waveCooldown) {
        st.dir = p.x < pet.x + pet.width / 2 ? 1 : -1;
        setMode(k, 'wave', 2200); st.waveCooldown = now + 45000;
      }
      // upside down on the ceiling, now and then a foot slips (roughly one crossing in four)
      if (roam && p.edge === 'ceil' && now > (st.steady || 0) && Math.random() < 1.3e-4) setMode(k, 'slip', 700);
    }
  }
  if (working) workTick(now);
  pairs(now, P);
  drawPile(now);

  const cur = cursor();
  for (const k of active) {
    const st = C[k];
    if (!st.win || st.win.isDestroyed()) continue;
    const p = centre(k);
    const W = Math.round(WIN * SC);
    st.win.setBounds({ x: Math.round(p.x - W / 2), y: Math.round(p.y - W / 2), width: W, height: W });
    // where the cursor is, in the critter's own frame (+x = the way it faces), for the eyes to follow
    const dx = cur.x - p.x, dy = cur.y - p.y, dist = Math.hypot(dx, dy);
    let look = null;
    if (dist > 1 && dist < 280) {
      const r = (-p.angle * Math.PI) / 180;
      look = { x: ((dx * Math.cos(r) - dy * Math.sin(r)) / dist) * st.dir, y: (dx * Math.sin(r) + dy * Math.cos(r)) / dist, near: dist < 75 };
    }
    if (st.win.webContents.isDestroyed() || st.win.webContents.isCrashed()) continue;   // closing down
    st.win.webContents.send('pose', {
      angle: p.angle, dir: st.dir, mode: st.mode, look, work: working, mug: now < st.mugUntil,
      hand: st.mode === 'hold' ? (k === holdLead ? 'back' : 'front') : null,
      cursor: { x: cur.x - Math.round(p.x - W / 2), y: cur.y - Math.round(p.y - W / 2) },   // in window px, for hit testing
      moving: roam && SPEEDS[st.mode] !== undefined && !st.rideOn, scale: SC,
      wings: wings.includes(k), feather: st.featherAt ? now - st.featherAt : -1,
    });
  }
}

// the pile of code blocks next to the one typing
function drawPile(now) {
  if (!working && now >= pile.flashUntil) pile.count = 0;      // the finished pile is gone once its sparkle ends
  if (working && pile.flashUntil && now >= pile.flashUntil) { pile.count = 0; pile.flashUntil = 0; }
  if (!active.length || !(pile.count > 0 || now < pile.flashUntil)) {
    if (pile.win && !pile.win.isDestroyed() && pile.win.isVisible()) pile.win.hide();
    return;
  }
  if (!pile.win || pile.win.isDestroyed()) pile.win = create('blocks');
  const p = at(pile.s), W = Math.round(WIN * SC);
  pile.win.setBounds({ x: Math.round(p.x - W / 2), y: Math.round(p.y - W / 2), width: W, height: W });
  if (!pile.win.isVisible()) pile.win.showInactive();
  pile.win.webContents.send('pose', { angle: p.angle, dir: 1, mode: 'blocks', count: pile.count, flash: now < pile.flashUntil, scale: SC,
    eat: pile.eatStart ? now - pile.eatStart : -1, side: pile.side });
}

// a flight: from where it is to a spot a fair way along the edge, on an arc bowing towards the middle of the screen
function startFlight(k) {
  const st = C[k], { P, x0, x1, y0, y1 } = room(), a = centre(k);
  const s = st.s + (Math.random() < 0.5 ? -1 : 1) * rand(0.12, 0.3) * P, b = at(s);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const ctrl = { x: mx + ((x0 + x1) / 2 - mx) * 0.5, y: my + ((y0 + y1) / 2 - my) * 0.5 - 120 * SC };
  st.flight = { a, b, ctrl, s, t0: Date.now(), dur: Math.min(5000, Math.max(1800, Math.hypot(b.x - a.x, b.y - a.y) * 2.4)) };
  st.dir = b.x >= a.x ? 1 : -1; st.goal = null; st.after = null;
  setMode(k, 'fly', 1e12);
}

function setWings(list) { wings = Array.isArray(list) ? list : []; }
function setScale(v) { SC = v; }
function setRoam(on) {
  roam = on;
  if (!on) active.forEach((k) => { if (['chase', 'flee', 'slip'].includes(C[k].mode)) setMode(k, 'walk', 0); });
}

// kinds: [] (another outfit is on), ['red'], ['pink'] or ['red', 'pink']
function show(kinds) {
  const { P } = room();
  for (const k of KINDS) {
    const want = kinds.includes(k);
    if (want && !C[k]) C[k] = fresh(k, P);
    if (want && (!C[k].win || C[k].win.isDestroyed())) C[k].win = create(k);
    if (!want && C[k] && C[k].win && !C[k].win.isDestroyed()) { C[k].win.destroy(); C[k].win = null; }
  }
  // nobody rides on, or carries, a critter that just left
  for (const k of KINDS) {
    if (!C[k]) continue;
    if (C[k].rideOn && !kinds.includes(C[k].rideOn)) C[k].rideOn = null;
    if (['ride', 'carry'].includes(C[k].mode)) C[k].mode = 'walk';
  }
  active = KINDS.filter((k) => kinds.includes(k));
  if (!active.length && pile.win && !pile.win.isDestroyed()) { pile.win.destroy(); pile.win = null; }
}

let onApprove = () => {};
function init({ pet, menu, approve }) {
  getPet = pet; onMenu = menu; onApprove = approve || onApprove;
  const kindOf = (e) => active.find((x) => C[x].win && !C[x].win.isDestroyed() && C[x].win.webContents === e.sender);
  ipcMain.on('critter-hit', (e, over) => {
    const k = kindOf(e);
    if (LINUX || (k && (C[k].press || C[k].drag))) return;   // keep the mouse while it's held
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.setIgnoreMouseEvents(!over, { forward: true });
  });
  ipcMain.on('critter-down', (e) => {
    const k = kindOf(e);
    if (!k || C[k].free) return;
    C[k].press = cursor();
    C[k].win.setIgnoreMouseEvents(false);
  });
  ipcMain.on('critter-up', (e) => {
    const k = kindOf(e);
    if (!k) return;
    const st = C[k];
    if (st.drag) return release(k);
    if (!st.press) return;
    st.press = null;
    // a click: hop; poked four times within a few seconds -> cross;
    // while it raises its hand for approval, a double-click approves the request (once)
    const now = Date.now();
    if (waiting && now - (st.lastClick || 0) < 450) { st.lastClick = 0; st.pokes = []; onApprove(); return; }
    st.lastClick = now;
    st.pokes = st.pokes.filter((t) => now - t < 4000).concat(now);
    if (st.pokes.length >= 4) { st.pokes = []; if (st.rideOn) dismount(k); setMode(k, 'angry', 2600); }
    else if (!waiting && st.mode !== 'angry' && !st.rideOn) setMode(k, 'hop', 900);
  });
  ipcMain.on('critter-shape', (e, rects) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (LINUX && w && !w.isDestroyed()) w.setShape(rects);
  });
  ipcMain.on('critter-menu', (e) => onMenu(BrowserWindow.fromWebContents(e.sender)));
  setInterval(tick, 16);
}

// Claude Code status: the work routine while it works, hands up while it waits for approval, a cheer when it's done
function status(s) {
  if (s === 'work' && !working && active.length) startWork();
  else if (s !== 'work' && s !== 'wait' && working) stopWork(s === 'done');
  const wasWaiting = waiting;
  waiting = s === 'wait';
  if (waiting) sleeping = false;
  if (wasWaiting && !waiting) active.forEach((k) => { if (C[k].mode === 'wait') setMode(k, 'hop', 900); });   // answered: a little hop
  if (s === 'done') active.forEach((k) => { if (!busy(C[k])) setMode(k, 'cheer', 1000); });
}

// Claude Code finished a step (a tool call): one more block for the pile
function pulse() { if (working) queue = Math.min(6, queue + 1); }

// debug: capture a critter window's own pixels (screen capture can miss layered windows / the lock screen)
const shot = (k) => { const w = k === 'blocks' ? pile.win : C[k] && C[k].win; return w && !w.isDestroyed() ? w.webContents.capturePage() : Promise.resolve(null); };
// debug: force a pose / event on all of them
function debugMode(mode, ms = 6000) {
  const { y0 } = room();
  if (mode === 'ride') { if (active.length === 2) startRide('pink'); return; }
  if (mode === 'hold') { startHold(); return; }
  if (mode === 'fly') { active.forEach((k) => { if (!busy(C[k])) startFlight(k); }); return; }
  if (mode === 'chase') { if (active.length === 2) { setMode('red', 'chase', ms); setMode('pink', 'flee', ms); } return; }
  active.forEach((k) => {
    if (mode === 'drop') { const p = centre(k); C[k].rideOn = null; C[k].free = { x: p.x, y: y0 + 250, vx: 0, vy: 0, a: 170, from: y0 + 250 }; setMode(k, 'fall', 1e12); }
    else if (mode === 'slip') { const { w, h } = room(); C[k].s = w + TURN + h + TURN + w * (k === 'red' ? 0.3 : 0.6); setMode(k, 'slip', 700); }
    else { setMode(k, mode, ms); if (mode === 'walk') C[k].nextPause = C[k].steady = Date.now() + ms; }   // walk: no rests, no slips for ms
  });
}
// debug: press on a critter, drag it along pts (one point per tick), let go
function debugDrag(k, pts) {
  if (!C[k]) return;
  const p = centre(k);
  fakeCursor = { x: Math.round(p.x), y: Math.round(p.y) };
  C[k].press = { ...fakeCursor };
  let i = 0;
  const t = setInterval(() => {
    if (i < pts.length) { fakeCursor = pts[i++]; return; }
    clearInterval(t);
    if (C[k].drag) release(k); else C[k].press = null;
    fakeCursor = null;
  }, 16);
}
// debug: put a Clawd on the floor at a fraction of the screen width
function debugPlace(k, where) {
  if (!C[k]) return;
  const { x0, y0, w, h } = room();
  // where: 0.4 | edge:0.4 | edge:0.4:dir   (dir 1 = counter-clockwise, -1 = clockwise)
  const parts = String(where).split(':');
  const [edge, v, d] = parts.length > 1 ? parts : ['floor', parts[0]], t = Number(v);
  if (d) C[k].dir = Number(d) < 0 ? -1 : 1;
  const x = x0 + w * t, y = y0 + h * t;
  C[k].free = null; C[k].rideOn = null; C[k].goal = null; C[k].s = sOn(edge, x, y); setMode(k, 'walk', 0);
}
const debugState = () => active.map((k) => ({ kind: k, mode: C[k].mode, dir: C[k].dir, free: C[k].free, rideOn: C[k].rideOn, pos: centre(k), press: C[k].press, drag: C[k].drag, pile: pile.count, queue, roam, working }));

module.exports = { debugPlace, init, show, setScale, setRoam, setWings, status, pulse, shot, debugState, debugMode, debugDrag };
