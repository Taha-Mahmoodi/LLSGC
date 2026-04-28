import { scanListeningPorts } from './port-scanner';
import { getProcessInfoBatch } from './process-info';
import {
  CommonPort,
  COMMON_DEV_PORTS,
  PortCheckResult,
} from '../../shared/types';

export async function checkPort(port: number): Promise<PortCheckResult> {
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return { port, busy: false };
  }
  const all = await scanListeningPorts();
  const hit = all.find(p => p.port === port);
  if (!hit) return { port, busy: false };
  const info = (await getProcessInfoBatch([hit.pid])).get(hit.pid);
  return {
    port,
    busy: true,
    pid: hit.pid,
    process: info?.name,
    protocol: hit.protocol,
    address: hit.address,
  };
}

export async function checkPorts(ports: number[]): Promise<PortCheckResult[]> {
  if (!ports.length) return [];
  const all = await scanListeningPorts();
  const map = new Map<number, (typeof all)[number]>();
  for (const p of all) {
    if (!map.has(p.port)) map.set(p.port, p);
  }
  const pids = [...new Set([...map.values()].map(p => p.pid))].filter(
    p => p > 0,
  );
  const proc = await getProcessInfoBatch(pids);
  return ports.map(port => {
    const hit = map.get(port);
    if (!hit) return { port, busy: false };
    const info = proc.get(hit.pid);
    return {
      port,
      busy: true,
      pid: hit.pid,
      process: info?.name,
      protocol: hit.protocol,
      address: hit.address,
    };
  });
}

export function listCommonPorts(): CommonPort[] {
  return COMMON_DEV_PORTS.slice();
}
