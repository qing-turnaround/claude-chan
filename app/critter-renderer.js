// Clawd, drawn in code: a box body, four stick legs, two arm nubs and a face. Local frame: origin at the window
// centre, +y towards the wall (feet), +x = the way it faces. The main process sends the frame angle, direction,
// mode, and where the cursor is (in this frame) for the eyes to follow.
const KIND = new URLSearchParams(location.search).get('kind') || 'red';
const LOOK = {
  red:  { body: '#D2693F', shade: '#B9542E' },
  pink: { body: '#F2B4CC', shade: '#DE97B4' },
};
const INK = '#2B2220';
const ACCENT = '#D97757';

const cv = document.getElementById('c');
const dpr = window.devicePixelRatio || 1;
const SIZE = 112;          // drawing units; the window is SIZE * scale px
let SC = 0;
function fit(sc) {
  SC = sc;
  const px = Math.round(SIZE * sc);
  cv.width = Math.round(px * dpr); cv.height = Math.round(px * dpr); cv.style.width = px + 'px'; cv.style.height = px + 'px';
}
fit(1);
const g = cv.getContext('2d', { willReadFrequently: true });

let pose = { angle: 0, dir: 1, mode: 'walk', moving: true, look: null, work: false };
let walkPhase = 0, hopT = -1, heartT = -1, lastMode = 'walk', lookFlip = 1, lookNext = 0;
let eyeX = 0, eyeY = 0, blinkUntil = 0, nextBlink = performance.now() + 3000, modeSince = performance.now();
window.critter.onPose((p) => {
  if (p.mode !== lastMode) {
    if (p.mode === 'hop' || p.mode === 'cheer') hopT = 0;
    if (p.mode === 'meet') heartT = 0;
    lastMode = p.mode; modeSince = performance.now();
  }
  pose = p;
  if (p.scale && p.scale !== SC) fit(p.scale);
});

// hand-drawn line boil: every 3rd frame the vertices shift by a fraction of a pixel (seeded, repeatable)
let boil = 0, frame = 0;
const j = (k) => Math.sin(boil * 12.9898 + k * 78.233) * 0.55;

function poly(pts, fill, k0) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, x + j(k0 + i), y + j(k0 + i + 31)));
  g.closePath();
  g.fillStyle = fill; g.fill();
  g.lineWidth = 2.2; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
}
const line = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };

// ---- faces ----
// which eyes / mouth / extras go with each mode
function faceFor(m, now) {
  switch (m) {
    case 'sleep': return { eyes: 'shut', mouth: 'small' };
    case 'wait': return { eyes: 'round', mouth: 'o' };
    case 'cheer': return { eyes: 'star', mouth: 'grin' };
    case 'hop': case 'wave': case 'chase': return { eyes: 'happy', mouth: 'grin' };
    case 'meet': case 'ride': case 'hold': return { eyes: 'happy', mouth: 'smile', blush: true };
    case 'carry': return { eyes: 'shut', mouth: 'flat', sweat: true };
    case 'held': case 'slip': case 'fall': case 'land': return { eyes: 'xx', mouth: 'o' };
    case 'flee': return { eyes: 'xx', mouth: 'grin' };
    case 'dizzy': return { eyes: 'spiral', mouth: 'wavy' };
    case 'angry': return { eyes: 'open', brows: 'angry', mouth: 'pout', mark: true };
    case 'type': return { eyes: 'happy', mouth: 'smile', down: true };     // looking down at the keyboard
    case 'rally': return { eyes: 'happy', mouth: 'grin' };
    case 'stretch': return { eyes: 'shut', mouth: 'o' };
    case 'doze': return { eyes: 'shut', mouth: 'small' };
  }
  if (pose.look && pose.look.near) return { eyes: 'happy', mouth: 'smile', blush: true };   // cursor right next to it
  return { eyes: 'happy', mouth: 'smile' };                 // the default is the smiley ^ ^ face, working or not
}

// ---- props ----
const ORANGE = '#D97757', CREAM = '#FFF4E6';

