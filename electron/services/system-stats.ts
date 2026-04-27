import os from 'node:os';
import { SystemStats } from '../../shared/types';

let prevCpuTimes: ReturnType<typeof os.cpus>[number]['times'][] | null = null;

export function getSystemStats(): SystemStats {
  const cpus = os.cpus();
  const cpuPercent = computeCpuPercent(cpus);

  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    cpu: cpuPercent,
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model?.trim() ?? 'Unknown CPU',
    loadAverage: os.loadavg(),
    memory: {
      used,
      total,
      free,
      percent: total > 0 ? (used / total) * 100 : 0,
    },
    uptime: os.uptime(),
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    release: os.release(),
  };
}

function computeCpuPercent(cpus: ReturnType<typeof os.cpus>): number {
  const times = cpus.map(c => ({ ...c.times }));
  if (!prevCpuTimes || prevCpuTimes.length !== times.length) {
    prevCpuTimes = times;
    return 0;
  }
  let totalDelta = 0;
  let idleDelta = 0;
  for (let i = 0; i < times.length; i++) {
    const cur = times[i];
    const prev = prevCpuTimes[i];
    const curTotal = cur.user + cur.nice + cur.sys + cur.idle + cur.irq;
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    totalDelta += curTotal - prevTotal;
    idleDelta += cur.idle - prev.idle;
  }
  prevCpuTimes = times;
  if (totalDelta <= 0) return 0;
  const usage = (1 - idleDelta / totalDelta) * 100;
  return Math.max(0, Math.min(100, usage));
}
