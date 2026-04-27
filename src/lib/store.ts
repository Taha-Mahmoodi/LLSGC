import { create } from 'zustand';
import type {
  AppSettings,
  CustomServer,
  DetectedServer,
  FirewallRule,
  LogLine,
  SystemStats,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

const HISTORY_LEN = 60;

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'ok' | 'err' | 'info';
  ts: number;
}

interface AppState {
  systemStats: SystemStats | null;
  cpuHistory: number[];
  memHistory: number[];

  servers: DetectedServer[];
  serverHistory: Map<number, number[]>;

  customServers: CustomServer[];
  logs: Record<string, LogLine[]>;

  firewallRules: FirewallRule[];

  settings: AppSettings;

  selectedServerPid: number | null;
  selectedCustomId: string | null;

  toasts: Toast[];

  setSystemStats: (s: SystemStats) => void;
  setServers: (s: DetectedServer[]) => void;
  setCustomServers: (s: CustomServer[]) => void;
  setLogs: (id: string, lines: LogLine[]) => void;
  appendLog: (line: LogLine) => void;
  setFirewall: (r: FirewallRule[]) => void;
  setSettings: (s: AppSettings) => void;
  setSelectedServer: (pid: number | null) => void;
  setSelectedCustom: (id: string | null) => void;
  pushToast: (t: Omit<Toast, 'id' | 'ts'>) => void;
  dismissToast: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  systemStats: null,
  cpuHistory: [],
  memHistory: [],

  servers: [],
  serverHistory: new Map(),

  customServers: [],
  logs: {},

  firewallRules: [],

  settings: DEFAULT_SETTINGS,

  selectedServerPid: null,
  selectedCustomId: null,

  toasts: [],

  setSystemStats: stats =>
    set(state => ({
      systemStats: stats,
      cpuHistory: pushHistory(state.cpuHistory, stats.cpu),
      memHistory: pushHistory(state.memHistory, stats.memory.percent),
    })),

  setServers: servers =>
    set(state => {
      const next = new Map(state.serverHistory);
      const seen = new Set<number>();
      for (const s of servers) {
        seen.add(s.pid);
        next.set(s.pid, pushHistory(next.get(s.pid) ?? [], s.cpu));
      }
      for (const pid of next.keys()) {
        if (!seen.has(pid)) next.delete(pid);
      }
      return { servers, serverHistory: next };
    }),

  setCustomServers: customServers => set({ customServers }),

  setLogs: (id, lines) =>
    set(state => ({ logs: { ...state.logs, [id]: lines } })),

  appendLog: line =>
    set(state => {
      const cur = state.logs[line.customId] ?? [];
      const next = [...cur, line];
      if (next.length > 1000) next.splice(0, next.length - 1000);
      return { logs: { ...state.logs, [line.customId]: next } };
    }),

  setFirewall: rules => set({ firewallRules: rules }),

  setSettings: settings => {
    if (settings.theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.classList.toggle('light', !dark);
    }
    set({ settings });
  },

  setSelectedServer: pid => set({ selectedServerPid: pid }),
  setSelectedCustom: id => set({ selectedCustomId: id }),

  pushToast: ({ title, description, tone }) =>
    set(state => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = { id, title, description, tone, ts: Date.now() };
      const next = [...state.toasts, toast].slice(-5);
      setTimeout(() => {
        const cur = get().toasts.filter(t => t.id !== id);
        if (cur.length !== get().toasts.length) {
          set({ toasts: cur });
        }
      }, 4500);
      return { toasts: next };
    }),

  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

function pushHistory(arr: number[], v: number): number[] {
  const next = [...arr, Number.isFinite(v) ? v : 0];
  if (next.length > HISTORY_LEN) next.splice(0, next.length - HISTORY_LEN);
  return next;
}
