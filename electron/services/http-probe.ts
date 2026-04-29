import { HttpProbeResult } from '../../shared/types';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Hit a URL and return status / latency / content-type. Used by the
 * "is this dev server actually responding?" button on the Servers
 * detail drawer. Stays on the loopback most of the time so it's fast,
 * but works for any HTTP(S) URL.
 */
export async function probe(
  url: string,
  options: { timeoutMs?: number; method?: 'GET' | 'HEAD' } = {},
): Promise<HttpProbeResult> {
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = options.method ?? 'GET';
  const ts = start;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'LLSGC/probe',
        Accept: '*/*',
      },
    });
    const durationMs = Date.now() - start;
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    let contentLength: number | undefined;
    const lenHeader = res.headers.get('content-length');
    if (lenHeader) {
      const n = parseInt(lenHeader, 10);
      if (Number.isFinite(n)) contentLength = n;
    }
    return {
      url,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type') ?? undefined,
      contentLength,
      durationMs,
      redirected: res.redirected,
      finalUrl: res.url !== url ? res.url : undefined,
      headers,
      ts,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.toLowerCase().includes('abort');
    return {
      url,
      ok: false,
      durationMs,
      error: isTimeout ? `Timed out after ${timeoutMs}ms` : message,
      ts,
    };
  } finally {
    clearTimeout(timer);
  }
}
