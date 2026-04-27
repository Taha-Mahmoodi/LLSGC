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
} from 'lucide-react';
import type { DetectedServer, ProcessDetails } from '../../shared/types';
import { Sparkline } from './Sparkline';
import { api, callOk } from '../lib/api';
import { useStore } from '../lib/store';
import {
  formatBytes,
  formatDuration,
  formatPercent,
  shortenCommand,
} from '../lib/utils';

export function ServerDetailDrawer({
  server,
  onClose,
}: {
  server: DetectedServer | null;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<ProcessDetails | null>(null);
  const history = useStore(s =>
    server ? s.serverHistory.get(server.pid) ?? [] : [],
  );

  useEffect(() => {
    setDetails(null);
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

              <Section title="Endpoint">
                {server.url && (
                  <button
                    onClick={() => api.openServer(server.url!)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-bg-panel px-3 py-2 text-left text-sm hover:border-border-strong"
                  >
                    <span className="truncate font-mono">{server.url}</span>
                    <Globe className="h-3.5 w-3.5 text-fg-muted" />
                  </button>
                )}
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
