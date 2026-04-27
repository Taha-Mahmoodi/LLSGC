import { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  Lock,
  Unlock,
  RefreshCcw,
  Search,
  Plus,
  Filter,
} from 'lucide-react';
import type { FirewallRule } from '../../shared/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BlockPortDialog } from '../components/BlockPortDialog';
import { useStore } from '../lib/store';
import { api, callOk } from '../lib/api';
import { cn } from '../lib/utils';

export function Firewall() {
  const rules = useStore(s => s.firewallRules);
  const setRules = useStore(s => s.setFirewall);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<FirewallRule | null>(null);
  const [query, setQuery] = useState('');
  const [onlyManaged, setOnlyManaged] = useState(true);
  const [windowsOnly, setWindowsOnly] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const r = await api.listFirewall();
    if (r.ok && r.data) setRules(r.data);
    else if (!r.ok && r.error?.toLowerCase().includes('only supported')) {
      setWindowsOnly(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    api.platform().then(p => {
      if (p.ok && p.data && !p.data.isWindows) {
        setWindowsOnly(true);
        return;
      }
      refresh();
    });
  }, []);

  const filtered = useMemo(() => {
    let list = rules;
    if (onlyManaged) list = list.filter(r => r.managed);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.localPort.toLowerCase().includes(q) ||
          r.protocol.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rules, onlyManaged, query]);

  if (windowsOnly) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          title="Firewall"
          description="Block / unblock ports through the OS firewall."
        />
        <div className="px-6 py-6">
          <EmptyState
            icon={<ShieldAlert className="h-5 w-5" />}
            title="Windows-only feature"
            description="LLSGC currently controls firewall rules through netsh advfirewall, which is only available on Windows. Cross-platform support is on the roadmap."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Firewall"
        description="Block or unblock specific ports. Managed rules are tagged 'LLSGC:'."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCcw className="h-3.5 w-3.5" />
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Block port
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Input
            className="flex-1"
            prefix={<Search className="h-3.5 w-3.5" />}
            placeholder="Filter by rule name, port or protocol…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-3 rounded-md border border-border bg-bg-panel/50 px-3 py-2">
            <Filter className="h-3.5 w-3.5 text-fg-muted" />
            <Switch
              checked={onlyManaged}
              onCheckedChange={setOnlyManaged}
              label="Only LLSGC rules"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert className="h-5 w-5" />}
            title={
              onlyManaged
                ? 'No blocked ports'
                : 'No firewall rules match'
            }
            description={
              onlyManaged
                ? 'Click "Block port" to add a rule. LLSGC tags every rule it creates so it does not interfere with system rules.'
                : 'Try clearing the search filter or toggling "Only LLSGC rules".'
            }
            action={
              onlyManaged && (
                <Button variant="primary" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4" /> Block port
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-1.5">
            {filtered.map(rule => (
              <div
                key={rule.name}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-lg border border-border bg-bg-elev/60 px-3 py-2.5"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-md',
                    rule.action === 'block'
                      ? 'bg-err/10 text-err'
                      : 'bg-ok/10 text-ok',
                  )}
                >
                  {rule.action === 'block' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {rule.name}
                    </span>
                    {rule.managed && (
                      <span className="pill pill-warn">managed</span>
                    )}
                    {!rule.enabled && (
                      <span className="pill pill-stopped">disabled</span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-fg-subtle">
                    {rule.protocol} · {rule.localPort} · {rule.direction.toUpperCase()} · {rule.action.toUpperCase()}
                  </div>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={async v => {
                    await callOk(
                      api.toggleRule(rule.name, v),
                      `Rule ${v ? 'enabled' : 'disabled'}`,
                      'Toggle failed',
                    );
                    refresh();
                  }}
                />
                {rule.managed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoving(rule)}
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
                {!rule.managed && (
                  <span className="text-[11px] text-fg-subtle italic px-2">
                    (system rule)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <BlockPortDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onBlocked={refresh}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={v => !v && setRemoving(null)}
        title="Remove firewall rule?"
        description={
          removing ? `Delete "${removing.name}" and unblock the port?` : ''
        }
        destructive
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          await callOk(
            api.unblockRule(removing.name),
            'Rule removed',
            'Failed to remove rule',
          );
          setRemoving(null);
          refresh();
        }}
      />
    </div>
  );
}
