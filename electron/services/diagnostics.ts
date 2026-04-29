import {
  DiagnosticResult,
  DiagnosticsReport,
} from '../../shared/types';
import { readHosts } from './hosts';
import { listFirewallRules } from './firewall';
import { customManager } from './custom-manager';
import { scanListeningPorts } from './port-scanner';

/**
 * Run a battery of cheap, read-only checks and return a list of
 * results. Each result is one of: ok / info / warn / error, with a
 * fixHint suggesting what to do next.
 */
export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const start = Date.now();
  const results: DiagnosticResult[] = [];
  const checks: Array<Promise<DiagnosticResult[]>> = [
    checkHosts(),
    checkFirewall(),
    checkLaunchers(),
    checkPortConflicts(),
    checkLoopbackBindings(),
  ];
  for (const r of await Promise.allSettled(checks)) {
    if (r.status === 'fulfilled') results.push(...r.value);
    else
      results.push({
        id: `internal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        category: 'Internal',
        title: 'Diagnostic check failed',
        severity: 'error',
        message:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
  }
  return {
    ranAt: start,
    durationMs: Date.now() - start,
    results,
  };
}

async function checkHosts(): Promise<DiagnosticResult[]> {
  const out: DiagnosticResult[] = [];
  try {
    const info = await readHosts();
    if (!info.writable) {
      out.push({
        id: 'hosts-readonly',
        category: 'Hosts file',
        title: 'Hosts file is read-only',
        severity: 'warn',
        message:
          'You can view entries but the app cannot modify them. Required to add or change mappings like 127.0.0.1 myapp.local.',
        fixHint:
          'Right-click LLSGC and choose "Run as administrator" before re-opening the Hosts page.',
        jumpTo: 'hosts',
      });
    }
    // Duplicate hostnames
    const seen = new Map<string, number>();
    for (const e of info.entries) {
      if (!e.enabled) continue;
      for (const h of e.hostnames) {
        const key = h.toLowerCase();
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([h]) => h);
    if (dupes.length > 0) {
      out.push({
        id: 'hosts-duplicates',
        category: 'Hosts file',
        title: `${dupes.length} duplicate hostname${dupes.length > 1 ? 's' : ''}`,
        severity: 'warn',
        message: `These hostnames map to more than one IP: ${dupes
          .slice(0, 5)
          .join(', ')}${dupes.length > 5 ? ` (+${dupes.length - 5} more)` : ''}.`,
        detail:
          'Only the first matching entry takes effect. The others are silently ignored, which can be confusing.',
        fixHint: 'Edit or disable the duplicates on the Hosts page.',
        jumpTo: 'hosts',
      });
    }
    if (out.length === 0) {
      out.push({
        id: 'hosts-ok',
        category: 'Hosts file',
        title: `Hosts file healthy (${info.entries.length} entries)`,
        severity: 'ok',
        message: 'Writable, no duplicate hostnames.',
        jumpTo: 'hosts',
      });
    }
  } catch (err) {
    out.push({
      id: 'hosts-error',
      category: 'Hosts file',
      title: 'Could not read hosts file',
      severity: 'error',
      message: err instanceof Error ? err.message : String(err),
      jumpTo: 'hosts',
    });
  }
  return out;
}

async function checkFirewall(): Promise<DiagnosticResult[]> {
  const out: DiagnosticResult[] = [];
  if (process.platform !== 'win32') {
    out.push({
      id: 'firewall-skipped',
      category: 'Firewall',
      title: 'Firewall checks skipped',
      severity: 'info',
      message:
        'LLSGC only inspects Windows Firewall via netsh. On macOS / Linux this check is a no-op.',
    });
    return out;
  }
  try {
    const rules = await listFirewallRules();
    const managedBlocks = rules.filter(r => r.managed && r.enabled && r.action === 'block');
    const COMMON_DEV = [3000, 3001, 4200, 5173, 5500, 8000, 8080, 8443, 9000];
    const accidentalBlocks = managedBlocks.filter(r => {
      const port = parseInt(r.localPort, 10);
      return COMMON_DEV.includes(port);
    });
    if (accidentalBlocks.length > 0) {
      out.push({
        id: 'firewall-blocked-dev-ports',
        category: 'Firewall',
        title: `${accidentalBlocks.length} common dev port${accidentalBlocks.length > 1 ? 's' : ''} blocked`,
        severity: 'warn',
        message:
          'These ports are blocked by an LLSGC-managed rule and are commonly used by dev servers: ' +
          accidentalBlocks.map(r => r.localPort).join(', '),
        fixHint: 'Open the Firewall page and unblock the rules you no longer need.',
        jumpTo: 'firewall',
      });
    }
    if (out.length === 0) {
      out.push({
        id: 'firewall-ok',
        category: 'Firewall',
        title: `Firewall has ${managedBlocks.length} active block${managedBlocks.length === 1 ? '' : 's'}`,
        severity: 'ok',
        message: 'No common dev ports are accidentally blocked.',
        jumpTo: 'firewall',
      });
    }
  } catch (err) {
    out.push({
      id: 'firewall-error',
      category: 'Firewall',
      title: 'Firewall check failed',
      severity: 'error',
      message: err instanceof Error ? err.message : String(err),
      jumpTo: 'firewall',
    });
  }
  return out;
}

async function checkLaunchers(): Promise<DiagnosticResult[]> {
  const out: DiagnosticResult[] = [];
  const customs = customManager.list();
  const crashed = customs.filter(c => c.status === 'crashed');
  const stale = customs.filter(
    c =>
      c.autoStart &&
      c.status !== 'running' &&
      c.lastExitedAt &&
      Date.now() - c.lastExitedAt > 10_000,
  );
  if (crashed.length > 0) {
    out.push({
      id: 'launchers-crashed',
      category: 'Launchers',
      title: `${crashed.length} launcher${crashed.length > 1 ? 's' : ''} in crashed state`,
      severity: 'error',
      message: crashed.map(c => `"${c.name}" (exit ${c.lastExitCode ?? '?'})`).join(', '),
      fixHint: 'Open Logs to see why the process died, then click Start to retry.',
      jumpTo: 'logs',
    });
  }
  if (stale.length > 0 && stale.length !== crashed.length) {
    out.push({
      id: 'launchers-stale-autostart',
      category: 'Launchers',
      title: `${stale.length} auto-start launcher${stale.length > 1 ? 's' : ''} not running`,
      severity: 'warn',
      message:
        'These launchers have auto-start enabled but exited and never came back: ' +
        stale.map(c => `"${c.name}"`).join(', '),
      fixHint: 'Either disable autostart or fix the underlying error and restart.',
      jumpTo: 'custom',
    });
  }
  if (out.length === 0) {
    out.push({
      id: 'launchers-ok',
      category: 'Launchers',
      title: `Launchers healthy (${customs.length} saved, ${customs.filter(c => c.status === 'running').length} running)`,
      severity: 'ok',
      message: 'Nothing in a crashed state.',
      jumpTo: 'custom',
    });
  }
  return out;
}

async function checkPortConflicts(): Promise<DiagnosticResult[]> {
  const out: DiagnosticResult[] = [];
  try {
    const ports = await scanListeningPorts();
    const byPort = new Map<number, number>();
    for (const p of ports) {
      if (p.protocol === 'tcp') byPort.set(p.port, (byPort.get(p.port) ?? 0) + 1);
    }
    const dupes = [...byPort.entries()].filter(([, n]) => n > 1);
    if (dupes.length > 0) {
      out.push({
        id: 'port-conflicts',
        category: 'Ports',
        title: `${dupes.length} port${dupes.length > 1 ? 's' : ''} bound by multiple processes`,
        severity: 'warn',
        message:
          dupes.map(([p, n]) => `${p} (${n}× listeners)`).join(', '),
        fixHint:
          'IPv4 + IPv6 dual-stack often produces two listeners for the same port — usually fine. If two distinct processes are fighting for one port, stop one.',
        jumpTo: 'servers',
      });
    } else {
      out.push({
        id: 'ports-ok',
        category: 'Ports',
        title: `${ports.length} listener${ports.length === 1 ? '' : 's'} active, no conflicts`,
        severity: 'ok',
        message: 'No two TCP listeners are competing for the same port.',
        jumpTo: 'ports',
      });
    }
  } catch (err) {
    out.push({
      id: 'ports-error',
      category: 'Ports',
      title: 'Port scan failed',
      severity: 'error',
      message: err instanceof Error ? err.message : String(err),
      jumpTo: 'servers',
    });
  }
  return out;
}

async function checkLoopbackBindings(): Promise<DiagnosticResult[]> {
  const out: DiagnosticResult[] = [];
  try {
    const ports = await scanListeningPorts();
    const lanBound = ports.filter(
      p =>
        p.protocol === 'tcp' &&
        (p.address === '0.0.0.0' || p.address === '::') &&
        p.port >= 1024 &&
        p.port <= 49151,
    );
    if (lanBound.length > 0) {
      out.push({
        id: 'lan-exposure',
        category: 'Network',
        title: `${lanBound.length} server${lanBound.length > 1 ? 's' : ''} reachable from the LAN`,
        severity: 'info',
        message:
          'Bound to 0.0.0.0 or :: — anyone on your network can reach these on their respective ports: ' +
          [...new Set(lanBound.map(p => p.port))].slice(0, 12).join(', ') +
          (lanBound.length > 12 ? '…' : ''),
        fixHint:
          'If you only want them local, bind to 127.0.0.1 instead. Otherwise this is fine — useful for testing on your phone.',
        jumpTo: 'servers',
      });
    }
  } catch {
    /* port scan errors already reported by checkPortConflicts */
  }
  return out;
}
