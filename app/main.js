const { app, BrowserWindow, Menu, ipcMain, screen, powerMonitor, dialog } = require('electron');
const claude = require('./claude-hooks');
const i18n = require('./i18n');
const critters = require('./critters');
const approvals = require('./approvals');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 47823;
const SIZE_MIN = 0.5, SIZE_MAX = 2;   // size is a free multiplier, set with the slider in Settings
const BASE_W = 300, BASE_H = 320;
const SKINS = ['hoodie', 'scholar', 'maid', 'spirit'];

const settingsFile = path.join(app.getPath('userData'), 'settings.json');
let settings = { size: 1, roam: true, x: null, y: null, skin: 'hoodie', lang: 'auto', clawd: ['red', 'pink'] };
try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile, 'utf8'))); } catch {}
// older versions stored S / M / L
if (typeof settings.size !== 'number') settings.size = { S: 0.75, M: 1, L: 1.35 }[settings.size] || 1;
const save = () => { try { fs.writeFileSync(settingsFile, JSON.stringify(settings)); } catch {} };

let win;
let drag = null;          // { dx, dy, hist: [{x,y,t}] }
let fall = null;          // { vx, vy } parabolic arc after being flung
let walk = null;          // { dir, speed }

const scale = () => Math.min(SIZE_MAX, Math.max(SIZE_MIN, settings.size || 1));
const winSize = () => [Math.round(BASE_W * scale()), Math.round(BASE_H * scale())];

function floorY(x) {
  const d = screen.getDisplayNearestPoint({ x, y: 0 }).workArea;
  return d.y + d.height - winSize()[1];
}
function workAreaAt(x, y) { return screen.getDisplayNearestPoint({ x, y }).workArea; }
// Repeated setPosition on high-DPI makes the window size drift larger, so pin width and height every time
function moveTo(x, y) { const [w, h] = winSize(); win.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h }); }

