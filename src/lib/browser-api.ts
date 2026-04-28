import { IPC, type IpcChannel } from '../../shared/channels';
import type {
  IpcResult,
} from '../../shared/types';
import type { LLSGCApi } from '../types/window';

/**
 * Pure-browser API shim used by the lite-zip build (Node service +
 * browser UI). Speaks to the local agent over `POST /api/call` and
 * a single `/ws` WebSocket. No `window.llsgc` required — this kicks
 * in automatically when the preload bridge is missing.
 */

const API_BASE = '/api/call';
const WS_PATH = '/ws';
const RECONNECT_MIN = 1000;
const RECONNECT_MAX = 15000;

let ws: WebSocket | null = null;
let reconnectDelay = RECONNECT_MIN;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Map<string, Set<(payload: unknown) => void>>();

function ensureSocket(): void {
  if (typeof window === 'undefined') return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${window.location.host}${WS_PATH}`;
  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  ws.onopen = () => {
    reconnectDelay = RECONNECT_MIN;
  };
  ws.onmessage = ev => {
    try {
      const msg = JSON.parse(ev.data);
      const set = subscribers.get(msg.event);
      if (set) {
        for (const fn of set) {
          try {
            fn(msg.data);
          } catch (err) {
            console.error('[ws subscriber]', err);
          }
        }
      }
    } catch (err) {
      console.error('[ws parse]', err);
    }
  };
  ws.onclose = () => {
    ws = null;
    scheduleReconnect();
  };
  ws.onerror = () => {
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
    ensureSocket();
  }, reconnectDelay);
}

function listen(channel: IpcChannel, handler: (payload: unknown) => void): () => void {
  ensureSocket();
  const set = subscribers.get(channel) ?? new Set();
  set.add(handler);
  subscribers.set(channel, set);
  return () => {
    const cur = subscribers.get(channel);
    if (!cur) return;
    cur.delete(handler);
    if (cur.size === 0) subscribers.delete(channel);
  };
}

async function invoke<T>(channel: IpcChannel, ...args: unknown[]): Promise<IpcResult<T>> {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, args }),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    return (await res.json()) as IpcResult<T>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function copyToClipboard(text: string): Promise<IpcResult> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok ? { ok: true } : { ok: false, error: 'Copy command failed' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

function openInNewTab(url: string): IpcResult {
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  return w ? { ok: true } : { ok: false, error: 'Popup blocked' };
}

export const browserApi: LLSGCApi = {
  getSystemStats: () => invoke(IPC.systemStats),
  onSystemTick: h => listen(IPC.systemTick, h as (p: unknown) => void),

  listServers: () => invoke(IPC.serversList),
  onServersTick: h => listen(IPC.serversTick, h as (p: unknown) => void),
  killServer: (pid, force = false) => invoke(IPC.serversKill, pid, force),
  openServer: async url => openInNewTab(url),
  copyText: copyToClipboard,
  serverDetails: pid => invoke(IPC.serversDetails, pid),
  revealLocation: p => invoke(IPC.serversRevealLocation, p),

  listCustom: () => invoke(IPC.customList),
  saveCustom: input => invoke(IPC.customSave, input),
  removeCustom: id => invoke(IPC.customRemove, id),
  startCustom: id => invoke(IPC.customStart, id),
  stopCustom: id => invoke(IPC.customStop, id),
  restartCustom: id => invoke(IPC.customRestart, id),
  getLogs: id => invoke(IPC.customLogs, id),
  clearLogs: id => invoke(IPC.customLogsClear, id),
  onCustomLog: h => listen(IPC.customLogTick, h as (p: unknown) => void),
  onCustomStatus: h => listen(IPC.customStatusTick, h as (p: unknown) => void),

  listFirewall: () => invoke(IPC.firewallList),
  blockPort: input => invoke(IPC.firewallBlock, input),
  unblockRule: name => invoke(IPC.firewallUnblock, name),
  toggleRule: (name, enabled) => invoke(IPC.firewallToggle, name, enabled),

  getSettings: () => invoke(IPC.settingsGet),
  updateSettings: patch => invoke(IPC.settingsUpdate, patch),

  listHosts: () => invoke(IPC.hostsList),
  saveHost: input => invoke(IPC.hostsSave, input),
  removeHost: id => invoke(IPC.hostsRemove, id),
  toggleHost: (id, enabled) => invoke(IPC.hostsToggle, id, enabled),

  checkPort: port => invoke(IPC.portsCheck, port),
  checkPorts: ports => invoke(IPC.portsCheckMany, ports),
  listCommonPorts: () => invoke(IPC.portsCommon),

  quit: async () => undefined,
  minimize: async () => undefined,
  maximize: async () => undefined,
  platform: () => invoke(IPC.appPlatform),
  openExternal: async url => openInNewTab(url),
  pickDirectory: () => invoke(IPC.appPickDirectory),
};

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { llsgc?: unknown }).llsgc;
}
