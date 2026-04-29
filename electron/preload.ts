import { contextBridge, ipcRenderer } from 'electron';
import { IPC, IpcChannel } from '../shared/channels';

const invoke = <T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args);

const listen = (channel: IpcChannel, handler: (payload: any) => void) => {
  const wrapped = (_e: unknown, payload: any) => handler(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
};

const api = {
  // System
  getSystemStats: () => invoke(IPC.systemStats),
  onSystemTick: (h: (s: any) => void) => listen(IPC.systemTick, h),

  // Servers
  listServers: () => invoke(IPC.serversList),
  onServersTick: (h: (s: any) => void) => listen(IPC.serversTick, h),
  killServer: (pid: number, force = false) => invoke(IPC.serversKill, pid, force),
  openServer: (url: string) => invoke(IPC.serversOpen, url),
  copyText: (text: string) => invoke(IPC.serversCopy, text),
  serverDetails: (pid: number) => invoke(IPC.serversDetails, pid),
  revealLocation: (path: string) => invoke(IPC.serversRevealLocation, path),

  // Custom
  listCustom: () => invoke(IPC.customList),
  saveCustom: (input: any) => invoke(IPC.customSave, input),
  removeCustom: (id: string) => invoke(IPC.customRemove, id),
  startCustom: (id: string) => invoke(IPC.customStart, id),
  stopCustom: (id: string) => invoke(IPC.customStop, id),
  restartCustom: (id: string) => invoke(IPC.customRestart, id),
  getLogs: (id: string) => invoke(IPC.customLogs, id),
  clearLogs: (id: string) => invoke(IPC.customLogsClear, id),
  onCustomLog: (h: (line: any) => void) => listen(IPC.customLogTick, h),
  onCustomStatus: (h: (list: any) => void) => listen(IPC.customStatusTick, h),

  // Firewall
  listFirewall: () => invoke(IPC.firewallList),
  blockPort: (input: any) => invoke(IPC.firewallBlock, input),
  unblockRule: (name: string) => invoke(IPC.firewallUnblock, name),
  toggleRule: (name: string, enabled: boolean) => invoke(IPC.firewallToggle, name, enabled),

  // Settings
  getSettings: () => invoke(IPC.settingsGet),
  updateSettings: (patch: any) => invoke(IPC.settingsUpdate, patch),

  // Hosts file
  listHosts: () => invoke(IPC.hostsList),
  saveHost: (input: any) => invoke(IPC.hostsSave, input),
  removeHost: (id: string) => invoke(IPC.hostsRemove, id),
  toggleHost: (id: string, enabled: boolean) => invoke(IPC.hostsToggle, id, enabled),

  // Ports availability
  checkPort: (port: number) => invoke(IPC.portsCheck, port),
  checkPorts: (ports: number[]) => invoke(IPC.portsCheckMany, ports),
  listCommonPorts: () => invoke(IPC.portsCommon),

  // HTTP probe
  probeUrl: (url: string, opts?: { timeoutMs?: number; method?: 'GET' | 'HEAD' }) =>
    invoke(IPC.serversProbe, url, opts),

  // Diagnostics
  runDiagnostics: () => invoke(IPC.diagnosticsRun),

  // Auto-update (desktop only)
  checkForUpdates: () => invoke(IPC.updateCheck),
  applyUpdate: () => invoke(IPC.updateApply),
  onUpdateState: (h: (state: any) => void) => listen(IPC.updateState, h),

  // App
  quit: () => invoke(IPC.appQuit),
  minimize: () => invoke(IPC.appMinimize),
  maximize: () => invoke(IPC.appMaximize),
  platform: () => invoke(IPC.appPlatform),
  openExternal: (url: string) => invoke(IPC.appOpenExternal, url),
  pickDirectory: () => invoke(IPC.appPickDirectory),
};

contextBridge.exposeInMainWorld('llsgc', api);

export type LLSGCApi = typeof api;
