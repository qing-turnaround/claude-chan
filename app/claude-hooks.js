// Claude Code integration: install / remove hooks in ~/.claude/settings.json, and merge events from all sessions into one status.
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 47823;
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
// Use the system curl to forward the hook's stdin to the pet as-is: no Node dependency; || true keeps it from erroring when the pet isn't running.
const CMD = `curl -s -m 1 --noproxy "*" -X POST --data-binary @- http://127.0.0.1:${PORT}/hook || true`;
const MARK = `127.0.0.1:${PORT}/hook`;
// Permission requests use an HTTP hook: the pet holds the request open until you click Allow / Deny on its card.
// If the pet isn't running the connection fails, which Claude Code treats as "no decision" and asks in the terminal.
const PERM_URL = `http://127.0.0.1:${PORT}/permission`;
const PERM_HOOK = { type: 'http', url: PERM_URL, timeout: 600 };
const LEGACY = 'claude-pet/app/hook.js';       // early hand-installed node version; removed together on uninstall
const EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'StopFailure', 'SessionEnd'];
const WITH_MATCHER = new Set(['PreToolUse', 'PostToolUse', 'PermissionRequest']);

const ours = (h) => (typeof h.command === 'string' && (h.command.includes(MARK) || h.command.includes(LEGACY))) || h.url === PERM_URL;
const hookFor = (ev) => (ev === 'PermissionRequest' ? PERM_HOOK : { type: 'command', command: CMD, timeout: 3 });

function read() {
  if (!fs.existsSync(SETTINGS)) return {};
  return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));   // throw on parse failure; never overwrite the user's file
}
function write(d) {
  const bak = SETTINGS + '.claude-chan.bak';
  if (fs.existsSync(SETTINGS) && !fs.existsSync(bak)) fs.copyFileSync(SETTINGS, bak);
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(d, null, 2));
}

function isInstalled() {
  try {
    const hooks = read().hooks || {};
    return EVENTS.every(ev => (hooks[ev] || []).some(e => (e.hooks || []).some(ours)));
  } catch { return false; }
}

// installed by an older version (different command, or no approval card): reinstall on start
function isCurrent() {
  try {
    const hooks = read().hooks || {};
    return EVENTS.every(ev => (hooks[ev] || []).some(e => (e.hooks || []).some(h => JSON.stringify(h) === JSON.stringify(hookFor(ev)))));
  } catch { return true; }
}

function strip(d) {
  for (const ev of Object.keys(d.hooks || {})) {
    d.hooks[ev] = d.hooks[ev]
      .map(e => ({ ...e, hooks: (e.hooks || []).filter(h => !ours(h)) }))
      .filter(e => e.hooks.length);
    if (!d.hooks[ev].length) delete d.hooks[ev];
  }
}

function install() {
  const d = read();
  d.hooks = d.hooks || {};
  strip(d);
  for (const ev of EVENTS) {
    const entry = { hooks: [hookFor(ev)] };
    (d.hooks[ev] = d.hooks[ev] || []).push(WITH_MATCHER.has(ev) ? { matcher: '*', ...entry } : entry);
  }
  write(d);
}

function uninstall() {
  const d = read();
  strip(d);
  if (d.hooks && !Object.keys(d.hooks).length) delete d.hooks;
  write(d);
}

// ---------- Multi-session merge: any one waiting on you -> raise hand; any working -> typing; last one finished -> cheer ----------
// session_id -> { state: 'work' | 'wait' | 'done', t, since, cwd, tool, prompt }
const sessions = new Map();
// "working" means some session did something in the last minute; an interrupted or idle session drops out
const STALE = { work: 60e3, wait: 30 * 60e3, done: 60 * 60e3 };

function aggregate() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.t > STALE[s.state]) sessions.delete(id);
  const states = [...sessions.values()].map(s => s.state);
  return states.includes('wait') ? 'wait' : states.includes('work') ? 'work' : 'idle';
}

// Recording/demo aid: when set, only events from sessions under this directory count
let focusCwd = null;
function setFocus(dir) { focusCwd = dir ? path.resolve(dir).toLowerCase() : null; sessions.clear(); }

function touch(id, state, payload) {
  const now = Date.now(), old = sessions.get(id) || { since: now };
  const s = { ...old, t: now, cwd: payload.cwd || old.cwd };
  if (s.state !== state) s.since = now;
  s.state = state;
  if (payload.tool_name) s.tool = payload.tool_name;
  if (payload.prompt) { s.prompt = String(payload.prompt).slice(0, 200); s.tool = null; }
  sessions.set(id, s);
}

// Returns the status to push to the UI
function onEvent(payload) {
  const ev = payload.hook_event_name, id = payload.session_id || 'default';
  if (focusCwd && !path.resolve(payload.cwd || '').toLowerCase().startsWith(focusCwd)) return null;
  if (['UserPromptSubmit', 'PreToolUse', 'PostToolUse'].includes(ev)) touch(id, 'work', payload);
  else if (ev === 'PermissionRequest') touch(id, 'wait', payload);
  else if (ev === 'Stop' || ev === 'StopFailure') {
    const was = sessions.get(id)?.state;
    touch(id, 'done', payload);
    const a = aggregate();
    return a === 'idle' && was !== 'done' && ev === 'Stop' ? 'done' : a;
  } else if (ev === 'SessionEnd') sessions.delete(id);
  else return null;
  return aggregate();
}

// answered on the approval card: the session goes back to work
function resolved(id) {
  const s = sessions.get(id);
  if (s && s.state === 'wait') { s.state = 'work'; s.since = s.t = Date.now(); }
  return aggregate();
}

// debug: every session, newest first
const list = () => (aggregate(), [...sessions].map(([id, s]) => ({ id, ...s })).sort((a, b) => b.t - a.t));

module.exports = { install, uninstall, isInstalled, isCurrent, onEvent, aggregate, list, resolved, setFocus, SETTINGS };
