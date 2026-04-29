import type {
  AppSettings,
  CommonPort,
  CustomServer,
  CustomServerInput,
  DetectedServer,
  DiagnosticsReport,
  FirewallRule,
  HostEntryInput,
  HostsInfo,
  HttpProbeResult,
  IpcResult,
  LogLine,
  PortCheckResult,
  ProcessDetails,
  SystemStats,
  UpdateState,
} from '../../shared/types';

export interface LLSGCApi {
  getSystemStats(): Promise<IpcResult<SystemStats>>;
  onSystemTick(h: (s: SystemStats) => void): () => void;

  listServers(): Promise<IpcResult<DetectedServer[]>>;
  onServersTick(h: (s: DetectedServer[]) => void): () => void;
  killServer(pid: number, force?: boolean): Promise<IpcResult>;
  openServer(url: string): Promise<IpcResult>;
  copyText(text: string): Promise<IpcResult>;
  serverDetails(pid: number): Promise<IpcResult<ProcessDetails>>;
  revealLocation(path: string): Promise<IpcResult>;

  listCustom(): Promise<IpcResult<CustomServer[]>>;
  saveCustom(input: CustomServerInput): Promise<IpcResult<CustomServer>>;
  removeCustom(id: string): Promise<IpcResult>;
  startCustom(id: string): Promise<IpcResult<{ pid?: number }>>;
  stopCustom(id: string): Promise<IpcResult>;
  restartCustom(id: string): Promise<IpcResult>;
  getLogs(id: string): Promise<IpcResult<LogLine[]>>;
  clearLogs(id: string): Promise<IpcResult>;
  onCustomLog(h: (line: LogLine) => void): () => void;
  onCustomStatus(h: (list: CustomServer[]) => void): () => void;

  listFirewall(): Promise<IpcResult<FirewallRule[]>>;
  blockPort(input: {
    port: number;
    protocol: 'TCP' | 'UDP' | 'Any';
    direction: 'in' | 'out' | 'both';
  }): Promise<IpcResult<{ ruleNames: string[] }>>;
  unblockRule(name: string): Promise<IpcResult>;
  toggleRule(name: string, enabled: boolean): Promise<IpcResult>;

  getSettings(): Promise<IpcResult<AppSettings>>;
  updateSettings(patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>>;

  listHosts(): Promise<IpcResult<HostsInfo>>;
  saveHost(input: HostEntryInput): Promise<IpcResult<any>>;
  removeHost(id: string): Promise<IpcResult>;
  toggleHost(id: string, enabled: boolean): Promise<IpcResult>;

  checkPort(port: number): Promise<IpcResult<PortCheckResult>>;
  checkPorts(ports: number[]): Promise<IpcResult<PortCheckResult[]>>;
  listCommonPorts(): Promise<IpcResult<CommonPort[]>>;

  probeUrl(
    url: string,
    opts?: { timeoutMs?: number; method?: 'GET' | 'HEAD' },
  ): Promise<IpcResult<HttpProbeResult>>;

  runDiagnostics(): Promise<IpcResult<DiagnosticsReport>>;

  checkForUpdates(): Promise<IpcResult<UpdateState>>;
  applyUpdate(): Promise<IpcResult>;
  onUpdateState(h: (state: UpdateState) => void): () => void;

  quit(): Promise<void>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  platform(): Promise<IpcResult<{ platform: string; isWindows: boolean }>>;
  openExternal(url: string): Promise<IpcResult>;
  pickDirectory(): Promise<IpcResult<string | null>>;
}

declare global {
  interface Window {
    llsgc: LLSGCApi;
  }
}

export {};
