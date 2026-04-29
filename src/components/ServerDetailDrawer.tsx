import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Cpu,
  HardDrive,
  Square,
  Globe,
  Copy,
  Folder,
  X,
  Clock,
  Hash,
  Activity,
  QrCode,
} from 'lucide-react';
import type {
  DetectedServer,
  HttpProbeResult,
  ProcessDetails,
} from '../../shared/types';
import { Sparkline } from './Sparkline';
import { QrModal } from './QrModal';
import { api, callOk } from '../lib/api';
import { useStore } from '../lib/store';
import {
  cn,
  formatBytes,
  formatDuration,
  formatPercent,
  isLikelyHttp,
  shortenCommand,
} from '../lib/utils';

const EMPTY_HISTORY: number[] = [];

export function ServerDetailDrawer({
  server,
  onClose,
}: {
  server: DetectedServer | null;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<ProcessDetails | null>(null);
  const [probeResult, setProbeResult] = useState<HttpProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const pid = server?.pid;
  const history = useStore(s =>
    pid != null ? s.serverHistory.get(pid) ?? EMPTY_HISTORY : EMPTY_HISTORY,
  );

  const runProbe = async (url: string) => {
    setProbing(true);
    const r = await api.probeUrl(url, { timeoutMs: 4000 });
    if (r.ok && r.data) setProbeResult(r.data);
    setProbing(false);
  };

  useEffect(() => {
    setDetails(null);
    setProbeResult(null);
    if (!server) return;
    let alive = true;
    api.serverDetails(server.pid).then(r => {
      if (!alive) return;
      if (r.ok && r.data) setDetails(r.data);
    });
    return () => {
      alive = false;
    };
  }, [server?.pid]);

  return (
    <>
      <AnimatePresence>
        {server && (
          <motion.div
            key="server-drawer-backdrop"
            className="absolute inset-0 z-10 bg-black/40 backdrop-blur-xs"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {server && (
          <motion.aside
            key="server-drawer"
            className="absolute right-0 top-0 z-20 flex h-full w-[420px] flex-col border-l border-border bg-bg-elev shadow-glow"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-fg-subtle">
                  Process detail
                </div>
                <div className="mt-1 text-base font-semibold">{server.name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-fg-muted">
                  pid {server.pid} · {server.protocol.toUpperCase()} {server.address}:{server.port}
                </div>
              </div>
              <button onClick={onClose} className="row-action -mr-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="CPU" icon={<Cpu className="h-3.5 w-3.5" />}>
                  <div className="text-lg font-semibold tabular-nums">
                    {formatPercent(server.cpu)}
                  </div>
                  <Sparkline data={history} width={140} height={28} max={100} />
                </Metric>
                <Metric label="Memory" icon={<HardDrive className="h-3.5 w-3.5" />}>
                  <div className="text-lg font-semibold tabular-nums">
                    {formatBytes(server.memoryBytes)}
                  </div>
                  <div className="text-[11px] text-fg-subtle">
                    Resident set size
                  </div>
                </Metric>
                <Metric label="Uptime" icon={<Clock className="h-3.5 w-3.5" />}>
                  <div className="text-lg font-semibold tabular-nums">
                    {formatDuration(server.uptimeSec)}
                  </div>
                  <div className="text-[11px] text-fg-subtle">
                    started {new Date(server.startedAt).toLocaleTimeString()}
                  </div>
                </Metric>
                <Metric label="PID" icon={<Hash className="h-3.5 w-3.5" />}>
                  <div className="font-mono text-lg tabular-nums">
                    {server.pid}
                  </div>
                  <div className="text-[11px] text-fg-subtle">
                    {server.protocol.toUpperCase()}
                  </div>
                </Metric>
              </div>

              <Section
                title={
                  server.urls && server.urls.length > 1
                    ? `Endpoints (${server.urls.length})`
                    : 'Endpoint'
                }
              >
                {(
                  (server.urls && server.urls.length > 0
                    ? server.urls
                    : server.url
                    ? [server.url]
                    : []) as string[]
                ).map((u: string) => {
                  const host = (() => {
                    try {
                      return new URL(u).hostname;
                    } catch {
                      return u;
                    }
                  })();
                  const tag =
                    host === 'localhost' || host === '127.0.0.1'
                      ? 'local'
                      : host === '::1'
                      ? 'local'
                      : 'LAN';
                  return (
                    <div
                      key={u}
                      className="mb-1.5 flex items-center gap-1 rounded-md border border-border bg-bg-panel px-2 py-1.5 hover:border-border-strong"
                    >
                      <span
                        className={
                          tag === 'LAN'
                            ? 'pill pill-warn shrink-0'
                            : 'pill pill-running shrink-0'
                        }
                      >
                        {tag}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-[12px] cursor-pointer"
                        title="Open in browser"
                        onClick={() => api.openServer(u)}
                      >
                        {u}
                      </span>
                      <button
                        onClick={() => setQrUrl(u)}
                        className="row-action h-7 w-7"
                        title="QR code (scan from phone)"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => callOk(api.copyText(u), 'URL copied')}
                        className="row-action h-7 w-7"
                        title="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => api.openServer(u)}
                        className="row-action h-7 w-7"
                        title="Open"
                      >
                        <Globe className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-fg-muted">
                  <div>
                    <div className="text-fg-subtle">Bind address</div>
                    <div className="font-mono text-fg">{server.address}</div>
                  </div>
                  <div>
                    <div className="text-fg-subtle">Port</div>
                    <div className="font-mono text-fg">{server.port}</div>
                  </div>
                </div>
              </Section>

              {server.url && isLikelyHttp(server.port) && (
                <Section title="HTTP probe">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={probing}
                      onClick={() => runProbe(server.url!)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-panel px-3 py-1.5 text-xs hover:border-border-strong disabled:opacity-50"
                    >
                      <Activity className={cn('h-3.5 w-3.5', probing && 'animate-pulse')} />
                      {probing ? 'Probing…' : probeResult ? 'Probe again' : 'Send GET request'}
                    </button>
                    {probeResult && (
                      <span className="text-[11px] text-fg-subtle font-mono">
                        {probeResult.durationMs} ms
                      </span>
                    )}
                  </div>
                  {probeResult && (
                    <div
                      className={cn(
                        'mt-2 rounded-md border px-3 py-2 text-[11px] font-mono',
                        probeResult.ok
                          ? 'border-ok/30 bg-ok/5'
                          : probeResult.error
                          ? 'border-err/30 bg-err/5'
                          : 'border-warn/30 bg-warn/5',
                      )}
                    >
                      {probeResult.error ? (
                        <div className="text-err break-all">
                          <span className="font-semibold">Error:</span> {probeResult.error}
                        </div>
                      ) : (
                        <>
                          <div className={cn(probeResult.ok ? 'text-ok' : 'text-warn')}>
                            <span className="font-semibold">{probeResult.status}</span>{' '}
                            {probeResult.statusText}
                          </div>
                          {probeResult.contentType && (
                            <div className="text-fg-muted mt-1">
                              {probeResult.contentType}
                              {probeResult.contentLength != null &&
                                ` · ${formatBytes(probeResult.contentLength)}`}
                            </div>
                          )}
                          {probeResult.redirected && probeResult.finalUrl && (
                            <div className="text-fg-muted mt-1 break-all">
                              → {probeResult.finalUrl}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {(details?.command || server.command) && (
                <Section title="Command line">
                  <div className="rounded-md border border-border bg-bg-base/40 px-3 py-2 font-mono text-[11px] text-fg-muted whitespace-pre-wrap break-all">
                    {shortenCommand(details?.command || server.command, 4000)}
                  </div>
                </Section>
              )}

              {details?.executable && (
                <Section title="Executable">
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-base/40 px-3 py-2 text-[11px]">
                    <span className="truncate font-mono text-fg-muted">
                      {details.executable}
                    </span>
                    <button
                      className="row-action"
                      onClick={() => api.revealLocation(details.executable!)}
                    >
                      <Folder className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Section>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border bg-bg-base/40 px-5 py-3">
              {server.url && (
                <>
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-bg-panel px-3 py-2 text-xs hover:border-border-strong"
                    onClick={() => api.openServer(server.url!)}
                  >
                    <Globe className="h-3.5 w-3.5" /> Open
                  </button>
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-bg-panel px-3 py-2 text-xs hover:border-border-strong"
                    onClick={() => callOk(api.copyText(server.url!), 'URL copied')}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </>
              )}
              <button
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-err/30 bg-err/10 text-err px-3 py-2 text-xs hover:bg-err/15"
                onClick={async () => {
                  await callOk(
                    api.killServer(server.pid),
                    `Stopped ${server.name}`,
                    'Failed to stop',
                  );
                  onClose();
                }}
              >
                <Square className="h-3.5 w-3.5" /> Stop
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <QrModal open={!!qrUrl} url={qrUrl} onOpenChange={v => !v && setQrUrl(null)} />
    </>
  );
}

function Metric({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-panel p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        {title}
      </div>
      {children}
    </div>
  );
}
