import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { CustomServer, LogLine } from '../../shared/types';
import { store, newId } from './store';
import { killPid } from './process-killer';

const MAX_LOG_LINES = 500;

interface RunningEntry {
  child: ChildProcessWithoutNullStreams;
  startedAt: number;
}

class CustomManager extends EventEmitter {
  private running = new Map<string, RunningEntry>();
  private logs = new Map<string, LogLine[]>();

  list(): CustomServer[] {
    return store.listCustom().map(c => this.hydrate(c));
  }

  save(input: Partial<CustomServer> & { name: string; command: string }): CustomServer {
    const sanitized = {
      id: input.id,
      name: input.name.trim(),
      command: input.command.trim(),
      args: input.args ?? [],
      cwd: input.cwd ?? '',
      env: input.env ?? {},
      port: input.port,
      url: input.url,
      color: input.color,
      autoStart: input.autoStart ?? false,
      lastExitCode: input.lastExitCode ?? null,
      lastExitedAt: input.lastExitedAt,
    };
    const saved = store.saveCustom(sanitized);
    return this.hydrate(saved);
  }

  remove(id: string): boolean {
    if (this.running.has(id)) {
      this.stop(id).catch(() => undefined);
    }
    this.logs.delete(id);
    return store.removeCustom(id);
  }

  async start(id: string): Promise<{ ok: boolean; error?: string; pid?: number }> {
    const list = store.listCustom();
    const entry = list.find(c => c.id === id);
    if (!entry) return { ok: false, error: 'Custom server not found' };
    if (this.running.has(id)) {
      return { ok: false, error: 'Already running' };
    }
    const cwd = entry.cwd && entry.cwd.length ? entry.cwd : process.cwd();
    const env = { ...process.env, ...entry.env };
    try {
      const useShell = !entry.args || entry.args.length === 0;
      const child = spawn(entry.command, entry.args ?? [], {
        cwd,
        env,
        shell: useShell,
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams;

      this.appendLog(id, 'system', `▶ ${entry.command}${entry.args?.length ? ' ' + entry.args.join(' ') : ''}`);
      this.appendLog(id, 'system', `cwd: ${cwd}`);

      child.stdout?.setEncoding('utf-8');
      child.stderr?.setEncoding('utf-8');

      child.stdout?.on('data', (chunk: string) => {
        for (const line of splitLines(chunk)) {
          this.appendLog(id, 'stdout', line);
        }
      });
      child.stderr?.on('data', (chunk: string) => {
        for (const line of splitLines(chunk)) {
          this.appendLog(id, 'stderr', line);
        }
      });

      child.on('error', err => {
        this.appendLog(id, 'system', `error: ${err.message}`);
        store.setCustomRuntime(id, {
          status: 'crashed',
          pid: undefined,
          lastExitCode: -1,
          lastExitedAt: Date.now(),
        });
        this.running.delete(id);
        this.emit('status', this.list());
      });

      child.on('exit', (code, signal) => {
        this.appendLog(id, 'system', `✖ exited (code=${code ?? 'null'}${signal ? ', signal=' + signal : ''})`);
        store.setCustomRuntime(id, {
          status: code === 0 ? 'stopped' : 'crashed',
          pid: undefined,
          lastExitCode: code,
          lastExitedAt: Date.now(),
        });
        this.running.delete(id);
        this.emit('status', this.list());
      });

      const startedAt = Date.now();
      this.running.set(id, { child, startedAt });
      store.setCustomRuntime(id, {
        status: 'running',
        pid: child.pid,
        startedAt,
      });
      this.emit('status', this.list());
      return { ok: true, pid: child.pid };
    } catch (err: any) {
      this.appendLog(id, 'system', `failed to spawn: ${err.message}`);
      store.setCustomRuntime(id, {
        status: 'crashed',
        pid: undefined,
        lastExitCode: -1,
        lastExitedAt: Date.now(),
      });
      this.emit('status', this.list());
      return { ok: false, error: err.message };
    }
  }

  async stop(id: string): Promise<{ ok: boolean; error?: string }> {
    const running = this.running.get(id);
    if (!running) return { ok: false, error: 'Not running' };
    const pid = running.child.pid;
    if (!pid) return { ok: false, error: 'No PID' };
    const result = await killPid(pid, false);
    return result;
  }

  async restart(id: string): Promise<{ ok: boolean; error?: string }> {
    const running = this.running.get(id);
    if (running) {
      await this.stop(id);
      await waitFor(() => !this.running.has(id), 4000, 100);
    }
    const start = await this.start(id);
    return { ok: start.ok, error: start.error };
  }

  getLogs(id: string): LogLine[] {
    return [...(this.logs.get(id) ?? [])];
  }

  clearLogs(id: string) {
    this.logs.set(id, []);
  }

  autoStartAll() {
    const list = store.listCustom();
    for (const entry of list) {
      if (entry.autoStart) {
        this.start(entry.id).catch(err =>
          console.error(`[custom-manager] autostart ${entry.name} failed`, err),
        );
      }
    }
  }

  shutdown() {
    for (const [id, { child }] of this.running.entries()) {
      try {
        child.kill('SIGTERM');
        if (child.pid) killPid(child.pid, true).catch(() => undefined);
      } catch {
        /* ignore */
      }
      this.running.delete(id);
    }
  }

  private hydrate(c: CustomServer): CustomServer {
    const running = this.running.get(c.id);
    if (running) {
      return {
        ...c,
        status: 'running',
        pid: running.child.pid,
        startedAt: running.startedAt,
      };
    }
    return c;
  }

  private appendLog(id: string, stream: LogLine['stream'], text: string) {
    const arr = this.logs.get(id) ?? [];
    const line: LogLine = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customId: id,
      stream,
      text,
      ts: Date.now(),
    };
    arr.push(line);
    if (arr.length > MAX_LOG_LINES) arr.splice(0, arr.length - MAX_LOG_LINES);
    this.logs.set(id, arr);
    this.emit('log', line);
  }
}

function splitLines(chunk: string): string[] {
  return chunk
    .replace(/\r/g, '')
    .split('\n')
    .filter(l => l.length > 0);
}

async function waitFor(predicate: () => boolean, timeoutMs: number, stepMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise(r => setTimeout(r, stepMs));
  }
  return false;
}

export const customManager = new CustomManager();
export { newId };
