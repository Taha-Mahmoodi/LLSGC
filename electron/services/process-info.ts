import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import pidusage from 'pidusage';

const execAsync = promisify(exec);

export interface ProcInfo {
  pid: number;
  name: string;
  command?: string;
  executable?: string;
  cpu: number;
  memoryBytes: number;
  startedAt: number;
}

interface MetaEntry {
  name: string;
  command?: string;
  executable?: string;
}

const metaCache = new Map<number, MetaEntry>();
let metaCacheGen = 0;
let lastFullRefresh = 0;
const FULL_REFRESH_INTERVAL = 30_000;

export async function getProcessInfoBatch(pids: number[]): Promise<Map<number, ProcInfo>> {
  const out = new Map<number, ProcInfo>();
  if (pids.length === 0) return out;

  const uniq = [...new Set(pids)].filter(p => p > 0);

  let usage: Record<string, pidusage.Status> = {};
  try {
    usage = (await pidusage(uniq)) as Record<string, pidusage.Status>;
  } catch {
    for (const pid of uniq) {
      try {
        const single = await pidusage(pid);
        usage[String(pid)] = single;
      } catch {
        /* process gone */
      }
    }
  }

  const missing = uniq.filter(p => !metaCache.has(p));
  const now = Date.now();
  if (missing.length > 0 || now - lastFullRefresh > FULL_REFRESH_INTERVAL) {
    await refreshMetaCache(missing);
    lastFullRefresh = now;
  }

  for (const pid of uniq) {
    const u = usage[pid];
    const meta = metaCache.get(pid);
    if (!u) continue;
    const name = meta?.name ?? `pid:${pid}`;
    out.set(pid, {
      pid,
      name,
      command: meta?.command,
      executable: meta?.executable,
      cpu: clampCpu(u.cpu),
      memoryBytes: u.memory ?? 0,
      startedAt: now - (u.elapsed ?? 0),
    });
  }

  return out;
}

export async function getDetails(pid: number): Promise<ProcInfo | null> {
  const map = await getProcessInfoBatch([pid]);
  if (map.has(pid)) return map.get(pid)!;
  await refreshMetaCache([pid], true);
  const map2 = await getProcessInfoBatch([pid]);
  return map2.get(pid) ?? null;
}

function clampCpu(v: number | undefined): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 100 * 64) return 100 * 64;
  return v;
}

async function refreshMetaCache(missingPids: number[], detail = false): Promise<void> {
  if (process.platform === 'win32') {
    await refreshWindows(missingPids, detail);
  } else {
    await refreshUnix(missingPids);
  }
  metaCacheGen++;
}

async function refreshWindows(missing: number[], detail: boolean) {
  if (missing.length > 0 && !detail) {
    try {
      const { stdout } = await execAsync('tasklist /FO CSV /NH', {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      });
      for (const line of stdout.split(/\r?\n/)) {
        const cols = parseCsvLine(line);
        if (cols.length < 2) continue;
        const name = cols[0];
        const pid = parseInt(cols[1], 10);
        if (!pid) continue;
        const prev = metaCache.get(pid);
        metaCache.set(pid, {
          name,
          command: prev?.command,
          executable: prev?.executable,
        });
      }
    } catch (err) {
      console.error('[process-info] tasklist failed', err);
    }
  }

  if (detail || missing.length > 0) {
    const targets = detail ? missing : missing.slice(0, 32);
    if (targets.length === 0) return;
    try {
      const filter = targets.map(p => `ProcessId=${p}`).join(' OR ');
      const cmd = `powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter '${filter}' | Select-Object ProcessId,Name,CommandLine,ExecutablePath | ConvertTo-Json -Compress"`;
      const { stdout } = await execAsync(cmd, {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        timeout: 8000,
      });
      const trimmed = stdout.trim();
      if (!trimmed) return;
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const p of arr) {
        const pid = p.ProcessId;
        if (!pid) continue;
        metaCache.set(pid, {
          name: p.Name ?? `pid:${pid}`,
          command: p.CommandLine ?? undefined,
          executable: p.ExecutablePath ?? undefined,
        });
      }
    } catch (err) {
      // PowerShell can be slow / blocked — silently fall back to tasklist data
    }
  }
}

async function refreshUnix(missing: number[]) {
  for (const pid of missing) {
    try {
      const { stdout } = await execAsync(
        `ps -p ${pid} -o pid=,comm=,args=`,
        { maxBuffer: 1024 * 1024 },
      );
      const line = stdout.trim();
      if (!line) continue;
      const m = line.match(/^\s*\d+\s+(\S+)\s+(.*)$/);
      if (!m) continue;
      metaCache.set(pid, {
        name: m[1],
        command: m[2],
        executable: m[1],
      });
    } catch {
      /* gone */
    }
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  out.push(buf);
  return out;
}

export function pruneDeadPids(alivePids: Set<number>) {
  for (const pid of metaCache.keys()) {
    if (!alivePids.has(pid)) metaCache.delete(pid);
  }
}
