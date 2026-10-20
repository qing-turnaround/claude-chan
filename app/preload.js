const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  platform: process.platform,
  hit: (over) => ipcRenderer.send('hit', over),
  shape: (rects) => ipcRenderer.send('shape', rects),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  walk: (dir) => ipcRenderer.send('walk', dir),
  menu: () => ipcRenderer.send('menu'),
  settings: () => ipcRenderer.invoke('settings'),
  idleSeconds: () => ipcRenderer.invoke('idle-seconds'),
  cursor: () => ipcRenderer.invoke('cursor'),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, ...a) => fn(...a)),
});
