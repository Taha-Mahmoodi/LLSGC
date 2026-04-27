import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Protocol } from '../../shared/types';

const execAsync = promisify(exec);

export interface ListeningPort {
  port: number;
  protocol: Protocol;
  address: string;
  pid: number;
  state: string;
}

export async function scanListeningPorts(): Promise<ListeningPort[]> {
  if (process.platform === 'win32') return scanWindows();
  return scanUnix();
}

async function scanWindows(): Promise<ListeningPort[]> {
  const results: ListeningPort[] = [];
  await Promise.all([
    scanWindowsProto('TCP', results),
    scanWindowsProto('UDP', results),
  ]);
  return dedupe(results);
}

async function scanWindowsProto(proto: 'TCP' | 'UDP', results: ListeningPort[]) {
  try {
    const { stdout } = await execAsync(`netstat -ano -p ${proto}`, {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith(proto)) continue;
      const parts = trimmed.split(/\s+/);
      if (proto === 'TCP') {
        if (parts.length < 5) continue;
        const [, local, , state, pidStr] = parts;
        if (state !== 'LISTENING') continue;
        const parsed = parseEndpoint(local);
        if (!parsed) continue;
        const pid = parseInt(pidStr, 10);
        if (!pid || pid <= 0) continue;
        results.push({ ...parsed, protocol: 'tcp', pid, state });
      } else {
        if (parts.length < 4) continue;
        const [, local, , pidStr] = parts;
        const parsed = parseEndpoint(local);
        if (!parsed) continue;
        const pid = parseInt(pidStr, 10);
        if (!pid || pid <= 0) continue;
        results.push({ ...parsed, protocol: 'udp', pid, state: 'LISTENING' });
      }
    }
  } catch (err) {
    console.error(`[port-scanner] ${proto} scan failed`, err);
  }
}

async function scanUnix(): Promise<ListeningPort[]> {
  const results: ListeningPort[] = [];
  try {
    const { stdout } = await execAsync('lsof -nP -iTCP -sTCP:LISTEN -F pcn', {
      maxBuffer: 4 * 1024 * 1024,
    });
    let curPid = 0;
    let curName = '';
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      const tag = line[0];
      const value = line.slice(1);
      if (tag === 'p') {
        curPid = parseInt(value, 10);
        curName = '';
      } else if (tag === 'c') {
        curName = value;
      } else if (tag === 'n') {
        const parsed = parseEndpoint(value.split('->')[0]);
        if (!parsed || !curPid) continue;
        results.push({ ...parsed, protocol: 'tcp', pid: curPid, state: 'LISTENING' });
      }
    }
  } catch (err) {
    try {
      const { stdout } = await execAsync('ss -tlnpH', { maxBuffer: 4 * 1024 * 1024 });
      for (const line of stdout.split('\n')) {
        const m = line.match(/(\S+:\d+).*pid=(\d+)/);
        if (!m) continue;
        const parsed = parseEndpoint(m[1]);
        if (!parsed) continue;
        results.push({ ...parsed, protocol: 'tcp', pid: parseInt(m[2], 10), state: 'LISTENING' });
      }
    } catch (err2) {
      console.error('[port-scanner] unix scan failed', err2);
    }
  }
  return dedupe(results);
}

function parseEndpoint(raw: string): { port: number; address: string } | null {
  if (!raw) return null;
  const lastColon = raw.lastIndexOf(':');
  if (lastColon < 0) return null;
  const portPart = raw.slice(lastColon + 1);
  const port = parseInt(portPart, 10);
  if (!port || port < 0 || port > 65535) return null;
  let address = raw.slice(0, lastColon);
  address = address.replace(/^\[|\]$/g, '');
  if (address === '0.0.0.0' || address === '::' || address === '*') {
    address = '0.0.0.0';
  }
  return { port, address };
}

function dedupe(items: ListeningPort[]): ListeningPort[] {
  const map = new Map<string, ListeningPort>();
  for (const item of items) {
    const key = `${item.protocol}:${item.port}:${item.pid}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}
