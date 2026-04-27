import { useMemo } from 'react';
import {
  Cpu,
  HardDrive,
  Network,
  Rocket,
  Activity,
  Globe,
  Square,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { ViewKey } from '../components/layout/Sidebar';
import { PageHeader } from '../components/layout/PageHeader';
import { StatTile } from '../components/StatTile';
import { Sparkline } from '../components/Sparkline';
import { Button } from '../components/ui/Button';
import { useStore } from '../lib/store';
import { api, callOk } from '../lib/api';
import {
  cn,
  colorForName,
  formatBytes,
  formatDuration,
  formatPercent,
  isLikelyHttp,
} from '../lib/utils';

export function Dashboard({ onJump }: { onJump: (next: ViewKey) => void }) {
  const stats = useStore(s => s.systemStats);
  const cpuHistory = useStore(s => s.cpuHistory);
  const memHistory = useStore(s => s.memHistory);
  const servers = useStore(s => s.servers);
  const customs = useStore(s => s.customServers);

  const top = useMemo(
    () => [...servers].sort((a, b) => b.cpu - a.cpu).slice(0, 5),
    [servers],
  );

  const runningCustom = customs.filter(c => c.status === 'running').length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of every server bound to a local port."
        actions={
          <Button variant="secondary" size="sm" onClick={() => onJump('servers')}>
            All servers <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <StatTile
            label="CPU"
            icon={<Cpu className="h-3.5 w-3.5" />}
            value={formatPercent(stats?.cpu ?? 0)}
            hint={
              stats
                ? `${stats.cpuCount} cores · ${stats.cpuModel}`
                : 'Loading…'
            }
            data={cpuHistory}
            color="rgb(var(--accent))"
          />
          <StatTile
            label="Memory"
            icon={<HardDrive className="h-3.5 w-3.5" />}
            value={
              stats
                ? `${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`
                : '–'
            }
            hint={
              stats
                ? `${formatPercent(stats.memory.percent)} used`
                : undefined
            }
            data={memHistory}
            color="rgb(var(--ok))"
          />
          <StatTile
            label="Listening servers"
            icon={<Network className="h-3.5 w-3.5" />}
            value={String(servers.length)}
            hint={`${
              new Set(servers.map(s => s.pid)).size
            } unique processes`}
          />
          <StatTile
            label="Active launchers"
            icon={<Rocket className="h-3.5 w-3.5" />}
            value={`${runningCustom} / ${customs.length}`}
            hint="Saved server commands you control."
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="panel xl:col-span-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-fg-subtle">
                  Top servers by CPU
                </div>
                <div className="mt-0.5 text-sm font-medium">
                  Live processes consuming the most resources
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onJump('servers')}>
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {top.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
                No listening servers detected. Start a dev server and it will
                show up here.
              </div>
            ) : (
              <div className="space-y-1.5">
                {top.map(s => {
                  const color = colorForName(s.name);
                  return (
                    <div
                      key={`${s.pid}-${s.port}`}
                      className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-md border border-border bg-bg-panel/50 px-3 py-2"
                    >
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded text-[11px] font-mono font-semibold"
                        style={{
                          backgroundColor: `${color}22`,
                          color,
                        }}
                      >
                        {s.port}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {s.name}
                        </div>
                        <div className="truncate font-mono text-[11px] text-fg-subtle">
                          {s.address}:{s.port} · pid {s.pid}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-fg-muted">
                        <div className="tabular-nums">
                          {formatPercent(s.cpu)}
                        </div>
                        <div className="tabular-nums">
                          {formatBytes(s.memoryBytes)}
                        </div>
                        <div className="tabular-nums">
                          up {formatDuration(s.uptimeSec)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {s.url && isLikelyHttp(s.port) && (
                          <button
                            onClick={() => api.openServer(s.url!)}
                            className="row-action"
                            title="Open in browser"
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            callOk(api.killServer(s.pid), `Stopped ${s.name}`)
                          }
                          className="row-action hover:text-err"
                          title="Stop"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="hidden md:block">
                        <Sparkline
                          data={
                            useStore.getState().serverHistory.get(s.pid) ?? []
                          }
                          width={80}
                          height={22}
                          color={color}
                          max={100}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-fg-subtle">
                  Launchers
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onJump('custom')}
                >
                  Manage
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {customs.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-fg-muted">
                  No saved launchers yet. Add one to start any project with
                  one click.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {customs.slice(0, 5).map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-md border border-border bg-bg-panel/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            c.status === 'running' &&
                              'bg-ok animate-pulse-dot',
                            c.status === 'stopped' && 'bg-fg-subtle',
                            c.status === 'crashed' && 'bg-err',
                          )}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {c.name}
                          </div>
                          <div className="truncate font-mono text-[11px] text-fg-subtle">
                            {c.command}
                          </div>
                        </div>
                      </div>
                      <button
                        className="row-action"
                        onClick={async () => {
                          if (c.status === 'running') {
                            await callOk(
                              api.stopCustom(c.id),
                              `Stopped ${c.name}`,
                            );
                          } else {
                            await callOk(
                              api.startCustom(c.id),
                              `Started ${c.name}`,
                            );
                          }
                        }}
                        title={c.status === 'running' ? 'Stop' : 'Start'}
                      >
                        {c.status === 'running' ? (
                          <Square className="h-3.5 w-3.5" />
                        ) : (
                          <Activity className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel p-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-fg-subtle">
                Quick actions
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onJump('firewall')}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Manage firewall rules
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onJump('logs')}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" />
                  Tail launcher logs
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onJump('settings')}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">Preferences</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
