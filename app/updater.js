// Updates from GitHub Releases. On Windows and in the AppImage the new version downloads in the background (only
// the blocks that changed) and installs on restart; macOS (not signed by Apple, so it can't replace itself) and the
// .deb just say a new version is out and open the download page.
const { app, shell, Notification } = require('electron');
const fs = require('fs');
const path = require('path');

const RELEASES = 'https://github.com/qing-turnaround/claude-chan/releases/latest';
const canInstall = process.platform === 'win32' || !!process.env.APPIMAGE;
let updater = null, state = { status: 'idle' }, onChange = () => {}, text = () => ({});

// a small log in the user data folder (updater.log), for when an update doesn't go through
function logger() {
  const file = path.join(app.getPath('userData'), 'updater.log');
  try { if (fs.statSync(file).size > 200000) fs.rmSync(file); } catch {}
  const write = (level) => (...a) => { try { fs.appendFileSync(file, `${new Date().toISOString()} ${level} ${a.join(' ')}\n`); } catch {} };
  return { info: write('info'), warn: write('warn'), error: write('error'), debug: () => {} };
}

function set(s) { state = { ...state, ...s }; onChange(); }

function notify(title, body, click) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: true });
  n.on('click', click);
  n.show();
}

// changed: called whenever the state moves on; text: the current language's strings
function init({ changed, text: t }) {
  onChange = changed; text = t;
  const feed = process.env.PET_UPDATE_FEED;            // tests: a local folder served over http instead of GitHub
  if (!app.isPackaged && !feed) return;                 // a dev run has nothing to update
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.logger = logger();
  updater.autoDownload = canInstall;
  updater.autoInstallOnAppQuit = canInstall;            // quitting with an update downloaded installs it
  if (feed) { updater.setFeedURL({ provider: 'generic', url: feed }); updater.forceDevUpdateConfig = !app.isPackaged; }
  updater.on('checking-for-update', () => set({ status: 'checking' }));
  updater.on('update-not-available', () => set({ status: 'latest' }));
  updater.on('update-available', (i) => {
    set({ status: canInstall ? 'downloading' : 'available', version: i.version, percent: 0 });
    if (!canInstall) notify(text().upAvailableTitle.replace('{v}', i.version), text().upAvailableBody, () => shell.openExternal(RELEASES));
  });
  updater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.floor(p.percent) }));
  updater.on('update-downloaded', (i) => {
    set({ status: 'ready', version: i.version });
    notify(text().upReadyTitle.replace('{v}', i.version), text().upReadyBody, act);
  });
  updater.on('error', () => set({ status: 'error' }));   // offline, GitHub unreachable...: just try again later
  setTimeout(check, 15000);
  setInterval(check, 6 * 3600 * 1000);
}

function check() {
  if (!updater || ['checking', 'downloading', 'ready'].includes(state.status)) return;
  updater.checkForUpdates().catch(() => set({ status: 'error' }));
}

// the button / notification: restart into the downloaded version, or open the download page
function act() {
  updater && updater.logger.info(`act: ${state.status}`);
  if (state.status === 'ready') setImmediate(() => updater.quitAndInstall(true, true));
  else if (state.status === 'available') shell.openExternal(RELEASES);
  else check();
}

module.exports = { init, check, act, state: () => ({ ...state, enabled: !!updater }) };
