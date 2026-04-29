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
  /** Primary clickable URL — usually `http://localhost:<port>` */
  url?: string;
  /** All reachable URLs: localhost + LAN + interface IPs when bound to 0.0.0.0 */
  urls?: string[];
  customId?: string;
}

export interface LocalNetworkAddress {
  family: 'IPv4' | 'IPv6';
  address: string;
  internal: boolean;
  interface: string;
  primary?: boolean;
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
  /** Local network addresses (IPv4 + IPv6, internal + external). */
  network?: LocalNetworkAddress[];
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

export interface HostEntry {
  id: string;
  ip: string;
  hostnames: string[];
  enabled: boolean;
  comment?: string;
  source?: 'system' | 'user';
}

export interface HostEntryInput {
  id?: string;
  ip: string;
  hostnames: string[];
  enabled?: boolean;
  comment?: string;
}

export interface HostsInfo {
  path: string;
  writable: boolean;
  entries: HostEntry[];
  preamble: string;
}

export interface PortCheckResult {
  port: number;
  busy: boolean;
  pid?: number;
  process?: string;
  protocol?: 'tcp' | 'udp';
  address?: string;
}

export interface CommonPort {
  port: number;
  label: string;
  description: string;
}

export const COMMON_DEV_PORTS: CommonPort[] = [
  { port: 80,    label: 'HTTP',           description: 'Plain web traffic' },
  { port: 443,   label: 'HTTPS',          description: 'TLS web traffic' },
  { port: 3000,  label: 'Node / Next.js', description: 'Default for create-react-app, Next.js, Express' },
  { port: 3001,  label: 'Node alt',       description: 'Common fallback when 3000 is busy' },
  { port: 3306,  label: 'MySQL',          description: 'MySQL / MariaDB' },
  { port: 4200,  label: 'Angular',        description: 'Angular CLI dev server' },
  { port: 5000,  label: 'Flask',          description: 'Default Python Flask port' },
  { port: 5173,  label: 'Vite',           description: 'Default Vite dev server' },
  { port: 5432,  label: 'PostgreSQL',     description: 'PostgreSQL database' },
  { port: 5500,  label: 'Live Server',    description: 'VS Code Live Server extension' },
  { port: 6379,  label: 'Redis',          description: 'Redis in-memory store' },
  { port: 8000,  label: 'Django / http',  description: 'Django, python -m http.server' },
  { port: 8080,  label: 'HTTP alt',       description: 'Tomcat, alternate web port' },
  { port: 8443,  label: 'HTTPS alt',      description: 'Common alternate TLS port' },
  { port: 9000,  label: 'PHP-FPM / SonarQube', description: 'php-fpm, SonarQube' },
  { port: 9200,  label: 'Elasticsearch',  description: 'Elasticsearch HTTP API' },
  { port: 27017, label: 'MongoDB',        description: 'MongoDB database' },
];

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
