import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollText,
  Trash2,
  Play,
  Square,
  RefreshCcw,
  Pause,
  ArrowDownToLine,
} from 'lucide-react';
import type { CustomServer, LogLine } from '../../shared/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/EmptyState';
import { useStore } from '../lib/store';
import { api, callOk } from '../lib/api';
import { cn } from '../lib/utils';

export function Logs() {
  const customs = useStore(s => s.customServers);
  const logsByCustom = useStore(s => s.logs);
  const setLogs = useStore(s => s.setLogs);
  const selectedId = useStore(s => s.selectedCustomId);
  const setSelected = useStore(s => s.setSelectedCustom);

  const containerRef = useRef<HTMLDivElement>(null);
  const [autoscroll, setAutoscroll] = useState(true);

  const selected = customs.find(c => c.id === selectedId) ?? customs[0] ?? null;

  useEffect(() => {
    if (!selectedId && customs.length > 0) {
      setSelected(customs[0].id);
    }
  }, [selectedId, customs, setSelected]);

  useEffect(() => {
    if (!selected) return;
    api.getLogs(selected.id).then(r => {
      if (r.ok && r.data) setLogs(selected.id, r.data);
    });
  }, [selected?.id, setLogs]);

  const lines = (selected && logsByCustom[selected.id]) || [];

  useEffect(() => {
    if (autoscroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length, autoscroll]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== autoscroll) setAutoscroll(atBottom);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-bg-base/40">
        <div className="border-b border-border px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-fg-subtle">
            Launchers
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {customs.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-fg-muted">
              No launchers yet.
            </div>
          ) : (
            customs.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition',
                  selected?.id === c.id
                    ? 'bg-bg-elev border border-border-strong'
                    : 'border border-transparent hover:bg-bg-elev/60',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    c.status === 'running' && 'bg-ok animate-pulse-dot',
                    c.status === 'stopped' && 'bg-fg-subtle',
                    c.status === 'crashed' && 'bg-err',
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-[10px] text-fg-subtle tabular-nums">
                  {(logsByCustom[c.id] ?? []).length}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader
          title="Logs"
          description={
            selected
              ? `Live output for "${selected.name}".`
              : 'Select a launcher to view its log output.'
          }
          actions={
            selected && (
              <LogActions selected={selected} autoscroll={autoscroll} setAutoscroll={setAutoscroll} />
            )
          }
        />
        {selected ? (
          <div
            ref={containerRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto bg-bg-base/40 px-4 py-3 font-mono text-[12px] leading-relaxed"
          >
            {lines.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="h-5 w-5" />}
                title={selected.status === 'running' ? 'Waiting for output…' : 'No logs yet'}
                description={
                  selected.status === 'running'
                    ? 'Logs will stream as the process writes to stdout / stderr.'
                    : 'Start the launcher to begin capturing logs.'
                }
                className="border-0"
              />
            ) : (
              <LogList lines={lines} />
            )}
          </div>
        ) : (
          <div className="flex-1 px-6 py-8">
            <EmptyState
              icon={<ScrollText className="h-5 w-5" />}
              title="No launcher selected"
              description="Create a launcher in the Launchers tab to start capturing logs here."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function LogActions({
  selected,
  autoscroll,
  setAutoscroll,
}: {
  selected: CustomServer;
  autoscroll: boolean;
  setAutoscroll: (next: boolean) => void;
}) {
  const isRunning = selected.status === 'running';
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={autoscroll ? 'secondary' : 'ghost'}
        onClick={() => setAutoscroll(!autoscroll)}
      >
        {autoscroll ? <Pause className="h-3.5 w-3.5" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
        {autoscroll ? 'Following' : 'Jump to end'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => callOk(api.clearLogs(selected.id), 'Logs cleared')}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear
      </Button>
      {isRunning ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => callOk(api.restartCustom(selected.id), `Restarted ${selected.name}`)}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Restart
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => callOk(api.stopCustom(selected.id), `Stopped ${selected.name}`)}
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="primary"
          onClick={() => callOk(api.startCustom(selected.id), `Started ${selected.name}`)}
        >
          <Play className="h-3.5 w-3.5" />
          Start
        </Button>
      )}
    </div>
  );
}

function LogList({ lines }: { lines: LogLine[] }) {
  return (
    <div className="space-y-0.5">
      {lines.map(l => (
        <div key={l.id} className="flex gap-3">
          <span className="shrink-0 text-fg-subtle tabular-nums">
            {new Date(l.ts).toLocaleTimeString()}
          </span>
          <span
            className={cn(
              'shrink-0 w-12 text-[10px] uppercase tracking-wider',
              l.stream === 'stderr' && 'text-err',
              l.stream === 'system' && 'text-warn',
              l.stream === 'stdout' && 'text-fg-subtle',
            )}
          >
            {l.stream}
          </span>
          <span
            className={cn(
              'whitespace-pre-wrap break-all',
              l.stream === 'stderr' && 'text-err/90',
              l.stream === 'system' && 'text-warn/90',
            )}
          >
            {l.text}
          </span>
        </div>
      ))}
    </div>
  );
}
