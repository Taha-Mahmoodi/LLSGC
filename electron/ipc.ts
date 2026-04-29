import { BrowserWindow, app, clipboard, dialog, ipcMain, shell } from 'electron';
import { exec } from 'node:child_process';
import { IPC } from '../shared/channels';
import {
  AppSettings,
  CustomServer,
  CustomServerInput,
  DetectedServer,
  HostEntryInput,
  HostsInfo,
  IpcResult,
  LogLine,
  PortCheckResult,
  SystemStats,
} from '../shared/types';
import { scanListeningPorts } from './services/port-scanner';
import { getDetails, getProcessInfoBatch, pruneDeadPids } from './services/process-info';
import { killPid } from './services/process-killer';
import {
  blockPort,
  listFirewallRules,
  setRuleEnabled,
  unblockByRuleName,
} from './services/firewall';
import { getSystemStats } from './services/system-stats';
import { customManager } from './services/custom-manager';
import { store } from './services/store';
import { reachableUrls } from './services/network-info';
import {
  readHosts,
  saveHostEntry,
  removeHostEntry,
  toggleHostEntry,
} from './services/hosts';
import {
  checkPort,
  checkPorts,
  listCommonPorts,
} from './services/port-check';
import { probe } from './services/http-probe';
import { runDiagnostics } from './services/diagnostics';

