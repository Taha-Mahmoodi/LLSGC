import { useEffect, useRef, useState } from 'react';
import {
  Lock,
  Unlock,
  RefreshCcw,
  Hash,
  Wand2,
} from 'lucide-react';
import type { CommonPort, PortCheckResult } from '@shared/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';
import { api, callOk } from '../lib/api';
import { cn } from '../lib/utils';

export function Ports() {
  const [common, setCommon] = useState<CommonPort[]>([]);
  const [statuses, setStatuses] = useState<Map<number, PortCheckResult>>(
    new Map(),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const inFlightRef = useRef(false);

  // Initial load of the reference list of common ports.
  useEffect(() => {
    api.listCommonPorts().then(r => {
      if (r.ok && r.data) setCommon(r.data);
    });
  }, []);

  // Refresh the busy/free statuses by hitting the unfiltered server scan
  // (api.checkPorts → scanListeningPorts on the server, NOT the filtered
  // `servers` store list). This is the truth — system processes included.
  const refresh = async (showSpinner = true) => {
    if (inFlightRef.current) return;
    if (common.length === 0) return;
    inFlightRef.current = true;
    if (showSpinner) setRefreshing(true);
    const result = await api.checkPorts(common.map(p => p.port));
    if (result.ok && result.data) {
      const map = new Map<number, PortCheckResult>();
      for (const r of result.data) map.set(r.port, r);
      setStatuses(map);
      setLastUpdated(Date.now());
    }
    if (showSpinner) setRefreshing(false);
    inFlightRef.current = false;
  };

  // First fetch once we have the common-port list.
  useEffect(() => {
    if (common.length > 0) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [common.length]);

  // Re-check on every server tick — same cadence as the rest of the app,
  // so what you see here matches what's on the Servers page (just including
  // system-owned ports which the Servers page may filter out).
  useEffect(() => {
    if (common.length === 0) return;
    const off = api.onServersTick(() => {
      refresh(false);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [common.length]);

  const busyCount = [...statuses.values()].filter(s => s.busy).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Ports"
        description={
          lastUpdated
            ? `Live data — last refreshed ${formatAge(Date.now() - lastUpdated)} ago. Includes system-owned ports.`
            : 'See which common dev ports are free and quickly check any specific one.'
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCcw className="h-3.5 w-3.5" />
            {refreshing ? 'Checking…' : 'Refresh'}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <PortChecker />
          <FreePortFinder />
        </div>

        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-subtle">
                Common dev ports
              </div>
              <div className="mt-0.5 text-sm font-medium">
                {busyCount} busy / {common.length} tracked
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {common.map(c => {
              const status = statuses.get(c.port);
              return (
                <CommonPortCard key={c.port} info={c} status={status} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function CommonPortCard({
  info,
  status,
}: {
  info: CommonPort;
  status?: PortCheckResult;
}) {
  const busy = status?.busy ?? false;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border bg-bg-panel/40 px-3 py-2.5 transition',
        busy
          ? 'border-err/30 hover:bg-err/5'
          : 'border-ok/30 hover:bg-ok/5',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">
            {info.port}
          </span>
          <span
            className={cn(
              'pill',
              busy ? 'pill-crashed' : 'pill-running',
            )}
          >
            {busy ? (
              <>
                <Lock className="h-3 w-3" /> busy
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3" /> free
              </>
            )}
          </span>
        </div>
        <div className="mt-1 text-xs text-fg">
          <span className="font-medium">{info.label}</span>
          <span className="text-fg-subtle"> · {info.description}</span>
        </div>
        {busy && status?.process && (
          <div className="mt-1 truncate font-mono text-[11px] text-fg-subtle">
            {status.process} · pid {status.pid}
          </div>
        )}
      </div>
    </div>
  );
}

function PortChecker() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<PortCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    const port = parseInt(input, 10);
    if (!port || port < 1 || port > 65535) return;
    setChecking(true);
    const r = await api.checkPort(port);
    if (r.ok && r.data) setResult(r.data);
    setChecking(false);
  };

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-fg-subtle">
        <Hash className="h-3.5 w-3.5" />
        Check a specific port
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="flex-1"
          placeholder="3000"
          value={input}
          onChange={e => setInput(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={e => e.key === 'Enter' && check()}
        />
        <Button variant="secondary" disabled={!input || checking} onClick={check}>
          {checking ? 'Checking…' : 'Check'}
        </Button>
      </div>
      {result && (
        <div className="mt-3 rounded-md border border-border bg-bg-panel/40 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold tabular-nums">
              {result.port}
            </span>
            <span className={cn('pill', result.busy ? 'pill-crashed' : 'pill-running')}>
              {result.busy ? (
                <>
                  <Lock className="h-3 w-3" /> busy
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3" /> free
                </>
              )}
            </span>
          </div>
          {result.busy && (
            <div className="mt-1 font-mono text-[11px] text-fg-muted">
              {result.process ?? `pid:${result.pid}`} · {result.protocol?.toUpperCase()} {result.address}:{result.port}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FreePortFinder() {
  const [start, setStart] = useState('3000');
  const [count, setCount] = useState('5');
  const [free, setFree] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setError(null);
    const startPort = parseInt(start, 10);
    const need = parseInt(count, 10);
    if (!startPort || startPort < 1 || startPort > 65535) {
      setError('Enter a valid starting port (1-65535)');
      return;
    }
    if (!need || need < 1 || need > 50) {
      setError('Number of free ports must be 1-50');
      return;
    }
    setSearching(true);
    const range: number[] = [];
    for (let p = startPort; p <= 65535 && range.length < need * 4; p++) {
      range.push(p);
    }
    const r = await api.checkPorts(range);
    if (r.ok && r.data) {
      const list = r.data.filter(x => !x.busy).slice(0, need).map(x => x.port);
      setFree(list);
    }
    setSearching(false);
  };

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-fg-subtle">
        <Wand2 className="h-3.5 w-3.5" />
        Find free ports
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Starting at"
          placeholder="3000"
          value={start}
          onChange={e => setStart(e.target.value.replace(/[^0-9]/g, ''))}
        />
        <Input
          label="How many"
          placeholder="5"
          value={count}
          onChange={e => setCount(e.target.value.replace(/[^0-9]/g, ''))}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" disabled={searching} onClick={find}>
          {searching ? 'Searching…' : 'Find ports'}
        </Button>
        {error && <span className="text-xs text-err">{error}</span>}
      </div>
      {free.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {free.map(p => (
            <Tooltip key={p} content="Click to copy">
              <button
                className="rounded-md border border-ok/30 bg-ok/10 px-2 py-1 font-mono text-xs text-ok transition hover:bg-ok/20"
                onClick={() =>
                  callOk(api.copyText(String(p)), `Copied ${p}`)
                }
              >
                {p}
              </button>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
