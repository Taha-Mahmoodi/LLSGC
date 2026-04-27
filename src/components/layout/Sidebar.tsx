import {
  LayoutDashboard,
  Network,
  Rocket,
  ShieldAlert,
  ScrollText,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';

export type ViewKey =
  | 'dashboard'
  | 'servers'
  | 'custom'
  | 'firewall'
  | 'logs'
  | 'settings';

const items: Array<{
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  description: string;
  badge?: (counts: { servers: number; running: number; rules: number }) => string | undefined;
}> = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Overview',
  },
  {
    key: 'servers',
    label: 'Servers',
    icon: Network,
    description: 'Detected listening processes',
    badge: c => (c.servers > 0 ? String(c.servers) : undefined),
  },
  {
    key: 'custom',
    label: 'Launchers',
    icon: Rocket,
    description: 'Saved server commands',
    badge: c => (c.running > 0 ? `${c.running}` : undefined),
  },
  {
    key: 'firewall',
    label: 'Firewall',
    icon: ShieldAlert,
    description: 'Block / unblock ports',
    badge: c => (c.rules > 0 ? String(c.rules) : undefined),
  },
  {
    key: 'logs',
    label: 'Logs',
    icon: ScrollText,
    description: 'Per-server output',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    description: 'Preferences',
  },
];

export function Sidebar({
  current,
  onChange,
}: {
  current: ViewKey;
  onChange: (next: ViewKey) => void;
}) {
  const servers = useStore(s => s.servers);
  const customs = useStore(s => s.customServers);
  const fw = useStore(s => s.firewallRules);
  const counts = {
    servers: servers.length,
    running: customs.filter(c => c.status === 'running').length,
    rules: fw.filter(r => r.managed).length,
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-bg-base/60 px-3 py-4">
      <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
        Navigation
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(item => {
          const active = current === item.key;
          const Icon = item.icon;
          const badge = item.badge?.(counts);
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition',
                active
                  ? 'bg-bg-elev text-fg border border-border-strong shadow-soft'
                  : 'text-fg-muted hover:bg-bg-elev/60 hover:text-fg border border-transparent',
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md',
                  active
                    ? 'bg-accent/15 text-accent'
                    : 'bg-bg-panel text-fg-muted group-hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="flex flex-1 flex-col leading-tight">
                <span className="font-medium">{item.label}</span>
                <span className="text-[11px] text-fg-subtle">{item.description}</span>
              </div>
              {badge && (
                <span className="rounded-md bg-bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto rounded-lg border border-border bg-bg-elev/50 p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          Quick stats
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <Stat label="Servers" value={counts.servers} />
          <Stat label="Launchers" value={counts.running} />
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-bg-panel px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
