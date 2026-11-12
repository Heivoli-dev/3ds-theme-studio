'use strict';
// © heivoli-network.fr
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  buildTheme: (t) => ipcRenderer.invoke('theme:build', t),
  measureTheme: (t) => ipcRenderer.invoke('theme:measure', t),
  saveTheme: () => ipcRenderer.invoke('theme:save'),
  fetchImage: (url) => ipcRenderer.invoke('image:fetch', url),
  startQr: (ip) => ipcRenderer.invoke('qr:start', ip),
  stopQr: () => ipcRenderer.invoke('qr:stop'),
  saveProject: (json) => ipcRenderer.invoke('project:save', json),
  openProject: () => ipcRenderer.invoke('project:open'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  openUpdate: (url) => ipcRenderer.invoke('update:open', url),
  appVersion: () => ipcRenderer.invoke('app:version'),
  onUpdate: (cb) => ipcRenderer.on('update:available', (_e, d) => cb(d)),
  onDownloaded: (cb) => ipcRenderer.on('qr:downloaded', (_e, d) => cb(d)),
});
