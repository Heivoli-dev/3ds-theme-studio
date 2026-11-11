'use strict';
// © heivoli-network.fr
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  buildTheme: (t) => ipcRenderer.invoke('theme:build', t),
  saveTheme: () => ipcRenderer.invoke('theme:save'),
  startQr: (ip) => ipcRenderer.invoke('qr:start', ip),
  stopQr: () => ipcRenderer.invoke('qr:stop'),
  saveProject: (json) => ipcRenderer.invoke('project:save', json),
  openProject: () => ipcRenderer.invoke('project:open'),
  onDownloaded: (cb) => ipcRenderer.on('qr:downloaded', (_e, d) => cb(d)),
});
