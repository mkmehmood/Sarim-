const { app, BrowserWindow, Menu, protocol, net, shell, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const HOST = 'mkmehmood.github.io';
const BASE_PATH = '/sarim/';
const WEB_ROOT = path.join(__dirname, 'web');

protocol.registerSchemesAsPrivileged([
  { scheme: 'https', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

function resolveLocal(urlStr) {
  const u = new URL(urlStr);
  if (u.hostname !== HOST) return null;
  let p = decodeURIComponent(u.pathname);
  if (p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length);
  else if (p === '/sarim') p = '';
  else p = p.replace(/^\//, '');
  if (!p || p.endsWith('/')) p += 'index.html';
  const full = path.normalize(path.join(WEB_ROOT, p));
  if (!full.startsWith(WEB_ROOT)) return null;
  return fs.existsSync(full) && fs.statSync(full).isFile() ? full : null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 640,
    backgroundColor: '#E8ECF0',
    title: 'Gull & Zubair',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) && !url.includes(HOST)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.includes(HOST) && /^https?:/i.test(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.loadURL(`https://${HOST}${BASE_PATH}index.html`);
  return win;
}

app.whenReady().then(() => {
  protocol.handle('https', (request) => {
    const local = resolveLocal(request.url);
    if (local) return net.fetch(pathToFileURL(local).toString());
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });

  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'geolocation', 'clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen'].includes(permission));
  });

  session.defaultSession.on('will-download', (event, item) => {
    const win = BrowserWindow.getFocusedWindow();
    const savePath = dialog.showSaveDialogSync(win || undefined, { defaultPath: item.getFilename() });
    if (savePath) item.setSavePath(savePath); else item.cancel();
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
