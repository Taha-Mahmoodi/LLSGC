import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  HostEntry,
  HostEntryInput,
  HostsInfo,
} from '../../shared/types';

export const HOSTS_PATH =
  process.platform === 'win32'
    ? path.join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'drivers',
        'etc',
        'hosts',
      )
    : '/etc/hosts';

const PREAMBLE_MARKER = '# ====== LLSGC managed entries below ======';
const PROTECTED_HOSTS = new Set(['localhost', 'broadcasthost']);

interface ParsedFile {
  preamble: string;
  entries: HostEntry[];
  raw: string;
}

export async function readHosts(): Promise<HostsInfo> {
  if (!existsSync(HOSTS_PATH)) {
    return {
      path: HOSTS_PATH,
      writable: false,
      preamble: '',
      entries: [],
    };
  }
  const raw = await fs.readFile(HOSTS_PATH, 'utf-8');
  const parsed = parseHosts(raw);
  return {
    path: HOSTS_PATH,
    writable: await canWrite(),
    preamble: parsed.preamble,
    entries: parsed.entries,
  };
}

export async function saveHostEntry(
  input: HostEntryInput,
): Promise<{ ok: boolean; entry?: HostEntry; error?: string }> {
  if (!input?.ip?.trim()) return { ok: false, error: 'IP is required' };
  if (!input?.hostnames?.length) {
    return { ok: false, error: 'At least one hostname is required' };
  }
  if (!isValidIp(input.ip.trim())) {
    return { ok: false, error: `"${input.ip}" is not a valid IPv4 / IPv6 address` };
  }
  const normalizedHostnames = input.hostnames
    .map(h => h.trim())
    .filter(Boolean);
  if (normalizedHostnames.length === 0) {
    return { ok: false, error: 'At least one valid hostname is required' };
  }

  let parsed: ParsedFile;
  try {
    parsed = parseHosts(await fs.readFile(HOSTS_PATH, 'utf-8'));
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      parsed = { preamble: '', entries: [], raw: '' };
    } else {
      return { ok: false, error: err.message };
    }
  }

  const id = input.id ?? `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const next: HostEntry = {
    id,
    ip: input.ip.trim(),
    hostnames: normalizedHostnames,
    enabled: input.enabled ?? true,
    comment: input.comment?.trim() || undefined,
    source: 'user',
  };
  const idx = parsed.entries.findIndex(e => e.id === id);
  if (idx >= 0) parsed.entries[idx] = next;
  else parsed.entries.push(next);

  const writeResult = await writeHosts(parsed);
  if (!writeResult.ok) return writeResult;
  return { ok: true, entry: next };
}

export async function removeHostEntry(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  let parsed: ParsedFile;
  try {
    parsed = parseHosts(await fs.readFile(HOSTS_PATH, 'utf-8'));
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
  const target = parsed.entries.find(e => e.id === id);
  if (!target) return { ok: false, error: 'Entry not found' };
  if (
    target.source === 'system' ||
    target.hostnames.some(h => PROTECTED_HOSTS.has(h.toLowerCase()))
  ) {
    return { ok: false, error: 'Cannot remove system entry (localhost / broadcasthost)' };
  }
  parsed.entries = parsed.entries.filter(e => e.id !== id);
  return writeHosts(parsed);
}

export async function toggleHostEntry(
  id: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  let parsed: ParsedFile;
  try {
    parsed = parseHosts(await fs.readFile(HOSTS_PATH, 'utf-8'));
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
  const target = parsed.entries.find(e => e.id === id);
  if (!target) return { ok: false, error: 'Entry not found' };
  if (target.source === 'system') {
    return { ok: false, error: 'Cannot disable system entries' };
  }
  target.enabled = enabled;
  return writeHosts(parsed);
}

async function canWrite(): Promise<boolean> {
  try {
    await fs.access(HOSTS_PATH, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeHosts(parsed: ParsedFile): Promise<{ ok: boolean; error?: string }> {
  const text = serializeHosts(parsed);
  try {
    await fs.writeFile(HOSTS_PATH, text, 'utf-8');
    return { ok: true };
  } catch (err: any) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return {
        ok: false,
        error:
          'Administrator privileges required to modify the hosts file. Right-click llsgc-server.exe and choose "Run as Administrator".',
      };
    }
    return { ok: false, error: err.message ?? String(err) };
  }
}

function parseHosts(raw: string): ParsedFile {
  const lines = raw.split(/\r?\n/);
  const preambleLines: string[] = [];
  const entries: HostEntry[] = [];
  let collectingPreamble = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(PREAMBLE_MARKER)) {
      collectingPreamble = false;
      continue;
    }
    const parsed = tryParseEntry(line, i);
    if (parsed) {
      entries.push(parsed);
      collectingPreamble = false;
    } else if (collectingPreamble) {
      preambleLines.push(line);
    }
  }

  // Mark loopback / system-defined entries
  for (const e of entries) {
    if (e.hostnames.some(h => PROTECTED_HOSTS.has(h.toLowerCase()))) {
      e.source = 'system';
    } else {
      e.source = e.source ?? 'user';
    }
  }

  return {
    preamble: preambleLines.join('\n').replace(/\n+$/, ''),
    entries,
    raw,
  };
}

function tryParseEntry(line: string, idx: number): HostEntry | null {
  let stripped = line.trim();
  if (!stripped) return null;

  let enabled = true;
  if (stripped.startsWith('#')) {
    const after = stripped.replace(/^#+\s*/, '');
    const probe = after.split(/\s+/);
    if (probe.length >= 2 && isValidIp(probe[0])) {
      enabled = false;
      stripped = after;
    } else {
      return null;
    }
  }

  const commentSplit = stripped.split('#');
  const main = commentSplit[0].trim();
  const comment = commentSplit.slice(1).join('#').trim() || undefined;
  const parts = main.split(/\s+/);
  if (parts.length < 2) return null;
  const ip = parts[0];
  if (!isValidIp(ip)) return null;
  const hostnames = parts.slice(1);
  return {
    id: `h-${idx}-${hash(line)}`,
    ip,
    hostnames,
    enabled,
    comment,
  };
}

function serializeHosts(parsed: ParsedFile): string {
  const eol = process.platform === 'win32' ? '\r\n' : '\n';
  const out: string[] = [];

  if (parsed.preamble.trim()) {
    out.push(parsed.preamble.trim());
    out.push('');
  }

  out.push(PREAMBLE_MARKER);
  out.push(`# Last edited: ${new Date().toISOString()} by LLSGC`);
  out.push('# Each entry: <IP> <hostname> [hostname...]   # optional comment');
  out.push('');

  for (const e of parsed.entries) {
    const prefix = e.enabled ? '' : '# ';
    let line = `${prefix}${e.ip}\t${e.hostnames.join(' ')}`;
    if (e.comment) line += `\t# ${e.comment}`;
    out.push(line);
  }

  return out.join(eol) + eol;
}

function isValidIp(s: string): boolean {
  if (!s) return false;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s)) {
    return s.split('.').every(part => {
      const n = parseInt(part, 10);
      return n >= 0 && n <= 255;
    });
  }
  if (/^[0-9a-fA-F:]+$/.test(s) && s.includes(':') && s.length >= 3) return true;
  return false;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}
