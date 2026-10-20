const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('critter', {
  onPose: (fn) => ipcRenderer.on('pose', (_e, p) => fn(p)),
  onResetHit: (fn) => ipcRenderer.on('reset-hit', () => fn()),
  hit: (over) => ipcRenderer.send('critter-hit', over),
  down: () => ipcRenderer.send('critter-down'),
  up: () => ipcRenderer.send('critter-up'),
  menu: () => ipcRenderer.send('critter-menu'),
  platform: process.platform,
  shape: (rects) => ipcRenderer.send('critter-shape', rects),
});
