import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  AppSettings,
  CustomServer,
  DEFAULT_SETTINGS,
} from '../../shared/types';

interface PersistedState {
  settings: AppSettings;
  customServers: CustomServer[];
}

const DEFAULT_STATE: PersistedState = {
  settings: DEFAULT_SETTINGS,
  customServers: [],
};

let cache: PersistedState | null = null;
let writeTimer: NodeJS.Timeout | null = null;

function getFilePath() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'llsgc.config.json');
}

function read(): PersistedState {
  if (cache) return cache;
  const file = getFilePath();
  if (!fs.existsSync(file)) {
    cache = structuredClone(DEFAULT_STATE);
    return cache;
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    cache = {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      customServers: (parsed.customServers ?? []).map(normalizeCustom),
    };
    return cache;
  } catch (err) {
    console.error('[store] failed to read config, falling back to defaults', err);
    cache = structuredClone(DEFAULT_STATE);
    return cache;
  }
}

function normalizeCustom(c: Partial<CustomServer>): CustomServer {
  return {
    id: c.id ?? cryptoId(),
    name: c.name ?? 'Untitled',
    command: c.command ?? '',
    args: c.args ?? [],
    cwd: c.cwd ?? '',
    env: c.env ?? {},
    port: c.port,
    url: c.url,
    color: c.color,
    autoStart: c.autoStart ?? false,
    pid: undefined,
    status: 'stopped',
    startedAt: undefined,
    lastExitCode: c.lastExitCode ?? null,
    lastExitedAt: c.lastExitedAt,
  };
}

function cryptoId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

function scheduleWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (!cache) return;
    const persisted: PersistedState = {
      settings: cache.settings,
      customServers: cache.customServers.map(c => ({
        ...c,
        pid: undefined,
        status: 'stopped',
        startedAt: undefined,
      })),
    };
    try {
      fs.writeFileSync(getFilePath(), JSON.stringify(persisted, null, 2), 'utf-8');
    } catch (err) {
      console.error('[store] write failed', err);
    }
  }, 250);
}

export const store = {
  getSettings(): AppSettings {
    return { ...read().settings };
  },
  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const state = read();
    state.settings = { ...state.settings, ...patch };
    scheduleWrite();
    return state.settings;
  },
  listCustom(): CustomServer[] {
    return read().customServers.map(c => ({ ...c }));
  },
  saveCustom(input: Omit<Partial<CustomServer>, 'status' | 'pid' | 'startedAt'> & {
    name: string;
    command: string;
  }): CustomServer {
    const state = read();
    const id = input.id ?? cryptoId();
    const existing = state.customServers.find(c => c.id === id);
    const base = existing ?? normalizeCustom({ id });
    const merged: CustomServer = {
      ...base,
      ...input,
      id,
      status: existing?.status ?? 'stopped',
      pid: existing?.pid,
      startedAt: existing?.startedAt,
    };
    if (existing) {
      Object.assign(existing, merged);
    } else {
      state.customServers.push(merged);
    }
    scheduleWrite();
    return merged;
  },
  removeCustom(id: string): boolean {
    const state = read();
    const before = state.customServers.length;
    state.customServers = state.customServers.filter(c => c.id !== id);
    scheduleWrite();
    return state.customServers.length < before;
  },
  setCustomRuntime(id: string, patch: Partial<Pick<CustomServer, 'pid' | 'status' | 'startedAt' | 'lastExitCode' | 'lastExitedAt'>>): CustomServer | null {
    const state = read();
    const target = state.customServers.find(c => c.id === id);
    if (!target) return null;
    Object.assign(target, patch);
    return { ...target };
  },
  flush() {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    if (!cache) return;
    try {
      fs.writeFileSync(getFilePath(), JSON.stringify(cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[store] flush failed', err);
    }
  },
};

export function newId(): string {
  return cryptoId();
}
