const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  state: () => ipcRenderer.invoke('settings-state'),
  set: (key, value) => ipcRenderer.send('settings-set', key, value),
  height: (h) => ipcRenderer.send('settings-height', h),
  onChanged: (fn) => ipcRenderer.on('changed', (_e, st) => fn(st)),
});