// a code block: an orange tile with a bracket on it (carried on the head, and piled up)
function block(x, y, k, alpha = 1) {
  g.save(); g.globalAlpha = alpha;
  g.beginPath(); g.roundRect(x - 9, y - 7, 18, 14, 3); g.fillStyle = ORANGE; g.fill();
  g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = CREAM; g.font = '700 8px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(['{ }', '</>', '( )', '[ ]'][k % 4], x, y + 0.5);
  g.restore();
}

function mug(x, y, steam) {
  g.save(); g.translate(x, y);
  g.lineWidth = 1.6; g.strokeStyle = INK;
  g.beginPath(); g.arc(6, 0, 3, -Math.PI / 2, Math.PI / 2); g.stroke();                 // handle
  g.beginPath(); g.roundRect(-5, -5, 11, 11, [1, 1, 3, 3]); g.fillStyle = '#FFFFFF'; g.fill(); g.stroke();
  g.fillStyle = '#7A4A2E'; g.fillRect(-4, -4, 9, 2.5);                                    // coffee
  if (steam) {
    const t = performance.now() / 400;
    g.strokeStyle = '#B9AFA6'; g.lineWidth = 1.2; g.globalAlpha = 0.8;
    [-2, 2].forEach((sx, i) => {
      g.beginPath(); g.moveTo(sx, -7);
      g.bezierCurveTo(sx + Math.sin(t + i) * 2, -10, sx - Math.sin(t + i) * 2, -13, sx + Math.sin(t + i) * 1.5, -16);
      g.stroke();
    });
  }
  g.restore();
}

// the laptop, seen from behind its lid, sitting in front of the lower body
function laptop(L, now) {
  g.save();
  g.beginPath(); g.roundRect(-12, 11, 24, 13, 2); g.fillStyle = '#5B5552'; g.fill();
  g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#FFFFFF'; g.globalAlpha = 0.9;                                           // the asterisk logo
  g.translate(0, 17.5);
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); g.fillRect(-0.6, -3, 1.2, 6); }
  g.restore();
  g.beginPath(); g.roundRect(-15, 23, 30, 3.5, 1.5); g.fillStyle = '#3E3936'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
  // two little hands on the keys, tapping out of step
  [-8, 8].forEach((x, i) => {
    const up = Math.max(0, Math.sin(now / 65 + i * 2.2)) * 2.5;
    g.beginPath(); g.roundRect(x - 3.5, 20 - up, 7, 5, 2); g.fillStyle = L.body; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
  });
}

function star(cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = '#F6C445'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
}

