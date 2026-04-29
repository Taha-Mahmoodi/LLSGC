import {
  Cpu,
  Globe,
  Copy,
  Square,
  Info,
  ScrollText,
  RefreshCcw,
  Rocket,
} from 'lucide-react';
import type { CustomServer, DetectedServer } from '../../shared/types';
import { Sparkline } from './Sparkline';
import { Tooltip } from './ui/Tooltip';
import { api, callOk } from '../lib/api';
import { useStore } from '../lib/store';
import {
  cn,
  colorForName,
  formatBytes,
  formatDuration,
  formatPercent,
  isLikelyHttp,
  shortenCommand,
} from '../lib/utils';

export function ServerRow({
  server,
  custom,
  onSelect,
}: {
  server: DetectedServer;
  custom?: CustomServer;
  onSelect: () => void;
}) {
  const history = useStore(s => s.serverHistory.get(server.pid)) ?? [];
  const accent = custom?.color ?? colorForName(server.name);
  const httpish = isLikelyHttp(server.port);

  const onKill = async () => {
    await callOk(api.killServer(server.pid), `Stopped ${server.name}`, 'Failed to stop process');
  };
  const onOpen = async () => {
    if (!server.url) return;
    await callOk(api.openServer(server.url), undefined, 'Failed to open URL');
  };
  const onCopy = async () => {
    if (!server.url) return;
    await callOk(api.copyText(server.url), 'URL copied', 'Failed to copy');
  };
  const onRestart = async () => {
    if (!custom) return;
    await callOk(api.restartCustom(custom.id), `Restarted ${custom.name}`, 'Restart failed');
  };

  return (
    <div
      className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 rounded-lg border border-border bg-bg-elev/60 px-3 py-2.5 transition hover:border-border-strong hover:bg-bg-elev cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md text-[11px] font-mono font-semibold"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {server.port}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="truncate text-sm font-medium">{server.name}</span>
          {custom && (
            <span className="pill pill-running">
              <Rocket className="h-3 w-3" /> launcher
            </span>
          )}
          <span className="pill pill-running">
            <span
              className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse-dot"
              aria-hidden
            />
            listening
          </span>
          {server.urls && server.urls.length > 1 && (
            <span className="pill pill-warn" title="Reachable on the local network too">
              LAN +{server.urls.length - 1}
            </span>
          )}
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-fg-subtle">
          {primaryDisplayUrl(server) ?? `${server.address}:${server.port}`} · {server.protocol.toUpperCase()} · pid {server.pid}
          {server.command && ' · ' + shortenCommand(server.command, 60)}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-fg-muted">
        <Tooltip content={`CPU ${formatPercent(server.cpu)}`}>
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatPercent(server.cpu)}</span>
          </div>
        </Tooltip>
        <Tooltip content={`Memory ${formatBytes(server.memoryBytes)}`}>
          <div className="tabular-nums">{formatBytes(server.memoryBytes)}</div>
        </Tooltip>
      </div>

      <div className="hidden xl:block">
        <Sparkline data={history} width={84} height={28} color={accent} max={100} />
      </div>

      <div className="text-right text-xs text-fg-muted tabular-nums">
        up {formatDuration(server.uptimeSec)}
      </div>

      <div
        className="flex items-center gap-1 opacity-90"
        onClick={e => e.stopPropagation()}
      >
        {server.url && httpish && (
          <Tooltip content="Open in browser">
            <button onClick={onOpen} className="row-action">
              <Globe className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        {server.url && (
          <Tooltip content="Copy URL">
            <button onClick={onCopy} className="row-action">
              <Copy className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        {custom && (
          <Tooltip content="Restart launcher">
            <button onClick={onRestart} className="row-action">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        <Tooltip content="Stop process">
          <button onClick={onKill} className="row-action hover:text-err">
            <Square className="h-4 w-4" />
          </button>
        </Tooltip>
        <Tooltip content="Details">
          <button onClick={onSelect} className="row-action">
            <Info className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function primaryDisplayUrl(server: DetectedServer): string | undefined {
  if (server.urls && server.urls.length > 0) {
    return server.urls[0].replace(/^https?:\/\//, '');
  }
  if (server.url) return server.url.replace(/^https?:\/\//, '');
  return undefined;
}

export function ServerRowHeader() {
  return (
    <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
      <div className="w-9" aria-hidden />
      <div>Process / endpoint</div>
      <div>Resources</div>
      <div className="hidden xl:block">CPU trend</div>
      <div>Uptime</div>
      <div className="text-right">Actions</div>
    </div>
  );
}
