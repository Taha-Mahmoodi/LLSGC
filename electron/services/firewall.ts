import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { FirewallRule } from '../../shared/types';

const execAsync = promisify(exec);

const MANAGED_PREFIX = 'LLSGC: ';

export interface FirewallBlockInput {
  port: number;
  protocol: 'TCP' | 'UDP' | 'Any';
  direction: 'in' | 'out' | 'both';
}

export async function listFirewallRules(): Promise<FirewallRule[]> {
  if (process.platform !== 'win32') return [];
  try {
    const { stdout } = await execAsync(
      'netsh advfirewall firewall show rule name=all verbose',
      {
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        timeout: 12000,
      },
    );
    return parseNetshRules(stdout);
  } catch (err) {
    console.error('[firewall] list failed', err);
    return [];
  }
}

export async function blockPort(input: FirewallBlockInput): Promise<{ ok: boolean; ruleNames: string[]; error?: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, ruleNames: [], error: 'Firewall control is only supported on Windows.' };
  }
  const dirs: Array<'in' | 'out'> =
    input.direction === 'both' ? ['in', 'out'] : [input.direction];
  const ruleNames: string[] = [];
  for (const dir of dirs) {
    const name = `${MANAGED_PREFIX}Block ${input.protocol} ${input.port} ${dir.toUpperCase()}`;
    const cmd = `netsh advfirewall firewall add rule name="${name}" dir=${dir} action=block protocol=${input.protocol} localport=${input.port}`;
    try {
      await execAsync(cmd, { windowsHide: true, timeout: 8000 });
      ruleNames.push(name);
    } catch (err: any) {
      const error = extractError(err);
      if (error.toLowerCase().includes('elevation')) {
        return { ok: false, ruleNames, error: 'Administrator privileges required to modify firewall rules.' };
      }
      return { ok: false, ruleNames, error };
    }
  }
  return { ok: true, ruleNames };
}

export async function unblockByRuleName(name: string): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Firewall control is only supported on Windows.' };
  }
  try {
    await execAsync(`netsh advfirewall firewall delete rule name="${name}"`, {
      windowsHide: true,
      timeout: 8000,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: extractError(err) };
  }
}

export async function setRuleEnabled(name: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Firewall control is only supported on Windows.' };
  }
  try {
    await execAsync(
      `netsh advfirewall firewall set rule name="${name}" new enable=${enabled ? 'yes' : 'no'}`,
      { windowsHide: true, timeout: 8000 },
    );
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: extractError(err) };
  }
}

function parseNetshRules(text: string): FirewallRule[] {
  const blocks = text.split(/\r?\n\r?\n/);
  const rules: FirewallRule[] = [];
  for (const block of blocks) {
    if (!/^Rule Name:/m.test(block)) continue;
    const name = field(block, 'Rule Name');
    if (!name) continue;
    const enabled = field(block, 'Enabled')?.toLowerCase() === 'yes';
    const dirRaw = field(block, 'Direction')?.toLowerCase() ?? '';
    const direction: 'in' | 'out' = dirRaw.startsWith('out') ? 'out' : 'in';
    const action = (field(block, 'Action') ?? '').toLowerCase().includes('block') ? 'block' : 'allow';
    const protocol = field(block, 'Protocol') ?? 'Any';
    const localPort = field(block, 'LocalPort') ?? 'Any';
    rules.push({
      name,
      enabled,
      direction,
      action,
      protocol,
      localPort,
      managed: name.startsWith(MANAGED_PREFIX),
    });
  }
  return rules;
}

function field(block: string, label: string): string | null {
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'mi');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function extractError(err: any): string {
  const text = err?.stderr || err?.message || String(err);
  return String(text).trim().slice(0, 240);
}
