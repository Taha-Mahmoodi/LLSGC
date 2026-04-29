import os from 'node:os';

export interface LocalAddress {
  family: 'IPv4' | 'IPv6';
  address: string;
  internal: boolean;
  interface: string;
  primary?: boolean;
}

const CACHE_TTL_MS = 30_000;
let cache: { addresses: LocalAddress[]; ts: number } | null = null;

export function getLocalAddresses(): LocalAddress[] {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.addresses;

  const out: LocalAddress[] = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const a of addrs) {
      out.push({
        family: a.family === 'IPv6' ? 'IPv6' : 'IPv4',
        address: a.address,
        internal: a.internal,
        interface: name,
      });
    }
  }
  // Mark the most likely "primary" LAN address: first non-internal IPv4
  // on an interface that doesn't look like a virtual / VPN adapter.
  const primary = out.find(
    a =>
      a.family === 'IPv4' &&
      !a.internal &&
      !/(virtualbox|vmware|wsl|docker|loopback|hyper-v|tunneling|tailscale)/i.test(a.interface),
  );
  if (primary) primary.primary = true;

  cache = { addresses: out, ts: now };
  return out;
}

export function getLocalIPv4Addresses(): string[] {
  return getLocalAddresses()
    .filter(a => a.family === 'IPv4' && !a.internal)
    .map(a => a.address);
}

export function getPrimaryIPv4(): string | null {
  return getLocalAddresses().find(a => a.primary)?.address ?? null;
}

/**
 * For a server bound to `address:port`, return every URL a browser
 * could realistically open to reach it.
 *
 *  - 0.0.0.0 / :: / *  → localhost + 127.0.0.1 + every external IPv4
 *  - 127.0.0.1 / ::1   → localhost + the loopback itself
 *  - specific IP       → that one URL
 */
export function reachableUrls(
  address: string,
  port: number,
  protocol: string,
): string[] {
  if (protocol !== 'tcp') return [];
  const all = address === '0.0.0.0' || address === '::' || address === '*';
  const loopback = address === '127.0.0.1' || address === '::1';

  const urls = new Set<string>();
  if (all || loopback) {
    urls.add(`http://localhost:${port}`);
    urls.add(`http://127.0.0.1:${port}`);
  }
  if (all) {
    for (const ip of getLocalIPv4Addresses()) {
      urls.add(`http://${ip}:${port}`);
    }
  }
  if (!all && !loopback) {
    urls.add(`http://${address}:${port}`);
  }
  return [...urls];
}