function drawFace(f, now) {
  g.lineWidth = 2.2; g.strokeStyle = INK; g.fillStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  // eyes follow the cursor a little
  const tx = f.down ? 0 : pose.look ? pose.look.x * 2.6 : 0, ty = f.down ? 2.5 : pose.look ? pose.look.y * 1.8 : 0;
  eyeX += (tx - eyeX) * 0.2; eyeY += (ty - eyeY) * 0.2;
  if (now > nextBlink) { blinkUntil = now + 120; nextBlink = now + 2500 + Math.random() * 3500; }
  const blink = now < blinkUntil;

  [-10, 10].forEach((x, k) => {
    const y = -2;
    g.lineWidth = 2.2; g.strokeStyle = INK; g.fillStyle = INK;
    switch (f.eyes) {
      case 'open':
        if (blink) line([[x - 4, y + 1], [x + 4, y + 1]]);
        else { g.beginPath(); g.roundRect(x - 2.2 + eyeX, y - 4.5 + eyeY, 4.4, 9, 2.2); g.fill(); }
        break;
      case 'dot': g.beginPath(); g.arc(x + eyeX * 0.5, y + 1, 2.1, 0, Math.PI * 2); g.fill(); break;
      case 'round':
        g.beginPath(); g.arc(x, y, 4.6, 0, Math.PI * 2); g.fillStyle = '#FFFAF2'; g.fill(); g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(x + eyeX * 0.6, y + eyeY * 0.6, 2.2, 0, Math.PI * 2); g.fill();
        break;
      case 'happy': { const ex = x + eyeX * 0.6, ey = y + eyeY * 0.5; line([[ex - 5, ey + 2.5 + j(80 + k)], [ex, ey - 2.5], [ex + 5, ey + 2.5 + j(82 + k)]]); break; }
      case 'shut': line([[x - 5, y + 1 + j(80 + k)], [x + 5, y + 1 + j(82 + k)]]); break;
      case 'star': star(x, y, 5.6); break;
      case 'xx': {                                     // > <
        const s = k ? -1 : 1;
        line([[x - 4 * s, y - 3.5], [x + 3 * s, y], [x - 4 * s, y + 3.5]]);
        break;
      }
      case 'spiral': {
        g.beginPath();
        const turn = (now / 140) * (k ? -1 : 1);
        for (let t = 0; t < 12; t++) { const a = turn + t * 0.75, r = 0.5 + t * 0.42; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        g.lineWidth = 1.6; g.stroke();
        break;
      }
    }
  });
  g.lineWidth = 2.2; g.strokeStyle = INK;
  if (f.brows === 'angry') { line([[-15, -10], [-6, -7]]); line([[15, -10], [6, -7]]); }

  switch (f.mouth) {
    case 'smile': g.beginPath(); g.arc(0, 3.5, 3.6, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); break;
    case 'small': g.beginPath(); g.arc(0, 4, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); break;
    case 'grin':
      g.beginPath(); g.moveTo(-5, 4); g.quadraticCurveTo(0, 12, 5, 4); g.closePath();
      g.fillStyle = '#7A2E2A'; g.fill(); g.stroke();
      break;
    case 'o': g.beginPath(); g.ellipse(0, 6, 2.6, 3.2, 0, 0, Math.PI * 2); g.fillStyle = '#7A2E2A'; g.fill(); g.stroke(); break;
    case 'flat': line([[-3, 6], [3, 6]]); break;
    case 'pout': line([[-4, 7], [0, 5], [4, 7]]); break;
    case 'wavy': line([[-5, 6], [-2.5, 4.5], [0, 6], [2.5, 4.5], [5, 6]]); break;
  }
  if (f.blush) {
    g.fillStyle = '#E2556F'; g.globalAlpha = 0.35;
    [-18, 18].forEach((x) => { g.beginPath(); g.ellipse(x, 5, 4.5, 2.6, 0, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
  }
  if (f.sweat) {
    g.beginPath(); g.moveTo(21, -13); g.quadraticCurveTo(25, -6, 21, -4); g.quadraticCurveTo(17, -6, 21, -13);
    g.fillStyle = '#8CC8F0'; g.fill(); g.lineWidth = 1.4; g.stroke();
  }
}

function draw() {
  frame++;
  if (frame % 3 === 0) boil++;
  const L = LOOK[KIND], now = performance.now(), m = pose.mode;
  const moving = pose.moving, flailing = m === 'held' || m === 'slip' || m === 'fall';
  if (moving) walkPhase += m === 'chase' || m === 'flee' ? 0.6 : 0.32;
  if (flailing) walkPhase += 0.9;
  // looking around while paused: turn the head (whole body) left/right now and then
  if (m === 'look' && now > lookNext) { lookFlip = -lookFlip; lookNext = now + 700; }
  if (m !== 'look') lookFlip = 1;

  g.setTransform(dpr * SC, 0, 0, dpr * SC, 0, 0);
  g.clearRect(0, 0, SIZE, SIZE);
  g.translate(SIZE / 2, SIZE / 2);
  g.rotate((pose.angle * Math.PI) / 180);
  g.scale(pose.dir * lookFlip, 1);
  // for overlays that should read upright on screen: undo the mirror and the wall rotation at an anchor point
  const upright = (x, y) => { g.translate(x, y); g.scale(pose.dir * lookFlip, 1); g.rotate((-pose.angle * Math.PI) / 180); };

  // hop: up away from the wall and back (a cheer keeps hopping until the mode ends)
  let lift = 0;
  if (hopT >= 0) {
    hopT += 1 / 26;
    lift = Math.sin(Math.min(1, hopT) * Math.PI) * (m === 'cheer' ? 22 : 16);
    if (hopT >= 1) hopT = m === 'cheer' ? 0 : -1;
  }
  const busyHere = !moving && pose.work && (m === 'walk' || m === 'look');   // not roaming: bounce in place while it works
  if (busyHere) walkPhase += 0.25;
  const bob = moving || busyHere ? Math.abs(Math.sin(walkPhase)) * (busyHere ? 2 : 1.2) : 0;
  g.translate(0, -lift - bob);
  if (m === 'angry') g.translate(Math.sin(now / 28) * 1.3, 0);              // trembling
  if (m === 'slip') g.translate(Math.sin(now / 25) * 1.5, 0);
  if (m === 'dizzy') { g.translate(0, 31); g.rotate(Math.sin(now / 160) * 0.12); g.translate(0, -31); }
  if (m === 'land') {                                                        // squash on the feet, then back
    const t = Math.min(1, (now - modeSince) / 280), q = Math.sin(t * Math.PI) * 0.22;
    g.translate(0, 31); g.scale(1 + q, 1 - q); g.translate(0, -31);
  }

  // sitting (resting, or at the laptop): the body drops onto folded legs
  const sit = m === 'sit' || m === 'type' ? 6 : 0;
  // legs (behind the body): pairs 0/2 and 1/3 alternate; kicking while held / falling
  [-16, -6, 6, 16].forEach((x, i) => {
    const ph = walkPhase + (i % 2) * Math.PI;
    let up = moving ? Math.max(0, Math.sin(ph)) * 3.5 : 0;
    let swing = moving ? Math.cos(ph) * 1.6 : 0;
    if (flailing) { up = Math.max(0, Math.sin(ph + i)) * 4; swing = Math.cos(ph + i) * 3; }
    poly([[x - 3.3, 18 + sit], [x + 3.3, 18 + sit], [x + 3.3 + swing, 31 - up + lift * 0.4], [x - 3.3 + swing, 31 - up + lift * 0.4]], L.body, 10 + i * 5);
  });
  if (m === 'stretch') { const t = Math.sin(Math.min(1, (now - modeSince) / 2400) * Math.PI); g.translate(0, 19); g.scale(1 - t * 0.04, 1 + t * 0.1); g.translate(0, -19); }
  g.translate(0, sit);

  // arms: nubs on both sides; waving / cheering / being held raise them
  const wave = m === 'wave' ? Math.sin(now / 110) * 0.7 - 0.9 : 0;
  const holding = m === 'haul' || m === 'fetch';
  const cheer = hopT >= 0 || m === 'meet' || m === 'ride' || holding ? -1.1
    : flailing ? -1.3 + Math.sin(now / 60) * 0.35
    : m === 'stretch' ? -1.35
    : m === 'angry' ? 0.6 : 0;
  const arm = (side, extra) => {
    g.save();
    g.translate(side * 25, 0);
    g.rotate(side * (0.35 + extra));
    poly([[0, -5], [side * 9, -7], [side * 10, 3], [0, 5]], L.body, 60 + (side > 0 ? 7 : 0));
    g.restore();
  };
  if (m === 'type') {
    // arms reach forward to the keyboard: the hands are drawn on the laptop
  } else if (m === 'hold') {
    // one arm straight out towards the partner, at hand height; the other hangs as usual
    const reach = pose.hand === 'front' ? 1 : -1;
    arm(-reach, 0);
    g.save(); g.translate(reach * 24, 4);
    poly([[0, -4], [reach * 15, -3], [reach * 15, 4], [0, 4]], L.body, 68);
    g.restore();
  } else if (m === 'rally') {               // waving a little flag
    arm(-1, 0);
    const a = -1.0 + Math.sin(now / 130) * 0.45;
    g.save(); g.translate(25, 0); g.rotate(0.35 + a);
    poly([[0, -5], [9, -7], [10, 3], [0, 5]], L.body, 67);
    g.lineWidth = 1.8; g.strokeStyle = INK; g.beginPath(); g.moveTo(10, -2); g.lineTo(27, -4); g.stroke();
    g.beginPath(); g.moveTo(27, -4); g.lineTo(23, -15); g.lineTo(18, -3); g.closePath(); g.fillStyle = ORANGE; g.fill(); g.stroke();
    g.restore();
  } else {
    arm(-1, cheer);
    if (m !== 'wait') arm(1, wave || cheer);
  }

  // body
  poly([[-25, -14], [25, -14], [25, 19], [-25, 19]], L.body, 40);
  g.fillStyle = L.shade; g.globalAlpha = 0.35; g.fillRect(-23, 12, 46, 6); g.globalAlpha = 1;

  // waiting for approval: a long arm held straight up in front of the body, swaying a little
  if (m === 'wait') {
    g.save(); g.translate(20, -8); g.rotate(0.25 + Math.sin(now / 260) * 0.12);
    poly([[-4, 2], [-4, -22], [4, -22], [4, 2]], L.body, 66);
    g.restore();
  }

  const face = faceFor(m, now);
  drawFace(face, now);

  if (m === 'type') laptop(L, now);
  if (pose.mug && m === 'type') mug(30, 20, true);
  if (m === 'brew') mug(31, 6, true);

  // accessories
  if (KIND === 'pink') {
    // yellow flower on the left of the head
    g.save(); g.translate(-10, -17);
    g.lineWidth = 1.3; g.strokeStyle = INK;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      g.beginPath(); g.ellipse(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 3.6, 2.6, a, 0, Math.PI * 2);
      g.fillStyle = '#F6C445'; g.fill(); g.stroke();
    }
    g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2); g.fillStyle = '#E8892B'; g.fill(); g.stroke();
    g.restore();
  }

  // carried on the head (drawn over the flower)
  if (m === 'haul') block(0, -23 - Math.abs(Math.sin(walkPhase)) * 1.5, 1);
  if (m === 'fetch') mug(0, -21 - Math.abs(Math.sin(walkPhase)) * 1.5, true);

  // waiting for approval: the same "!" bubble Claude-chan uses, beside the raised hand
  if (m === 'wait') {
    g.save(); upright(-6, -34 + Math.sin(now / 300) * 1.5);
    g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fillStyle = '#FFFAF2'; g.fill();
    g.lineWidth = 2; g.strokeStyle = ACCENT; g.stroke();
    g.fillStyle = ACCENT; g.font = '900 13px "Segoe UI"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 0.5);
    g.restore();
  }
  // cross: an anger mark by the head
  if (face.mark) {
    g.save(); upright(19, -24);
    const s = 1 + Math.sin(now / 120) * 0.12; g.scale(s, s);
    g.strokeStyle = '#E2453C'; g.lineWidth = 2.4; g.lineCap = 'round';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
      g.beginPath(); g.moveTo(a * 2, b * 6); g.quadraticCurveTo(a * 2, b * 2, a * 6, b * 2); g.stroke();
    });
    g.restore();
  }
  // typing: a little </> floats up now and then
  if (m === 'type') {
    const p = ((now - modeSince) / 1700) % 1;
    if (p < 0.7) {
      g.save(); upright(14 + p * 6, -24 - p * 22);
      g.globalAlpha = Math.sin((p / 0.7) * Math.PI); g.fillStyle = ORANGE;
      g.font = '800 10px Consolas, monospace'; g.textAlign = 'center';
      g.fillText(['</>', '{ }', '( )'][Math.floor((now - modeSince) / 1700) % 3], 0, 0);
      g.restore();
    }
  }
  if (m === 'doze') {
    const p = (now / 2200) % 1;
    g.save(); upright(10 + p * 4, -20 - p * 10);
    g.fillStyle = INK; g.globalAlpha = Math.sin(p * Math.PI) * 0.7; g.font = '700 9px "Segoe UI"'; g.textAlign = 'center';
    g.fillText('z', 0, 0); g.restore();
  }
  // asleep: a slow drift of z's off the head
  if (m === 'sleep') {
    const t = now / 1000;
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.5 + i * 0.5) % 1;
      g.save(); upright(8 + p * 8 + i * 5, -20 - p * 18);   // drift away from the wall, glyph upright
      g.fillStyle = INK; g.textAlign = 'center'; g.globalAlpha = Math.sin(p * Math.PI) * 0.8;
      g.font = `700 ${9 + i * 3}px "Segoe UI"`;
      g.fillText('z', 0, 0);
      g.restore();
    }
  }
  // dizzy: little stars circling the head
  if (m === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const a = now / 300 + (i * Math.PI * 2) / 3;
      g.save(); g.translate(Math.cos(a) * 16, -22 + Math.sin(a) * 4);
      star(0, 0, 3.6); g.restore();
    }
  }
  // heart above the head when they meet
  if (heartT >= 0) {
    heartT += 1 / 50;
    g.save();
    upright(0, -32 - heartT * 10);           // upright on screen even on the walls and ceiling
    g.globalAlpha = Math.max(0, 1 - heartT);
    g.fillStyle = '#E2556F'; g.font = '16px "Segoe UI Symbol"'; g.textAlign = 'center';
    g.fillText('❤', 0, 0);
    g.restore();
    if (heartT >= 1) heartT = -1;
  }
}
let shown = 0, dropT = 0;
function drawBlocks() {
  const now = performance.now();
  g.setTransform(dpr * SC, 0, 0, dpr * SC, 0, 0);
  g.clearRect(0, 0, SIZE, SIZE);
  g.translate(SIZE / 2, SIZE / 2);
  g.rotate((pose.angle * Math.PI) / 180);
  const n = pose.count || 0;
  if (n > shown) dropT = now;                 // a new one lands with a little bounce
  shown = n;
  const fade = pose.flash ? Math.max(0, 1 - (now - flashStart) / 1400) : 1;
  // rows of 3 / 3 / 3 / 3 from the wall outward, each row nudged sideways
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    let y = 24 - row * 14, x = (col - 1) * 19 + (row % 2 ? 5 : 0);
    if (i === n - 1 && now - dropT < 300) y -= Math.sin(((now - dropT) / 300) * Math.PI) * 6;
    block(x, y, i, fade);
  }
  if (pose.flash) {                           // done: sparkles over the pile
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + now / 300, rr = 14 + ((now - flashStart) / 1400) * 26;
      g.save(); g.globalAlpha = fade; star(Math.cos(a) * rr, 10 - Math.sin(a) * rr * 0.8, 4); g.restore();
    }
  }
}
let flashStart = 0;
window.critter.onPose((p) => { if (KIND === 'blocks' && p.flash && !flashStart) flashStart = performance.now(); if (!p.flash) flashStart = 0; });