function createWindow() {
  const [w, h] = winSize();
  const wa = screen.getPrimaryDisplay().workArea;
  let x = settings.x ?? wa.x + wa.width - w - 40;
  let y = settings.y ?? wa.y + wa.height - h;
  win = new BrowserWindow({
    icon: path.join(__dirname, 'assets', 'icon.png'),
    width: w, height: h, x, y,
    transparent: true, frame: false, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: true, backgroundColor: '#00000000', show: settings.skin !== 'clawd',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile('index.html');
  win.webContents.on('did-finish-load', () => win.webContents.send('scale', scale()));
}

// ---------- Mouse click-through: only take over when the click lands on a character pixel ----------
ipcMain.on('hit', (_e, over) => {
  if (process.env.PET_DEBUG) console.log('[hit]', over);
  if (drag) return;
  win.setIgnoreMouseEvents(!over, { forward: true });
});

// ---------- Drag / fling ----------
ipcMain.on('drag-start', () => {
  if (process.env.PET_DEBUG) console.log('[drag-start]');
  const p = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  drag = { dx: p.x - wx, dy: p.y - wy, hist: [] };
  fall = null; walk = null;
  win.setIgnoreMouseEvents(false);
});
ipcMain.on('drag-end', () => {
  if (!drag) return;
  const h = drag.hist, now = Date.now();
  const recent = h.filter(s => now - s.t < 100);
  let vx = 0, vy = 0;
  if (recent.length >= 2) {
    const a = recent[0], b = recent[recent.length - 1], dt = Math.max(1, b.t - a.t);
    vx = (b.x - a.x) / dt * 16; vy = (b.y - a.y) / dt * 16;
  }
  drag = null;
  fall = { vx: clamp(vx, -60, 60), vy: clamp(vy, -60, 60) };
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Walking ----------
ipcMain.on('walk', (_e, dir) => { if (!drag && !fall) walk = dir ? { dir, speed: 2.2 * scale() } : null; });

setInterval(() => {
  if (!win || win.isDestroyed()) return;
  const [w] = winSize();
  if (drag) {
    const p = screen.getCursorScreenPoint();
    const x = p.x - drag.dx, y = p.y - drag.dy;
    moveTo(x, y);
    drag.hist.push({ x, y, t: Date.now() });
    if (drag.hist.length > 20) drag.hist.shift();
    win.webContents.send('drag-move', drag.hist.length >= 2 ? drag.hist.at(-1).x - drag.hist.at(-2).x : 0);
    return;
  }
  if (fall) {
    let [x, y] = win.getPosition();
    fall.vy += 1.6; fall.vx *= 0.99;
    x += fall.vx; y += fall.vy;
    const wa = workAreaAt(x + w / 2, y);
    if (x < wa.x) { x = wa.x; fall.vx = -fall.vx * 0.5; }
    if (x > wa.x + wa.width - w) { x = wa.x + wa.width - w; fall.vx = -fall.vx * 0.5; }
    const fy = floorY(x + w / 2);
    if (y >= fy) {
      y = fy;
      if (Math.abs(fall.vy) > 12) { fall.vy = -fall.vy * 0.35; fall.vx *= 0.6; }
      else { fall = null; win.webContents.send('landed'); settings.x = Math.round(x); settings.y = Math.round(y); save(); }
    }
    moveTo(x, y);
    return;
  }
  if (walk) {
    let [x, y] = win.getPosition();
    const wa = workAreaAt(x + w / 2, y);
    x += walk.dir * walk.speed;
    if (x < wa.x || x > wa.x + wa.width - w) { walk.dir = -walk.dir; win.webContents.send('turn', walk.dir); x = clamp(x, wa.x, wa.x + wa.width - w); }
    moveTo(x, y);
    settings.x = Math.round(x); settings.y = y;
  }
}, 16);

// ---------- Right-click menu ----------
function act(name) { return () => win.webContents.send('action', name); }

// The Clawd outfit hides Claude-chan and lets the two mascots (either or both) carry the Claude Code status
const clawdKinds = () => (settings.clawd && settings.clawd.length ? settings.clawd : ['red', 'pink']);
function applyOutfit() {
  if (settings.skin === 'clawd') { win.hide(); critters.show(clawdKinds()); }
  else { critters.show([]); win.show(); win.webContents.send('skin', settings.skin); }
}
function setStatus(s) { win.webContents.send('status', s); critters.status(s); }

function popupMenu(owner) {
  const T = i18n(settings.lang, app.getLocale());
  const clawd = settings.skin === 'clawd';
  const outfits = SKINS.filter(k => fs.existsSync(path.join(__dirname, 'assets', 'skins', k, 'idle.webp'))).concat('clawd');
  const tpl = [
    { label: T.actions, visible: !clawd, submenu: [
      { label: T.idle, click: act('idle') },
      { label: T.think, click: act('think') },
      { label: T.eat, click: act('eat') },
      { label: T.stretch, click: act('stretch') },
      { label: T.yawn, click: act('yawn') },
      { label: T.wave, click: act('wave') },
      { label: T.sleep, click: act('sleep') },
      { label: T.done, click: act('done') },
      { label: T.walk, click: act('walk') },
    ] },
    { label: T.status, submenu: [
      { label: T.work, click: () => (clawd ? setStatus('work') : act('work')()) },
      { label: T.wait, click: () => (clawd ? setStatus('wait') : act('wait')()) },
      { label: T.finish, click: () => (clawd ? setStatus('done') : act('done')()) },
    ] },
    { label: T.outfit, submenu: [...outfits.map(k => ({
      label: T.skins[k], type: 'radio', checked: settings.skin === k,
      click: () => apply('skin', k),
    })),
    // which Clawds come out; at least one always stays
    ...(clawd ? [{ type: 'separator' }, ...['red', 'pink'].map(c => ({
      label: T.clawd[c], type: 'checkbox', checked: clawdKinds().includes(c),
      click: (m) => apply('clawdKind', { kind: c, on: m.checked }),
    }))] : [])] },
    { label: T.link, type: 'checkbox', checked: claude.isInstalled(), click: (m) => apply('link', m.checked) },
    { type: 'separator' },
    { label: T.roam, type: 'checkbox', checked: settings.roam, click: (m) => apply('roam', m.checked) },
    { label: T.settings, click: openSettings },
    { type: 'separator' },
    { label: T.quit, click: () => app.quit() },
  ];
  Menu.buildFromTemplate(tpl).popup({ window: owner || win });
}
ipcMain.on('menu', () => popupMenu(win));

// ---------- Settings: one place that changes things, used by the menu and the Settings window ----------
function apply(key, v) {
  switch (key) {
    case 'skin': if (SKINS.includes(v) || v === 'clawd') { settings.skin = v; applyOutfit(); } break;
    case 'clawdKind': {
      const next = v.on ? [...new Set([...clawdKinds(), v.kind])] : clawdKinds().filter(x => x !== v.kind);
      if (next.length) settings.clawd = ['red', 'pink'].filter(x => next.includes(x));   // at least one stays
      critters.show(settings.skin === 'clawd' ? clawdKinds() : []);
      break;
    }
    case 'size': settings.size = Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, Number(v) || 1)) * 100) / 100; resize(); break;
    case 'roam': settings.roam = !!v; win.webContents.send('roam', settings.roam); critters.setRoam(settings.roam); break;
    case 'link': toggleHooks(!!v); break;
    case 'login': app.setLoginItemSettings({ ...loginOpts(), openAtLogin: !!v }); break;
    case 'lang': settings.lang = i18n.LANGS.includes(v) ? v : 'auto'; break;
  }
  save();
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('changed', settingsState());
}

function settingsState() {
  const T = i18n(settings.lang, app.getLocale());
  return {
    T, langs: i18n.LANGS.map(k => [k, i18n.NATIVE[k]]),
    outfits: SKINS.filter(k => fs.existsSync(path.join(__dirname, 'assets', 'skins', k, 'idle.webp'))).concat('clawd'),
    skin: settings.skin, clawd: clawdKinds(), size: scale(), sizeMin: SIZE_MIN, sizeMax: SIZE_MAX,
    roam: settings.roam, link: claude.isInstalled(), login: app.getLoginItemSettings(loginOpts()).openAtLogin,
    lang: i18n.LANGS.includes(settings.lang) ? settings.lang : 'auto', version: app.getVersion(),
  };
}

let settingsWin = null;
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    icon: path.join(__dirname, 'assets', 'icon.png'),
    width: 460, height: 720, useContentSize: true, resizable: false, maximizable: false, minimizable: false, show: false,
    title: 'Claude-chan', autoHideMenuBar: true, backgroundColor: '#FAF6EF',
    webPreferences: { preload: path.join(__dirname, 'settings-preload.js') },
  });
  settingsWin.removeMenu();
  settingsWin.loadFile('settings.html');
  settingsWin.once('ready-to-show', () => settingsWin.show());
}
ipcMain.handle('settings-state', () => settingsState());
ipcMain.on('settings-set', (_e, key, v) => apply(key, v));
// the window is exactly as tall as its content
ipcMain.on('settings-height', (_e, h) => { if (settingsWin && !settingsWin.isDestroyed()) settingsWin.setContentSize(460, Math.min(900, Math.ceil(h))); });

