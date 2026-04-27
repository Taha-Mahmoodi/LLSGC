import { useState } from 'react';
import {
  Plus,
  Play,
  Square,
  RefreshCcw,
  Pencil,
  Trash2,
  Globe,
  Copy,
  Rocket,
  ScrollText,
} from 'lucide-react';
import type { CustomServer } from '../../shared/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Tooltip } from '../components/ui/Tooltip';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddCustomDialog } from '../components/AddCustomDialog';
import { useStore } from '../lib/store';
import { api, callOk } from '../lib/api';
import {
  cn,
  formatDuration,
  shortenCommand,
} from '../lib/utils';

export function Custom() {
  const customs = useStore(s => s.customServers);
  const setSelectedCustom = useStore(s => s.setSelectedCustom);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CustomServer | null>(null);
  const [removing, setRemoving] = useState<CustomServer | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Launchers"
        description="Pre-saved server commands. Start, stop, restart and tail their logs from one place."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New launcher
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {customs.length === 0 ? (
          <EmptyState
            icon={<Rocket className="h-5 w-5" />}
            title="Save your first launcher"
            description="Define the command, working directory, environment, and optional URL. LLSGC will let you start, stop and restart it with a single click."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setAdding(true);
                }}
              >
                <Plus className="h-4 w-4" /> New launcher
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {customs.map(c => (
              <LauncherCard
                key={c.id}
                custom={c}
                onEdit={() => {
                  setEditing(c);
                  setAdding(true);
                }}
                onRemove={() => setRemoving(c)}
                onLogs={() => setSelectedCustom(c.id)}
              />
            ))}
          </div>
        )}
      </div>
      <AddCustomDialog
        open={adding}
        onOpenChange={setAdding}
        editing={editing}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={v => !v && setRemoving(null)}
        title="Delete launcher?"
        description={
          removing
            ? `"${removing.name}" will be removed. Running process (if any) will be stopped first.`
            : ''
        }
        destructive
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!removing) return;
          await callOk(api.removeCustom(removing.id), 'Launcher removed');
          setRemoving(null);
        }}
      />
    </div>
  );
}

function LauncherCard({
  custom,
  onEdit,
  onRemove,
  onLogs,
}: {
  custom: CustomServer;
  onEdit: () => void;
  onRemove: () => void;
  onLogs: () => void;
}) {
  const isRunning = custom.status === 'running';
  const accent = custom.color ?? '#7da6ff';

  const onStart = () =>
    callOk(api.startCustom(custom.id), `Started ${custom.name}`, 'Start failed');
  const onStop = () =>
    callOk(api.stopCustom(custom.id), `Stopped ${custom.name}`, 'Stop failed');
  const onRestart = () =>
    callOk(api.restartCustom(custom.id), `Restarted ${custom.name}`, 'Restart failed');
  const onOpen = () => custom.url && api.openServer(custom.url);
  const onCopy = () =>
    custom.url && callOk(api.copyText(custom.url), 'URL copied');

  const uptime = isRunning && custom.startedAt
    ? formatDuration((Date.now() - custom.startedAt) / 1000)
    : null;

  return (
    <div className="panel relative flex flex-col gap-3 p-4 hover:border-border-strong transition">
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isRunning && 'bg-ok animate-pulse-dot',
                custom.status === 'stopped' && 'bg-fg-subtle',
                custom.status === 'crashed' && 'bg-err',
              )}
            />
            <h3 className="truncate text-sm font-semibold">{custom.name}</h3>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-fg-subtle">
            {shortenCommand(
              custom.command + (custom.args?.length ? ' ' + custom.args.join(' ') : ''),
              90,
            )}
          </p>
        </div>
        <div className="flex items-center">
          <Tooltip content="Edit">
            <button onClick={onEdit} className="row-action">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              onClick={onRemove}
              className="row-action hover:text-err"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-fg-muted">
        <div className="rounded-md border border-border bg-bg-panel/40 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
            Status
          </div>
          <div
            className={cn(
              'text-sm font-medium capitalize',
              isRunning && 'text-ok',
              custom.status === 'crashed' && 'text-err',
            )}
          >
            {custom.status}
            {custom.lastExitCode != null && !isRunning && (
              <span className="ml-1 text-[10px] text-fg-subtle">
                (exit {custom.lastExitCode})
              </span>
            )}
          </div>
        </div>
        <div className="rounded-md border border-border bg-bg-panel/40 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
            {isRunning ? 'Uptime' : 'Last started'}
          </div>
          <div className="text-sm font-medium tabular-nums">
            {uptime ??
              (custom.lastExitedAt
                ? new Date(custom.lastExitedAt).toLocaleTimeString()
                : '—')}
          </div>
        </div>
        {custom.cwd && (
          <div className="col-span-2 rounded-md border border-border bg-bg-panel/40 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
              cwd
            </div>
            <div className="truncate font-mono text-[11px] text-fg">
              {custom.cwd}
            </div>
          </div>
        )}
      </div>
      <div className="mt-auto flex items-center gap-1.5">
        {isRunning ? (
          <>
            <Button variant="danger" size="sm" onClick={onStop}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
            <Button variant="secondary" size="sm" onClick={onRestart}>
              <RefreshCcw className="h-3.5 w-3.5" /> Restart
            </Button>
          </>
        ) : (
          <Button variant="primary" size="sm" onClick={onStart}>
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        )}
        <div className="ml-auto flex items-center">
          {custom.url && (
            <>
              <Tooltip content="Open URL">
                <button onClick={onOpen} className="row-action">
                  <Globe className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
              <Tooltip content="Copy URL">
                <button onClick={onCopy} className="row-action">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </>
          )}
          <Tooltip content="Logs">
            <button onClick={onLogs} className="row-action">
              <ScrollText className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
