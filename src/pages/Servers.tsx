import { useMemo, useState } from 'react';
import {
  Network,
  RefreshCcw,
  Search,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { ServerRow, ServerRowHeader } from '../components/ServerRow';
import { ServerDetailDrawer } from '../components/ServerDetailDrawer';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { useStore } from '../lib/store';
import { api } from '../lib/api';

export function Servers() {
  const servers = useStore(s => s.servers);
  const customs = useStore(s => s.customServers);
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);
  const setServers = useStore(s => s.setServers);
  const selected = useStore(s => s.selectedServerPid);
  const setSelected = useStore(s => s.setSelectedServer);

  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        String(s.port).includes(q) ||
        s.address.includes(q) ||
        (s.command ?? '').toLowerCase().includes(q),
    );
  }, [servers, query]);

  const selectedServer = filtered.find(s => s.pid === selected) ?? null;

  const onRefresh = async () => {
    const r = await api.listServers();
    if (r.ok && r.data) setServers(r.data);
  };

  const onToggleSystem = async (next: boolean) => {
    const r = await api.updateSettings({ showSystemPorts: next });
    if (r.ok && r.data) setSettings(r.data);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Servers"
        description="Every process listening on a local port. Updates in real time."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </Button>
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-3 px-6 py-4 border-b border-border bg-bg-base/40">
        <Input
          prefix={<Search className="h-3.5 w-3.5" />}
          placeholder="Filter by name, port, address or command…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {showFilters && (
          <div className="flex items-center gap-4 rounded-md border border-border bg-bg-panel/50 px-3 py-2">
            <Filter className="h-3.5 w-3.5 text-fg-muted" />
            <Switch
              checked={settings.showSystemPorts}
              onCheckedChange={onToggleSystem}
              label="Show system processes"
              description="Include svchost / system services in the list."
            />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Network className="h-5 w-5" />}
            title={
              query
                ? 'No matching servers'
                : 'No listening servers detected'
            }
            description={
              query
                ? `Nothing matches "${query}".`
                : 'Start a development server (npm run dev, python -m http.server, etc.) and it will appear here automatically.'
            }
          />
        ) : (
          <div className="space-y-1">
            <ServerRowHeader />
            {filtered.map(server => {
              const custom = customs.find(c => c.id === server.customId);
              return (
                <ServerRow
                  key={`${server.pid}-${server.port}-${server.protocol}`}
                  server={server}
                  custom={custom}
                  onSelect={() => setSelected(server.pid)}
                />
              );
            })}
          </div>
        )}
      </div>
      <ServerDetailDrawer
        server={selectedServer}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