// Launch at login is off by default; the user turns it on in the menu. In dev mode execPath is the bare electron.exe, so the app directory must be passed too
function loginOpts() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function toggleHooks(on) {
  try {
    on ? claude.install() : claude.uninstall();
  } catch (e) {
    dialog.showMessageBox(win, { type: 'error', message: `${i18n(settings.lang, app.getLocale()).cantEdit} ${claude.SETTINGS}`, detail: String(e.message || e) });
  }
}

// Push to the UI; push even if the status is unchanged (the UI uses it to extend the "working" timeout)
let lastStatus = 'idle';
function pushStatus(s) {
  if (!s || !win) return;
  if (s === 'idle' && lastStatus === 'idle') return;   // don't interrupt a cheer that's playing
  lastStatus = s === 'done' ? 'idle' : s;
  win.webContents.send('status', s);
  critters.status(s);
}
setInterval(() => { const a = claude.aggregate(); if (a !== lastStatus) pushStatus(a); }, 5e3);

function resize() {
  critters.setScale(scale());
  const [w, h] = winSize();
  const [x, y] = win.getPosition();
  win.setBounds({ x, y: Math.min(y, floorY(x + w / 2)), width: w, height: h });
  win.webContents.send('scale', scale());
}

ipcMain.handle('settings', () => settings);
ipcMain.handle('idle-seconds', () => powerMonitor.getSystemIdleTime());
ipcMain.handle('cursor', () => ({ cursor: screen.getCursorScreenPoint(), bounds: win.getBounds() }));

