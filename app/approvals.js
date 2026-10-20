// Approval cards: Claude Code's PermissionRequest hook is an HTTP request that we hold open until you click
// Allow / Deny on a card next to the pet. If you answer in the terminal instead, Claude Code drops the request
// (or the session moves on) and the card goes away by itself.
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const W = 380;
let win = null, anchor = () => null, strings = () => ({}), onDecided = () => {};
const pending = [];        // { id, session, tool, input, cwd, suggestion, res, t }
let seq = 0;

function reply(entry, decision) {
  const i = pending.indexOf(entry);
  if (i >= 0) pending.splice(i, 1);
  if (!entry.res.writableEnded && !entry.res.destroyed) {
    if (decision) {
      entry.res.writeHead(200, { 'Content-Type': 'application/json' });
      entry.res.end(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } }));
    } else {                                 // no decision: Claude Code falls back to asking in the terminal
      entry.res.writeHead(204); entry.res.end();
    }
  }
  refresh();
}

// what the card shows for a request:
//   kind 'command' (shell), 'file' (name + folder, with removed / added lines for edits),
//   'question' (AskUserQuestion: answered right on the card), 'fields' (anything else, one "key: value" per line)
const clip = (t, n) => { t = String(t ?? ''); return t.length > n ? t.slice(0, n) + '…' : t; };
const lines = (t, n) => String(t ?? '').split(/\r?\n/).slice(0, n).map((l) => clip(l, 200));
function summary(tool, input = {}) {
  if (tool === 'AskUserQuestion' && Array.isArray(input.questions)) {
    return {
      kind: 'question',
      questions: input.questions.map((q) => ({
        header: q.header || '', question: q.question || '', multi: !!q.multiSelect,
        options: (q.options || []).map((o) => ({ label: o.label, description: o.description || '' })),
      })),
    };
  }
  if (tool === 'Bash' || tool === 'PowerShell') return { kind: 'command', main: clip(input.command, 1500), note: input.description || '' };
  if (input.file_path) {
    const diff = [];
    if (tool === 'Edit') { lines(input.old_string, 4).forEach((l) => diff.push(['-', l])); lines(input.new_string, 4).forEach((l) => diff.push(['+', l])); }
    if (tool === 'MultiEdit' && Array.isArray(input.edits)) diff.push(['', `${input.edits.length} edits`]);
    if (tool === 'Write') lines(input.content, 5).forEach((l) => diff.push(['+', l]));
    return { kind: 'file', name: path.basename(input.file_path), dir: path.dirname(input.file_path), diff };
  }
  if (tool === 'ExitPlanMode') return { kind: 'command', main: clip(input.plan, 1500), note: '' };
  return { kind: 'fields', fields: Object.entries(input).slice(0, 8).map(([k, v]) => [k, clip(typeof v === 'string' ? v : JSON.stringify(v), 300)]) };
}

// "Always allow" uses the first rule Claude Code itself suggests, written as Tool(rule)
function ruleText(sug) {
  if (!sug) return '';
  if (sug.type === 'addRules' && sug.rules && sug.rules.length) {
    return sug.rules.map((r) => (r.ruleContent ? `${r.toolName}(${r.ruleContent})` : r.toolName)).join(', ');
  }
  if (sug.type === 'setMode') return sug.mode || '';
  return '';
}

function view() {
  return {
    T: strings(),
    items: pending.map((e) => ({
      id: e.id, tool: e.tool, project: e.cwd ? path.basename(e.cwd) : '', ...summary(e.tool, e.input),
      always: ruleText(e.suggestion),
    })),
  };
}

function place(height) {
  if (!win || win.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea, a = anchor();
  let x, y;
  if (a) {                                   // above the pet, kept on screen
    x = Math.round(a.x + a.width / 2 - W / 2);
    y = Math.round(a.y + a.height * 0.25 - height);
  } else {                                   // Clawd outfit: bottom right, above the floor they walk on
    x = wa.x + wa.width - W - 24;
    y = wa.y + wa.height - height - 90;
  }
  x = Math.max(wa.x + 8, Math.min(wa.x + wa.width - W - 8, x));
  y = Math.max(wa.y + 8, Math.min(wa.y + wa.height - height - 8, y));
  win.setBounds({ x, y, width: W, height: Math.round(height) });
}

function refresh() {
  if (!pending.length) { if (win && !win.isDestroyed()) win.hide(); return; }
  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      icon: path.join(__dirname, 'assets', 'icon.png'),
      width: W, height: 160, transparent: true, frame: false, resizable: false, hasShadow: false,
      alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#00000000',
      webPreferences: { preload: path.join(__dirname, 'approvals-preload.js') },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.loadFile('approvals.html');
    win.webContents.on('did-finish-load', () => { win.webContents.send('view', view()); });
    return;
  }
  win.webContents.send('view', view());
}

function init({ pet, text, decided }) {
  anchor = pet; strings = text; onDecided = decided || onDecided;
  ipcMain.on('approvals-height', (_e, h) => {
    place(h);
    // shown without taking focus, so typing in the terminal isn't interrupted
    if (pending.length && win && !win.isVisible()) win.showInactive();
  });
  ipcMain.on('approvals-decide', (_e, id, choice, extra) => {
    const e = pending.find((x) => x.id === id);
    if (!e) return;
    setTimeout(() => onDecided(e.session), 0);
    if (choice === 'answer') {
      // AskUserQuestion answered on the card: hand the answers back as the tool's input (keyed by question text)
      const qs = e.input.questions || [], answers = {};
      qs.forEach((q, i) => { if (extra && extra[i]) answers[q.question] = extra[i]; });
      reply(e, { behavior: 'allow', updatedInput: { ...e.input, answers } });
    } else if (choice === 'terminal') reply(e, null);
    else if (choice === 'allow') reply(e, { behavior: 'allow' });
    else if (choice === 'always') reply(e, e.suggestion ? { behavior: 'allow', updatedPermissions: [e.suggestion] } : { behavior: 'allow' });
    else reply(e, { behavior: 'deny', message: 'Denied from Claude-chan' });
  });
}

// a PermissionRequest arrived: payload is the hook's JSON, res is held until a decision
function add(payload, res) {
  const entry = {
    id: ++seq, session: payload.session_id, tool: payload.tool_name || '?', input: payload.tool_input || {},
    cwd: payload.cwd, suggestion: (payload.permission_suggestions || [])[0], res, t: Date.now(),
  };
  pending.push(entry);
  // the request went away without our answer (answered in the terminal, Claude Code timed out or was closed)
  res.on('close', () => { if (pending.includes(entry)) { pending.splice(pending.indexOf(entry), 1); refresh(); } });
  refresh();
}

// the session carried on (another hook event): its pending request was answered somewhere else
function sessionMoved(session) {
  pending.filter((e) => e.session === session).forEach((e) => reply(e, null));
}

const count = () => pending.length;
const relayout = () => { if (win && !win.isDestroyed() && win.isVisible()) win.webContents.send('view', view()); };

module.exports = { init, add, sessionMoved, count, relayout };