// a timer rather than requestAnimationFrame: Chromium pauses rAF for windows it thinks are occluded (tiny
// unfocusable topmost windows sometimes qualify), which froze the walk cycle
setInterval(KIND === 'blocks' ? drawBlocks : draw, 16);

// clicks only count on the creature's own pixels; the rest of the window passes through.
// Checked every frame against where the main process says the cursor is, not only on mouse moves: they walk,
// and a window that kept "the mouse is on me" after walking away would steal clicks meant for the other one.
let overLast = false;
function checkHit(x, y) {
  if (KIND === 'blocks') return;
  const inside = x >= 0 && y >= 0 && x < cv.clientWidth && y < cv.clientHeight;
  const over = inside && g.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data[3] > 40;
  if (over !== overLast) { overLast = over; window.critter.hit(over); }
}
window.addEventListener('mousemove', (e) => checkHit(e.clientX, e.clientY));
setInterval(() => { if (pose.cursor) checkHit(pose.cursor.x, pose.cursor.y); }, 50);
window.critter.onResetHit(() => { overLast = false; });
// press and release go to the main process: it tells a click (hop) from a drag (pick up)
window.addEventListener('mousedown', (e) => { if (e.button === 0 && overLast) window.critter.down(); });
window.addEventListener('mouseup', (e) => { if (e.button === 0) window.critter.up(); });
// right-click opens the same menu as Claude-chan's (she is hidden while this outfit is on)
window.addEventListener('contextmenu', (e) => { e.preventDefault(); if (overLast) window.critter.menu(); });

// Linux: shape the window to a padded box around the drawn pixels (no click-through forwarding there)
if (window.critter.platform === 'linux' && KIND !== 'blocks') {
  let last = '';
  setInterval(() => {
    const W = cv.width, H = cv.height, d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return;
    const k = 1 / dpr, pad = 8, px = cv.clientWidth, py = cv.clientHeight;
    const r = { x: Math.max(0, Math.floor(x0 * k - pad)), y: Math.max(0, Math.floor(y0 * k - pad)) };
    r.width = Math.min(px, Math.ceil(x1 * k + pad)) - r.x; r.height = Math.min(py, Math.ceil(y1 * k + pad)) - r.y;
    const key = [r.x, r.y, r.width, r.height].join();
    if (key !== last) { last = key; window.critter.shape([r]); }
  }, 100);
}