// ---------- Local endpoint: Claude Code hooks push here ----------
// POST /hook        raw stdin of a Claude Code hook
// POST /permission  PermissionRequest HTTP hook (held until the card is answered)
// POST /state       {"state":"work"|"wait"|"done"|"idle"} for other tools
// Everything else is a test / recording helper and only exists when PET_DEBUG is set.
const PUBLIC = ['/hook', '/permission', '/state'];
http.createServer((req, res) => {
  // Web pages can send requests to 127.0.0.1 too. The public endpoints only take POST, and a browser always
  // puts Origin on a POST; refuse those, and any Host other than ours (DNS rebinding), so a page can't touch
  // the pet, let alone answer an approval card. (Sec-Fetch-* isn't a browser tell: Node's fetch sends it.)
  const h = req.headers;
  if (h.origin || h.referer || !/^(127\.0\.0\.1|localhost):\d+$/.test(h.host || '')
      || (!PUBLIC.includes(req.url) && !process.env.PET_DEBUG)) {
    res.statusCode = 403; return res.end();
  }
  req.setEncoding('utf8');   // decode as a stream, so a character split across two chunks stays whole
  if (req.method === 'POST' && req.url === '/state') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let s = body.trim();
      try { s = JSON.parse(body).state; } catch {}
      if (win && ['work', 'wait', 'done', 'idle'].includes(s)) setStatus(s);
      res.end('ok');
    });
  } else if (process.env.PET_DEBUG && req.method === 'POST' && req.url === '/eval') {   // tests only; off in normal runs
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => win.webContents.executeJavaScript(body).then(r => res.end(JSON.stringify(r ?? null)), e => res.end('ERR ' + e)));
  } else if (req.method === 'POST' && req.url === '/hook') {   // raw stdin of the Claude Code hook
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        // the session moved on: an approval card still open for it was answered in the terminal
        if (['PostToolUse', 'UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd'].includes(payload.hook_event_name)) approvals.sessionMoved(payload.session_id);
        pushStatus(claude.onEvent(payload));
        if (payload.hook_event_name === 'PostToolUse') critters.pulse();   // one more code block for the Clawds' pile
      } catch {}
      res.end('ok');
    });
  } else if (req.method === 'POST' && req.url === '/permission') {   // HTTP hook: held open until Allow / Deny on the card
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch { res.writeHead(204); return res.end(); }
      pushStatus(claude.onEvent(payload));
      approvals.add(payload, res);
    });
  } else if (req.method === 'POST' && ['/focus', '/lang', '/place', '/auto', '/size'].includes(req.url)) {   // debug / screen-recording helpers
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const v = body.trim();
      if (req.url === '/focus') { claude.setFocus(v || null); pushStatus('idle'); }
      if (req.url === '/lang') { settings.lang = v || 'auto'; save(); }
      if (req.url === '/auto') win.webContents.send('auto', v !== '0');
      if (req.url === '/size' && Number(v)) apply('size', v);
      if (req.url === '/place') {          // "fx" = horizontal position as a fraction of the work area, feet on the taskbar
        const wa = screen.getPrimaryDisplay().workArea, [w] = winSize();
        fall = walk = null;
        moveTo(wa.x + (wa.width - w) * Math.min(1, Math.max(0, parseFloat(v) || 0.85)), floorY(wa.x + wa.width / 2));
      }
      res.end('ok');
    });
  } else if (req.method === 'POST' && req.url === '/skin') {   // debug: switch outfit
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const k = body.trim();
      if (SKINS.includes(k) || k === 'clawd') { settings.skin = k; save(); applyOutfit(); }
      res.end('ok');
    });
  } else if (req.method === 'POST' && req.url === '/action') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { win.webContents.send('action', body.trim()); res.end('ok'); });
  } else if (req.url === '/debug') {
    win.webContents.executeJavaScript('JSON.stringify({ang,angV,swingTarget,mode,skin,swinging,cls:body.className,tf:body.style.transform,total:Object.keys(SPRITES).length,missing:Object.keys(SPRITES).filter(n=>!SPRITES[n].ok)})')
      .then(j => res.end(j), e => res.end(String(e)));
  } else if (req.url.startsWith('/critter-shot')) {   // debug
    critters.shot(req.url.split('?')[1] || 'red').then((img) => { res.setHeader('Content-Type', 'image/png'); res.end(img ? img.toPNG() : ''); });
  } else if (req.url.startsWith('/critter-mode')) {   // debug: force a pose for a few seconds
    critters.debugMode(req.url.split('?')[1] || 'sleep'); res.end('ok');
  } else if (req.method === 'POST' && req.url.startsWith('/critter-drag')) {   // debug: body = JSON [[x,y],...]
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { critters.debugDrag(req.url.split('?')[1] || 'red', JSON.parse(body).map(([x, y]) => ({ x, y }))); res.end('ok'); });
  } else if (req.url === '/settings-shot') {   // debug: open Settings and capture it
    openSettings();
    setTimeout(() => settingsWin.webContents.capturePage().then((img) => { res.setHeader('Content-Type', 'image/png'); res.end(img.toPNG()); }), 900);
  } else if (req.url.startsWith('/approvals-click')) {   // debug: press a button on the newest card
    const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('approvals.html'));
    const [cls, idx] = (req.url.split('?')[1] || 'allow').split(':');      // e.g. allow, deny, opt:2
    const sel = cls === 'opt' ? '.opt' : `button.${cls.replace(/[^a-z]/g, '')}`;
    if (w) w.webContents.executeJavaScript(`(() => { const a = [...document.querySelectorAll('${sel}')]; (${idx === undefined ? 'a.pop()' : `a[${Number(idx)}]`})?.click(); })()`);
    res.end('ok');
  } else if (req.url === '/approvals-shot') {   // debug: capture the approval cards
    setTimeout(() => {
      const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('approvals.html'));
      if (!w) return res.end('');
      w.webContents.capturePage().then((img) => { res.setHeader('Content-Type', 'image/png'); res.end(img.toPNG()); });
    }, 900);
  } else if (req.url === '/sessions') {   // debug
    res.end(JSON.stringify(claude.list()));
  } else if (req.url === '/critters') {
    res.end(JSON.stringify(critters.debugState()));
  } else if (req.url === '/shot') {   // debug: capture the window itself (a screen capture can't see a transparent window)
    win.webContents.capturePage().then(img => {
      res.setHeader('Content-Type', 'image/png'); res.end(img.toPNG());
    });
  } else { res.statusCode = 404; res.end(); }
}).listen(PORT, '127.0.0.1').on('error', e => console.error('[pet] port', PORT, e.message));

if (!app.requestSingleInstanceLock()) app.quit();
app.whenReady().then(() => {
  createWindow();
  critters.setScale(scale()); critters.setRoam(settings.roam);
  const text = () => i18n(settings.lang, app.getLocale());
  approvals.init({ pet: () => (win && !win.isDestroyed() && win.isVisible() ? win.getBounds() : null), text, decided: (id) => pushStatus(claude.resolved(id)) });
  // hooks put in by an older version (no approval card, no process id): bring them up to date
  try { if (claude.isInstalled() && !claude.isCurrent()) claude.install(); } catch {}
  critters.init({ pet: () => (win && !win.isDestroyed() && win.isVisible() ? win.getBounds() : null), menu: popupMenu });
  if (settings.skin === 'clawd') applyOutfit();
});
app.on('window-all-closed', () => app.quit());
