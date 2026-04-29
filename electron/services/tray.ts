import { BrowserWindow, Menu, MenuItemConstructorOptions, Tray, app, nativeImage } from 'electron';
import path from 'node:path';
import { customManager } from './custom-manager';

let tray: Tray | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;
let unsubscribeStatus: (() => void) | null = null;

const ICON_CANDIDATES = [
  () => path.join(process.resourcesPath, 'tray.png'),
  () => path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'tray.png'),
  () => path.join(app.getAppPath(), 'resources', 'tray.png'),
  () => path.join(app.getAppPath(), '..', 'resources', 'tray.png'),
];

function loadIcon() {
  for (const fn of ICON_CANDIDATES) {
    try {
      const p = fn();
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    } catch {
      /* try next */
    }
  }
  return nativeImage.createEmpty();
}

export function initTray(getter: () => BrowserWindow | null) {
  if (tray) return;
  getMainWindow = getter;
  try {
    tray = new Tray(loadIcon());
  } catch (err) {
    console.error('[tray] failed to create', err);
    tray = null;
    return;
  }
  tray.setToolTip('LLSGC');
  tray.on('click', toggleWindow);
  tray.on('double-click', showWindow);
  rebuildMenu();
  unsubscribeStatus = onCustomStatusChange(rebuildMenu);
}

export function destroyTray() {
  unsubscribeStatus?.();
  unsubscribeStatus = null;
  tray?.destroy();
  tray = null;
}

function toggleWindow() {
  const w = getMainWindow?.();
  if (!w) return;
  if (w.isVisible() && !w.isMinimized()) w.hide();
  else showWindow();
}

function showWindow() {
  const w = getMainWindow?.();
  if (!w) return;
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
}

function onCustomStatusChange(fn: () => void): () => void {
  customManager.on('status', fn);
  return () => customManager.off('status', fn);
}

function rebuildMenu() {
  if (!tray) return;
  const customs = customManager.list();
  const running = customs.filter(c => c.status === 'running');

  const items: MenuItemConstructorOptions[] = [
    {
      label: `LLSGC — ${running.length} launcher${running.length === 1 ? '' : 's'} running`,
      enabled: false,
    },
    { type: 'separator' },
    { label: 'Open dashboard', click: showWindow },
    { type: 'separator' },
  ];

  if (customs.length > 0) {
    items.push({
      label: 'Launchers',
      submenu: customs.map<MenuItemConstructorOptions>(c => ({
        label: `${c.status === 'running' ? '● ' : c.status === 'crashed' ? '× ' : '  '}${c.name}`,
        submenu: [
          {
            label: c.status === 'running' ? 'Restart' : 'Start',
            click: async () => {
              if (c.status === 'running') await customManager.restart(c.id);
              else await customManager.start(c.id);
            },
          },
          {
            label: 'Stop',
            enabled: c.status === 'running',
            click: () => {
              customManager.stop(c.id).catch(() => undefined);
            },
          },
        ],
      })),
    });
    items.push({ type: 'separator' });
  }

  items.push({ label: 'Quit', click: () => app.quit() });

  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(
    running.length > 0
      ? `LLSGC — ${running.length} launcher${running.length === 1 ? '' : 's'} running`
      : 'LLSGC',
  );
}
