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
  detailFetched?: boolean;
}

const metaCache = new Map<number, MetaEntry>();
let lastListSnapshot = 0;
let pendingListSweep: Promise<void> | null = null;
const LIST_SWEEP_MIN_INTERVAL = 5_000;

export async function getProcessInfoBatch(
  pids: number[],
): Promise<Map<number, ProcInfo>> {
  const out = new Map<number, ProcInfo>();
  if (pids.length === 0) return out;

  const uniq = [...new Set(pids)].filter(p => p > 0);

  let usage: Record<string, pidusage.Status> = {};
  try {
    usage = (await pidusage(uniq)) as Record<string, pidusage.Status>;
  } catch {
    /* one or more processes gone — fall through with empty usage */
  }

  const missing = uniq.filter(p => !metaCache.has(p));
  if (missing.length > 0) {
    await sweepNames();
  }

  const now = Date.now();
  for (const pid of uniq) {
    const u = usage[pid];
    const meta = metaCache.get(pid);
    if (!u) continue;
    out.set(pid, {
      pid,
      name: meta?.name ?? `pid:${pid}`,
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
  const cached = metaCache.get(pid);
  if (!cached?.detailFetched && process.platform === 'win32') {
    await fetchDetailsWindows([pid]);
  }
  const map = await getProcessInfoBatch([pid]);
  return map.get(pid) ?? null;
}

function clampCpu(v: number | undefined): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 100 * 64) return 100 * 64;
  return v;
}

async function sweepNames(): Promise<void> {
  if (pendingListSweep) return pendingListSweep;
  if (Date.now() - lastListSnapshot < LIST_SWEEP_MIN_INTERVAL) return;

  pendingListSweep = (async () => {
    try {
      if (process.platform === 'win32') await sweepTasklist();
      else await sweepUnixPs();
      lastListSnapshot = Date.now();
    } finally {
      pendingListSweep = null;
    }
  })();
  return pendingListSweep;
}

async function sweepTasklist(): Promise<void> {
  try {
    const { stdout } = await execAsync('tasklist /FO CSV /NH', {
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 6000,
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
        detailFetched: prev?.detailFetched,
      });
    }
  } catch (err) {
    console.error('[process-info] tasklist failed', err);
  }
}

async function sweepUnixPs(): Promise<void> {
  try {
    const { stdout } = await execAsync('ps -ax -o pid=,comm=,args=', {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 6000,
    });
    for (const line of stdout.split('\n')) {
      const m = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/);
      if (!m) continue;
      const pid = parseInt(m[1], 10);
      const name = m[2];
      const args = m[3];
      const prev = metaCache.get(pid);
      metaCache.set(pid, {
        name,
        command: prev?.command ?? args,
        executable: prev?.executable ?? name,
        detailFetched: true,
      });
    }
  } catch (err) {
    console.error('[process-info] ps failed', err);
  }
}

async function fetchDetailsWindows(pids: number[]): Promise<void> {
  if (pids.length === 0) return;
  try {
    const filter = pids.map(p => `ProcessId=${p}`).join(' OR ');
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
      const prev = metaCache.get(pid);
      metaCache.set(pid, {
        name: p.Name ?? prev?.name ?? `pid:${pid}`,
        command: p.CommandLine ?? prev?.command,
        executable: p.ExecutablePath ?? prev?.executable,
        detailFetched: true,
      });
    }
  } catch {
    /* PowerShell unavailable / blocked — leave the entry without detail; UI shows what tasklist provided */
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
