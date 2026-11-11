'use strict';
// 3DS Theme Studio — processus principal Electron
// © heivoli-network.fr
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { buildThemeZip, safeFileName } = require('./lib/theme');
const qr = require('./lib/qr');

let win;
let current = null; // { name, zip }
let server = null;
let serverPort = 0;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#ffffff',
    title: '3DS Theme Studio — heivoli-network.fr',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function lanAddresses() {
  const res = [];
  for (const [ifname, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) res.push({ ifname, address: a.address });
    }
  }
  const score = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return res.sort((a, b) => score(a.address) - score(b.address));
}

function startServer() {
  if (server) return Promise.resolve(serverPort);
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || '').split('?')[0]);
      if (current && url === `/theme/${current.name}.zip`) {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': current.zip.length,
          'Content-Disposition': `attachment; filename="${current.name}.zip"`,
          'Cache-Control': 'no-store',
        });
        res.end(current.zip);
        if (win) win.webContents.send('qr:downloaded', { name: current.name, from: req.socket.remoteAddress });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('3DS Theme Studio — heivoli-network.fr');
    });
    const tryListen = (port) => {
      s.once('error', (e) => {
        if (port !== 0) tryListen(0); else reject(e);
      });
      s.listen(port, '0.0.0.0', () => {
        server = s;
        serverPort = s.address().port;
        resolve(serverPort);
      });
    };
    tryListen(8383);
  });
}

function stopServer() {
  if (server) { server.close(); server = null; serverPort = 0; }
}

function toU8(x) { return x ? new Uint8Array(x) : undefined; }

ipcMain.handle('theme:build', (_e, t) => {
  const name = safeFileName(t.title).replace(/ /g, '_');
  const zip = buildThemeZip({
    top: toU8(t.top), bottom: toU8(t.bottom),
    icon48: toU8(t.icon48), icon24: toU8(t.icon24),
    preview: toU8(t.preview), bgm: toU8(t.bgm),
    title: t.title, description: t.description, author: t.author,
  });
  current = { name, zip };
  return { name, size: zip.length };
});

ipcMain.handle('theme:save', async () => {
  if (!current) return { ok: false };
  const r = await dialog.showSaveDialog(win, {
    title: 'Enregistrer le thème',
    defaultPath: `${current.name}.zip`,
    filters: [{ name: 'Thème 3DS (zip)', extensions: ['zip'] }],
  });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, current.zip);
  return { ok: true, path: r.filePath };
});

ipcMain.handle('qr:start', async (_e, preferred) => {
  if (!current) throw new Error('Aucun thème généré');
  const port = await startServer();
  const ips = lanAddresses();
  if (!ips.length) throw new Error("Aucune connexion réseau locale détectée. Connectez l'ordinateur au même Wi-Fi que la 3DS.");
  const ip = (ips.find((i) => i.address === preferred) || ips[0]).address;
  const url = `http://${ip}:${port}/theme/${encodeURIComponent(current.name)}.zip`;
  return { url, svg: qr.toSvg(url), ips, ip };
});

ipcMain.handle('image:fetch', async (_e, url) => {
  // Image glissée ou collée depuis un site web : téléchargée ici, sans passer par le disque
  if (!/^https?:\/\//i.test(String(url))) throw new Error('Adresse invalide');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Image inaccessible (${res.status})`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!type.startsWith('image/')) throw new Error("Ce lien n'est pas une image");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 25 * 1024 * 1024) throw new Error('Image trop lourde (25 Mo max)');
  return `data:${type};base64,${buf.toString('base64')}`;
});

ipcMain.handle('qr:stop', () => { stopServer(); return true; });

ipcMain.handle('project:save', async (_e, json) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Enregistrer le projet', defaultPath: 'mon-theme.3dstheme',
    filters: [{ name: 'Projet 3DS Theme Studio', extensions: ['3dstheme'] }],
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, json, 'utf8');
  return true;
});

ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Ouvrir un projet', properties: ['openFile'],
    filters: [{ name: 'Projet 3DS Theme Studio', extensions: ['3dstheme'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});

app.whenReady().then(() => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { stopServer(); if (process.platform !== 'darwin') app.quit(); });