let tickHandle: NodeJS.Timeout | null = null;
let lastInterval = 2500;

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC.systemStats, async (): Promise<IpcResult<SystemStats>> => {
    return ok(getSystemStats());
  });

  ipcMain.handle(IPC.serversList, async (): Promise<IpcResult<DetectedServer[]>> => {
    try {
      const servers = await collectServers();
      return ok(servers);
    } catch (err: any) {
      return fail(err);
    }
  });

  ipcMain.handle(IPC.serversKill, async (_e, pid: number, force = false): Promise<IpcResult> => {
    const r = await killPid(pid, force);
    return r.ok ? ok() : fail(r.error || 'Kill failed');
  });

  ipcMain.handle(IPC.serversOpen, async (_e, url: string): Promise<IpcResult> => {
    try {
      await shell.openExternal(url);
      return ok();
    } catch (err: any) {
      return fail(err);
    }
  });

  ipcMain.handle(IPC.serversCopy, async (_e, text: string): Promise<IpcResult> => {
    clipboard.writeText(text);
    return ok();
  });

  ipcMain.handle(IPC.serversDetails, async (_e, pid: number): Promise<IpcResult<any>> => {
    const info = await getDetails(pid);
    if (!info) return fail('Process not found');
    return ok(info);
  });

  ipcMain.handle(IPC.serversRevealLocation, async (_e, executable: string): Promise<IpcResult> => {
    if (!executable) return fail('No executable path');
    shell.showItemInFolder(executable);
    return ok();
  });

  ipcMain.handle(IPC.customList, async (): Promise<IpcResult<CustomServer[]>> => {
    return ok(customManager.list());
  });

  ipcMain.handle(IPC.customSave, async (_e, input: CustomServerInput): Promise<IpcResult<CustomServer>> => {
    if (!input?.name?.trim()) return fail('Name is required');
    if (!input?.command?.trim()) return fail('Command is required');
    const saved = customManager.save({
      id: input.id,
      name: input.name,
      command: input.command,
      args: input.args,
      cwd: input.cwd,
      env: input.env,
      port: input.port,
      url: input.url,
      color: input.color,
      autoStart: input.autoStart,
    });
    return ok(saved);
  });

  ipcMain.handle(IPC.customRemove, async (_e, id: string): Promise<IpcResult> => {
    return customManager.remove(id) ? ok() : fail('Not found');
  });

  ipcMain.handle(IPC.customStart, async (_e, id: string): Promise<IpcResult<{ pid?: number }>> => {
    const r = await customManager.start(id);
    return r.ok ? ok({ pid: r.pid }) : fail(r.error || 'Start failed');
  });

  ipcMain.handle(IPC.customStop, async (_e, id: string): Promise<IpcResult> => {
    const r = await customManager.stop(id);
    return r.ok ? ok() : fail(r.error || 'Stop failed');
  });

  ipcMain.handle(IPC.customRestart, async (_e, id: string): Promise<IpcResult> => {
    const r = await customManager.restart(id);
    return r.ok ? ok() : fail(r.error || 'Restart failed');
  });

  ipcMain.handle(IPC.customLogs, async (_e, id: string): Promise<IpcResult<LogLine[]>> => {
    return ok(customManager.getLogs(id));
  });

  ipcMain.handle(IPC.customLogsClear, async (_e, id: string): Promise<IpcResult> => {
    customManager.clearLogs(id);
    return ok();
  });

  ipcMain.handle(IPC.firewallList, async (): Promise<IpcResult<any>> => {
    const rules = await listFirewallRules();
    return ok(rules);
  });

  ipcMain.handle(
    IPC.firewallBlock,
    async (
      _e,
      input: { port: number; protocol: 'TCP' | 'UDP' | 'Any'; direction: 'in' | 'out' | 'both' },
    ): Promise<IpcResult<any>> => {
      const r = await blockPort(input);
      return r.ok ? ok({ ruleNames: r.ruleNames }) : fail(r.error || 'Block failed');
    },
  );

  ipcMain.handle(IPC.firewallUnblock, async (_e, name: string): Promise<IpcResult> => {
    const r = await unblockByRuleName(name);
    return r.ok ? ok() : fail(r.error || 'Unblock failed');
  });

  ipcMain.handle(
    IPC.firewallToggle,
    async (_e, name: string, enabled: boolean): Promise<IpcResult> => {
      const r = await setRuleEnabled(name, enabled);
      return r.ok ? ok() : fail(r.error || 'Toggle failed');
    },
  );

  ipcMain.handle(IPC.settingsGet, async (): Promise<IpcResult<AppSettings>> => {
    return ok(store.getSettings());
  });

  ipcMain.handle(IPC.settingsUpdate, async (_e, patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>> => {
    const next = store.updateSettings(patch);
    if (typeof patch.refreshIntervalMs === 'number') {
      restartTick(getWindow);
    }
    return ok(next);
  });

  ipcMain.handle(IPC.hostsList, async (): Promise<IpcResult<HostsInfo>> => {
    try {
      return ok(await readHosts());
    } catch (err) {
      return fail(err);
    }
  });

  ipcMain.handle(IPC.hostsSave, async (_e, input: HostEntryInput): Promise<IpcResult<any>> => {
    const r = await saveHostEntry(input);
    return r.ok ? ok({ entry: r.entry }) : fail(r.error || 'Save failed');
  });

  ipcMain.handle(IPC.hostsRemove, async (_e, id: string): Promise<IpcResult> => {
    const r = await removeHostEntry(id);
    return r.ok ? ok() : fail(r.error || 'Remove failed');
  });

  ipcMain.handle(IPC.hostsToggle, async (_e, id: string, enabled: boolean): Promise<IpcResult> => {
    const r = await toggleHostEntry(id, enabled);
    return r.ok ? ok() : fail(r.error || 'Toggle failed');
  });

  ipcMain.handle(IPC.portsCheck, async (_e, port: number): Promise<IpcResult<PortCheckResult>> => {
    return ok(await checkPort(port));
  });

  ipcMain.handle(IPC.portsCheckMany, async (_e, ports: number[]): Promise<IpcResult<PortCheckResult[]>> => {
    if (!Array.isArray(ports)) return fail('ports must be an array');
    return ok(await checkPorts(ports));
  });

  ipcMain.handle(IPC.portsCommon, async (): Promise<IpcResult<any>> => ok(listCommonPorts()));

  ipcMain.handle(
    IPC.serversProbe,
    async (
      _e,
      url: string,
      opts?: { timeoutMs?: number; method?: 'GET' | 'HEAD' },
    ): Promise<IpcResult<any>> => {
      if (!url || typeof url !== 'string') return fail('url is required');
      return ok(await probe(url, opts));
    },
  );

  ipcMain.handle(IPC.diagnosticsRun, async (): Promise<IpcResult<any>> => {
    return ok(await runDiagnostics());
  });

  ipcMain.handle(IPC.updateCheck, async (): Promise<IpcResult<any>> => {
    try {
      const { checkForUpdatesNow } = await import('./services/updater');
      return ok(await checkForUpdatesNow());
    } catch (err) {
      return fail(err);
    }
  });

  ipcMain.handle(IPC.updateApply, async (): Promise<IpcResult> => {
    try {
      const { downloadAndInstall, quitAndInstall } = await import('./services/updater');
      // If the update is already downloaded, install. Otherwise, kick off the download.
      // We expose both behind a single button on the renderer: it sends "apply" and
      // electron-updater either downloads-then-installs, or installs-now.
      await downloadAndInstall();
      // Don't auto-quitAndInstall here — wait until renderer confirms after seeing
      // the "downloaded" state. But for simplicity we let the user click again.
      return ok();
    } catch (err) {
      return fail(err);
    }
  });

  // Bonus: a 'now-restart' style channel that immediately quits + installs.
  // Reuses the same updateApply channel — second click after download triggers it.
  // The renderer's UI handles the two-step flow.
  ipcMain.handle('update:install-now', async (): Promise<IpcResult> => {
    try {
      const { quitAndInstall } = await import('./services/updater');
      quitAndInstall();
      return ok();
    } catch (err) {
      return fail(err);
    }
  });

  ipcMain.handle(IPC.appQuit, () => {
    app.quit();
  });

  ipcMain.handle(IPC.appMinimize, () => {
    getWindow()?.minimize();
  });

  ipcMain.handle(IPC.appMaximize, () => {
    const w = getWindow();
    if (!w) return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });

  ipcMain.handle(IPC.appPlatform, async (): Promise<IpcResult<{ platform: string; isWindows: boolean }>> => {
    return ok({ platform: process.platform, isWindows: process.platform === 'win32' });
  });

  ipcMain.handle(IPC.appOpenExternal, async (_e, url: string): Promise<IpcResult> => {
    try {
      await shell.openExternal(url);
      return ok();
    } catch (err: any) {
      return fail(err);
    }
  });

  ipcMain.handle(IPC.appPickDirectory, async (): Promise<IpcResult<string | null>> => {
    const w = getWindow();
    if (!w) return fail('No window');
    const r = await dialog.showOpenDialog(w, {
      properties: ['openDirectory'],
      title: 'Choose working directory',
    });
    if (r.canceled || r.filePaths.length === 0) return ok(null);
    return ok(r.filePaths[0]);
  });

  customManager.on('status', () => {
    getWindow()?.webContents.send(IPC.customStatusTick, customManager.list());
  });

  customManager.on('log', payload => {
    getWindow()?.webContents.send(IPC.customLogTick, payload);
  });
}

