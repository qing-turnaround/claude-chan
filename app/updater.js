// Updates from GitHub Releases. It only checks; nothing is downloaded until the user clicks Update in Settings.
// On Windows and in the AppImage that downloads the new version (only the blocks that changed) and restarts into
// it; macOS (not signed by Apple, so it can't replace itself) and the .deb open the download page instead.
const { app, shell, Notification } = require('electron');
const fs = require('fs');
const path = require('path');

const RELEASES = 'https://github.com/qing-turnaround/claude-chan/releases/latest';
const canInstall = process.platform === 'win32' || !!process.env.APPIMAGE;
let updater = null, state = { status: 'idle' }, onChange = () => {}, text = () => ({}), openSettings = () => {};
let told = null;               // the version we've already put up a notification for

// a small log in the user data folder (updater.log), for when an update doesn't go through
function logger() {
  const file = path.join(app.getPath('userData'), 'updater.log');
  try { if (fs.statSync(file).size > 200000) fs.rmSync(file); } catch {}
  const write = (level) => (...a) => { try { fs.appendFileSync(file, `${new Date().toISOString()} ${level} ${a.join(' ')}\n`); } catch {} };
  return { info: write('info'), warn: write('warn'), error: write('error'), debug: () => {} };
}

function set(s) { state = { ...state, ...s }; onChange(); }

// changed: called whenever the state moves on; text: the current language's strings; open: shows Settings
function init({ changed, text: t, open }) {
  onChange = changed; text = t; openSettings = open;
  const feed = process.env.PET_UPDATE_FEED;            // tests: a local folder served over http instead of GitHub
  if (!app.isPackaged && !feed) return;                 // a dev run has nothing to update
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.logger = logger();
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  if (feed) { updater.setFeedURL({ provider: 'generic', url: feed }); updater.forceDevUpdateConfig = !app.isPackaged; }
  updater.on('checking-for-update', () => set({ status: 'checking' }));
  updater.on('update-not-available', () => set({ status: 'latest' }));
  updater.on('update-available', (i) => {
    set({ status: 'available', version: i.version });
    if (told === i.version || !Notification.isSupported()) return;
    told = i.version;                                   // once per version, not on every check
    const n = new Notification({ title: text().upAvailableTitle.replace('{v}', i.version), body: text().upAvailableBody, silent: true });
    n.on('click', () => (canInstall ? openSettings() : shell.openExternal(RELEASES)));
    n.show();
  });
  updater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.floor(p.percent) }));
  // the user asked for it: restart into the new version as soon as it's here
  updater.on('update-downloaded', () => { set({ status: 'installing' }); setImmediate(() => updater.quitAndInstall(true, true)); });
  updater.on('error', () => set({ status: 'error' }));   // offline, GitHub unreachable...: just try again later
  setTimeout(check, 15000);
  setInterval(check, 6 * 3600 * 1000);
}

function check() {
  if (!updater || ['checking', 'downloading', 'installing'].includes(state.status)) return;
  updater.checkForUpdates().catch(() => set({ status: 'error' }));
}

// the Settings button: update now (or open the download page), otherwise check again
function act() {
  updater && updater.logger.info(`act: ${state.status}`);
  if (state.status !== 'available') return check();
  if (!canInstall) return shell.openExternal(RELEASES);
  set({ status: 'downloading', percent: 0 });
  updater.downloadUpdate().catch(() => set({ status: 'error' }));
}

module.exports = { init, check, act, state: () => ({ ...state, enabled: !!updater, canInstall }) };
