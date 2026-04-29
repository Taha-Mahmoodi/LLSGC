import { BrowserWindow, app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '../../shared/channels';
import { UpdateState } from '../../shared/types';

let getWindow: (() => BrowserWindow | null) | null = null;
let initialized = false;

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly background checks
let intervalHandle: NodeJS.Timeout | null = null;

export function initUpdater(getter: () => BrowserWindow | null) {
  if (initialized) return;
  initialized = true;
  getWindow = getter;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.disableDifferentialDownload = false;

  autoUpdater.on('checking-for-update', () => emit({ kind: 'checking' }));
  autoUpdater.on('update-available', info =>
    emit({
      kind: 'available',
      info: {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        url: undefined,
      },
    }),
  );
  autoUpdater.on('update-not-available', () =>
    emit({ kind: 'not-available', current: app.getVersion() }),
  );
  autoUpdater.on('download-progress', progress =>
    emit({
      kind: 'downloading',
      percent: Math.round(progress.percent ?? 0),
      bytesPerSecond: progress.bytesPerSecond,
    }),
  );
  autoUpdater.on('update-downloaded', info =>
    emit({
      kind: 'downloaded',
      info: {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      },
    }),
  );
  autoUpdater.on('error', err => emit({ kind: 'error', message: err?.message ?? String(err) }));

  // Hourly background check, plus one ~10s after app start.
  setTimeout(() => safeCheck(), 10_000);
  intervalHandle = setInterval(() => safeCheck(), CHECK_INTERVAL_MS);
}

export function disposeUpdater() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  initialized = false;
}

export async function checkForUpdatesNow(): Promise<UpdateState> {
  return new Promise(resolve => {
    let done = false;
    const finish = (state: UpdateState) => {
      if (done) return;
      done = true;
      resolve(state);
    };
    const cleanup = () => {
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('error', onError);
    };
    const onAvailable = (info: any) => {
      cleanup();
      finish({
        kind: 'available',
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        },
      });
    };
    const onNotAvailable = () => {
      cleanup();
      finish({ kind: 'not-available', current: app.getVersion() });
    };
    const onError = (err: any) => {
      cleanup();
      finish({ kind: 'error', message: err?.message ?? String(err) });
    };
    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.once('error', onError);
    autoUpdater.checkForUpdates().catch(err => onError(err));
  });
}

export async function downloadAndInstall() {
  try {
    await autoUpdater.downloadUpdate();
    // electron-updater's download-progress / update-downloaded events
    // drive the UI; the user clicks "restart now" which calls quitAndInstall.
  } catch (err) {
    emit({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}

export function quitAndInstall() {
  autoUpdater.quitAndInstall(false, true);
}

async function safeCheck() {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    emit({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}

function emit(state: UpdateState) {
  const w = getWindow?.();
  if (w && !w.isDestroyed()) {
    w.webContents.send(IPC.updateState, state);
  }
}
