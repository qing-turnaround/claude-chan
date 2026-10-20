const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('approvals', {
  onView: (fn) => ipcRenderer.on('view', (_e, v) => fn(v)),
  height: (h) => ipcRenderer.send('approvals-height', h),
  decide: (id, choice, extra) => ipcRenderer.send('approvals-decide', id, choice, extra),
});
