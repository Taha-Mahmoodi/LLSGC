import { BrowserWindow, app, nativeTheme, screen } from 'electron';
import path from 'node:path';
import { registerIpcHandlers, startTickLoop, stopTickLoop } from './ipc';
import { customManager } from './services/custom-manager';
import { store } from './services/store';

process.env.APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
const PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let mainWindow: BrowserWindow | null = null;

function getWindow() {
  return mainWindow;
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const width = Math.min(1480, Math.round(display.workAreaSize.width * 0.92));
  const height = Math.min(940, Math.round(display.workAreaSize.height * 0.92));

  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#0a0b0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    autoHideMenuBar: true,
    icon: path.join(PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.removeMenu();

  mainWindow.once('ready-to-show', () => {
    const settings = store.getSettings();
    if (!settings.startMinimized) {
      mainWindow?.show();
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // Allow toggling DevTools in production for self-debugging.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const toggle =
      key === 'f12' ||
      (input.control && input.shift && key === 'i') ||
      (input.meta && input.alt && key === 'i');
    if (toggle && mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  stopTickLoop();
  customManager.shutdown();
  store.flush();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  stopTickLoop();
  customManager.shutdown();
  store.flush();
});

app.whenReady().then(() => {
  registerIpcHandlers(getWindow);
  createWindow();
  startTickLoop(getWindow);
  customManager.autoStartAll();
});
