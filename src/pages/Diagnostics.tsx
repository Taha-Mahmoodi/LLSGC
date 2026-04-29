import { useEffect, useState } from 'react';
import {
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  RefreshCcw,
  ArrowRight,
} from 'lucide-react';
import type {
  DiagnosticResult,
  DiagnosticSeverity,
  DiagnosticsReport,
} from '@shared/types';
import type { ViewKey } from '../components/layout/Sidebar';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/EmptyState';
import { api } from '../lib/api';
import { cn, formatDuration } from '../lib/utils';

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warn: 1,
  info: 2,
  ok: 3,
};

export function Diagnostics({ onJump }: { onJump?: (view: ViewKey) => void }) {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const r = await api.runDiagnostics();
    if (r.ok && r.data) setReport(r.data);
    setRunning(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const counts = countBySeverity(report?.results ?? []);
  const sorted = [...(report?.results ?? [])].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Diagnostics"
        description={
          report
            ? `Last run ${formatRelative(report.ranAt)} (${formatDuration(report.durationMs / 1000)}).`
            : 'Run a battery of cheap checks against your hosts file, firewall, launchers, and ports.'
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            disabled={running}
            onClick={runChecks}
          >
            <RefreshCcw className={cn('h-3.5 w-3.5', running && 'animate-spin')} />
            {running ? 'Running…' : 'Run all checks'}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryTile severity="error" label="Errors" value={counts.error} />
            <SummaryTile severity="warn" label="Warnings" value={counts.warn} />
            <SummaryTile severity="info" label="Info" value={counts.info} />
            <SummaryTile severity="ok" label="Healthy" value={counts.ok} />
          </div>
        )}

        {!report && running && (
          <div className="rounded-lg border border-border bg-bg-elev/60 px-4 py-8 text-center text-sm text-fg-muted">
            Running checks…
          </div>
        )}

        {report && sorted.length === 0 && (
          <EmptyState
            icon={<Stethoscope className="h-5 w-5" />}
            title="Nothing to report"
            description="Every check came back clean. Re-run any time to verify."
          />
        )}

        {sorted.length > 0 && (
          <div className="space-y-2">
            {sorted.map(r => (
              <ResultRow key={r.id} result={r} onJump={onJump} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  result,
  onJump,
}: {
  result: DiagnosticResult;
  onJump?: (view: ViewKey) => void;
}) {
  const Icon = iconForSeverity(result.severity);
  return (
    <div
      className={cn(
        'rounded-lg border bg-bg-elev/60 px-4 py-3 transition',
        toneClass(result.severity, 'border'),
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            toneClass(result.severity, 'bg'),
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold">{result.title}</span>
            <span className="text-[11px] uppercase tracking-wider text-fg-subtle">
              {result.category}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">{result.message}</p>
          {result.detail && (
            <p className="mt-1 text-xs text-fg-subtle">{result.detail}</p>
          )}
          {result.fixHint && (
            <div
              className={cn(
                'mt-2 rounded-md border px-2 py-1.5 text-xs',
                toneClass(result.severity, 'subtle'),
              )}
            >
              <span className="font-medium">Fix: </span>
              {result.fixHint}
            </div>
          )}
        </div>
        {result.jumpTo && onJump && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onJump(result.jumpTo as ViewKey)}
          >
            Open {result.jumpTo}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  severity,
  label,
  value,
}: {
  severity: DiagnosticSeverity;
  label: string;
  value: number;
}) {
  const Icon = iconForSeverity(severity);
  return (
    <div
      className={cn(
        'rounded-lg border bg-bg-elev/60 p-3',
        toneClass(severity, 'border'),
      )}
    >
      <div className={cn('flex items-center gap-2', toneClass(severity, 'text'))}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function iconForSeverity(severity: DiagnosticSeverity) {
  switch (severity) {
    case 'ok':
      return CheckCircle2;
    case 'info':
      return Info;
    case 'warn':
      return AlertTriangle;
    case 'error':
      return XCircle;
  }
}

function toneClass(severity: DiagnosticSeverity, slot: 'border' | 'bg' | 'text' | 'subtle'): string {
  const map: Record<DiagnosticSeverity, Record<string, string>> = {
    ok: {
      border: 'border-ok/30',
      bg: 'bg-ok/10 text-ok',
      text: 'text-ok',
      subtle: 'border-ok/30 bg-ok/5 text-ok',
    },
    info: {
      border: 'border-accent/30',
      bg: 'bg-accent/10 text-accent',
      text: 'text-accent',
      subtle: 'border-accent/30 bg-accent/5 text-accent',
    },
    warn: {
      border: 'border-warn/30',
      bg: 'bg-warn/10 text-warn',
      text: 'text-warn',
      subtle: 'border-warn/30 bg-warn/5 text-warn',
    },
    error: {
      border: 'border-err/30',
      bg: 'bg-err/10 text-err',
      text: 'text-err',
      subtle: 'border-err/30 bg-err/5 text-err',
    },
  };
  return map[severity][slot];
}

function countBySeverity(results: DiagnosticResult[]) {
  const out = { ok: 0, info: 0, warn: 0, error: 0 };
  for (const r of results) out[r.severity]++;
  return out;
}

function formatRelative(timestamp: number): string {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(timestamp).toLocaleTimeString();
}