export function startTickLoop(getWindow: () => BrowserWindow | null) {
  const settings = store.getSettings();
  lastInterval = Math.max(800, settings.refreshIntervalMs);
  scheduleTick(getWindow);
}

function restartTick(getWindow: () => BrowserWindow | null) {
  if (tickHandle) {
    clearTimeout(tickHandle);
    tickHandle = null;
  }
  const settings = store.getSettings();
  lastInterval = Math.max(800, settings.refreshIntervalMs);
  scheduleTick(getWindow);
}

function scheduleTick(getWindow: () => BrowserWindow | null) {
  tickHandle = setTimeout(async () => {
    try {
      const win = getWindow();
      if (win && !win.isDestroyed() && !win.isMinimized()) {
        const stats = getSystemStats();
        win.webContents.send(IPC.systemTick, stats);
        const servers = await collectServers();
        win.webContents.send(IPC.serversTick, servers);
      }
    } catch (err) {
      console.error('[tick] error', err);
    } finally {
      scheduleTick(getWindow);
    }
  }, lastInterval);
}

export function stopTickLoop() {
  if (tickHandle) {
    clearTimeout(tickHandle);
    tickHandle = null;
  }
}

async function collectServers(): Promise<DetectedServer[]> {
  const ports = await scanListeningPorts();
  const pids = [...new Set(ports.map(p => p.pid))].filter(p => p > 0);
  const proc = await getProcessInfoBatch(pids);
  pruneDeadPids(new Set(pids));

  const customs = customManager.list();
  const customByPid = new Map<number, CustomServer>();
  for (const c of customs) {
    if (c.pid) customByPid.set(c.pid, c);
  }
  const settings = store.getSettings();

  const out: DetectedServer[] = [];
  for (const port of ports) {
    const info = proc.get(port.pid);
    const custom = customByPid.get(port.pid);

    if (!settings.showSystemPorts && !custom) {
      if (looksLikeSystemProcess(info?.name, port.address)) continue;
    }

    const startedAt = info?.startedAt ?? Date.now();
    const urls = reachableUrls(port.address, port.port, port.protocol);
    out.push({
      pid: port.pid,
      name: info?.name ?? `pid:${port.pid}`,
      command: info?.command,
      port: port.port,
      protocol: port.protocol,
      address: port.address,
      state: port.state,
      cpu: info?.cpu ?? 0,
      memoryBytes: info?.memoryBytes ?? 0,
      uptimeSec: Math.max(0, (Date.now() - startedAt) / 1000),
      startedAt,
      url: urls[0] ?? buildUrl(port.address, port.port, port.protocol),
      urls: urls.length > 0 ? urls : undefined,
      customId: custom?.id,
    });
  }
  out.sort((a, b) => {
    if (a.customId && !b.customId) return -1;
    if (!a.customId && b.customId) return 1;
    return a.port - b.port;
  });
  return out;
}

function buildUrl(address: string, port: number, protocol: string): string | undefined {
  if (protocol !== 'tcp') return undefined;
  const host =
    address === '0.0.0.0' || address === '::' || address === '*' ? 'localhost' : address;
  return `http://${host}:${port}`;
}

const SYSTEM_NAMES = new Set([
  'svchost.exe',
  'system',
  'services.exe',
  'lsass.exe',
  'wininit.exe',
  'spoolsv.exe',
  'winlogon.exe',
  'csrss.exe',
  'smss.exe',
  'searchhost.exe',
  'searchindexer.exe',
  'searchapp.exe',
  'systemsettings.exe',
  'fontdrvhost.exe',
  'dwm.exe',
  'audiodg.exe',
  'unsecapp.exe',
  'wudfhost.exe',
]);

function looksLikeSystemProcess(name?: string, address?: string): boolean {
  if (!name) return false;
  if (SYSTEM_NAMES.has(name.toLowerCase())) return true;
  if (address && (address.startsWith('127.') || address === '0.0.0.0' || address === '::')) {
    return false;
  }
  return false;
}

function ok<T>(data?: T): IpcResult<T> {
  return { ok: true, data };
}

function fail<T = void>(err: unknown): IpcResult<T> {
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: message.slice(0, 500) };
}
