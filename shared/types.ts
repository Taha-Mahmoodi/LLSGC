export type Protocol = 'tcp' | 'udp';

export type ServerStatus =
  | 'listening'
  | 'starting'
  | 'running'
  | 'stopped'
  | 'crashed';

export interface DetectedServer {
  pid: number;
  name: string;
  command?: string;
  port: number;
  protocol: Protocol;
  address: string;
  state: string;
  cpu: number;
  memoryBytes: number;
  uptimeSec: number;
  startedAt: number;
  url?: string;
  customId?: string;
}

export interface SystemStats {
  cpu: number;
  cpuCount: number;
  cpuModel: string;
  loadAverage: number[];
  memory: {
    used: number;
    total: number;
    free: number;
    percent: number;
  };
  uptime: number;
  platform: string;
  arch: string;
  hostname: string;
  release: string;
}

export interface FirewallRule {
  name: string;
  enabled: boolean;
  direction: 'in' | 'out';
  action: 'allow' | 'block';
  protocol: string;
  localPort: string;
  managed: boolean;
}

export interface CustomServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  port?: number;
  url?: string;
  color?: string;
  autoStart: boolean;
  pid?: number;
  status: ServerStatus;
  startedAt?: number;
  lastExitCode?: number | null;
  lastExitedAt?: number;
}

export interface CustomServerInput {
  id?: string;
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  url?: string;
  color?: string;
  autoStart?: boolean;
}

export interface LogLine {
  id: string;
  customId: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
  ts: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  refreshIntervalMs: number;
  closeToTray: boolean;
  startMinimized: boolean;
  defaultBrowser: string;
  enableNotifications: boolean;
  showSystemPorts: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  refreshIntervalMs: 2500,
  closeToTray: false,
  startMinimized: false,
  defaultBrowser: '',
  enableNotifications: true,
  showSystemPorts: false,
};

export interface IpcResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ProcessDetails {
  pid: number;
  ppid?: number;
  name: string;
  command?: string;
  executable?: string;
  user?: string;
  cpu: number;
  memoryBytes: number;
  startedAt: number;
  uptimeSec: number;
  ports: Array<{ port: number; protocol: Protocol; address: string }>;
}
