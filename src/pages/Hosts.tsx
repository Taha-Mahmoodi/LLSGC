import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  RefreshCcw,
  Search,
  Pencil,
  Trash2,
  Globe,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import type { HostEntry, HostsInfo } from '@shared/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { Tooltip } from '../components/ui/Tooltip';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddHostDialog } from '../components/AddHostDialog';
import { api, callOk } from '../lib/api';
import { cn } from '../lib/utils';

export function Hosts() {
  const [info, setInfo] = useState<HostsInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<HostEntry | null>(null);
  const [removing, setRemoving] = useState<HostEntry | null>(null);

  const refresh = async () => {
    setLoading(true);
    const r = await api.listHosts();
    if (r.ok && r.data) setInfo(r.data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!info) return [];
    const q = query.trim().toLowerCase();
    if (!q) return info.entries;
    return info.entries.filter(
      e =>
        e.ip.toLowerCase().includes(q) ||
        e.hostnames.some(h => h.toLowerCase().includes(q)) ||
        (e.comment ?? '').toLowerCase().includes(q),
    );
  }, [info, query]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Hosts"
        description={
          info
            ? `${info.path}${info.writable ? '' : ' · read-only (run as Administrator to edit)'}`
            : 'Edit your hosts file.'
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCcw className="h-3.5 w-3.5" />
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={info?.writable === false}
              onClick={() => {
                setEditing(null);
                setAdding(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add entry
            </Button>
          </>
        }
      />

      {info && info.writable === false && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Hosts file is not writable. Right-click <code>llsgc-server.exe</code>{' '}
            and choose <strong>Run as administrator</strong> to enable editing.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 px-6 py-4 border-b border-border bg-bg-base/40">
        <Input
          prefix={<Search className="h-3.5 w-3.5" />}
          placeholder="Filter by IP, hostname or comment…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!info && loading && (
          <div className="text-sm text-fg-muted">Loading…</div>
        )}
        {info && filtered.length === 0 ? (
          <EmptyState
            icon={<Globe className="h-5 w-5" />}
            title={
              query
                ? 'No matching entries'
                : 'Hosts file looks empty'
            }
            description={
              query
                ? `Nothing matches "${query}".`
                : 'Add an entry to map a hostname like myapp.local to 127.0.0.1.'
            }
            action={
              !query &&
              info?.writable !== false && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setAdding(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Add entry
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-1">
            <div className="hidden md:grid grid-cols-[auto_180px_1fr_auto_auto] items-center gap-3 px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              <div className="w-9" aria-hidden />
              <div>IP</div>
              <div>Hostnames</div>
              <div>Source</div>
              <div className="text-right">Actions</div>
            </div>
            {filtered.map(entry => (
              <HostRow
                key={entry.id}
                entry={entry}
                writable={info?.writable !== false}
                onToggle={async v => {
                  await callOk(
                    api.toggleHost(entry.id, v),
                    v ? 'Entry enabled' : 'Entry disabled',
                    'Failed to toggle',
                  );
                  refresh();
                }}
                onEdit={() => {
                  setEditing(entry);
                  setAdding(true);
                }}
                onRemove={() => setRemoving(entry)}
              />
            ))}
          </div>
        )}
      </div>

      <AddHostDialog
        open={adding}
        onOpenChange={setAdding}
        editing={editing}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={v => !v && setRemoving(null)}
        title="Remove host entry?"
        description={
          removing
            ? `Delete "${removing.ip} ${removing.hostnames.join(' ')}"?`
            : ''
        }
        destructive
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          await callOk(api.removeHost(removing.id), 'Entry removed', 'Failed to remove');
          setRemoving(null);
          refresh();
        }}
      />
    </div>
  );
}

function HostRow({
  entry,
  writable,
  onToggle,
  onEdit,
  onRemove,
}: {
  entry: HostEntry;
  writable: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const isSystem = entry.source === 'system';
  return (
    <div
      className={cn(
        'grid grid-cols-[auto_180px_1fr_auto_auto] items-center gap-3 rounded-lg border border-border bg-bg-elev/60 px-3 py-2.5 transition hover:border-border-strong',
        !entry.enabled && 'opacity-60',
      )}
    >
      <Switch
        checked={entry.enabled}
        onCheckedChange={onToggle}
      />
      <div className={cn('font-mono text-sm', !entry.enabled && 'line-through')}>{entry.ip}</div>
      <div className="min-w-0">
        <div className={cn('truncate text-sm', !entry.enabled && 'line-through')}>
          {entry.hostnames.join(', ')}
        </div>
        {entry.comment && (
          <div className="truncate text-[11px] text-fg-subtle">
            {entry.comment}
          </div>
        )}
      </div>
      <div>
        {isSystem ? (
          <span className="pill pill-warn">system</span>
        ) : (
          <span className="pill pill-running">user</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Tooltip content="Copy line">
          <button
            className="row-action"
            onClick={() =>
              callOk(
                api.copyText(`${entry.ip}\t${entry.hostnames.join(' ')}`),
                'Copied',
              )
            }
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        {!isSystem && writable && (
          <>
            <Tooltip content="Edit">
              <button onClick={onEdit} className="row-action">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Remove">
              <button onClick={onRemove} className="row-action hover:text-err">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
