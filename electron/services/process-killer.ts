import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface KillResult {
  ok: boolean;
  error?: string;
}

export async function killPid(pid: number, force = false): Promise<KillResult> {
  if (!pid || pid <= 0) return { ok: false, error: 'Invalid PID' };
  if (process.platform === 'win32') return killWindows(pid, force);
  return killUnix(pid, force);
}

async function killWindows(pid: number, force: boolean): Promise<KillResult> {
  try {
    const flags = force ? '/F /T' : '/T';
    await execAsync(`taskkill ${flags} /PID ${pid}`, {
      windowsHide: true,
      timeout: 5000,
    });
    return { ok: true };
  } catch (err: any) {
    if (!force) return killWindows(pid, true);
    return { ok: false, error: extractError(err) };
  }
}

async function killUnix(pid: number, force: boolean): Promise<KillResult> {
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    return { ok: true };
  } catch (err: any) {
    if (!force) {
      try {
        process.kill(pid, 'SIGKILL');
        return { ok: true };
      } catch (err2: any) {
        return { ok: false, error: err2.message };
      }
    }
    return { ok: false, error: err.message };
  }
}

function extractError(err: any): string {
  const text = err?.stderr || err?.message || String(err);
  return String(text).trim().slice(0, 240);
}
