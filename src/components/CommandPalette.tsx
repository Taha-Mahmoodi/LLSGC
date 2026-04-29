import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Network,
  Plug,
  Rocket,
  ShieldAlert,
  Globe,
  ScrollText,
  Settings as SettingsIcon,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { ViewKey } from './layout/Sidebar';
import { useStore } from '../lib/store';
import { api, callOk } from '../lib/api';
import { cn, isLikelyHttp } from '../lib/utils';
import type { CommonPort } from '@shared/types';

interface CommandItem {
  id: string;
  kind: 'page' | 'server' | 'launcher' | 'host' | 'port' | 'action';
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  hint?: string;
  perform: () => void | Promise<void>;
  match: string;
}

const PAGES: Array<{ key: ViewKey; label: string; icon: LucideIcon; description: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview' },
  { key: 'servers', label: 'Servers', icon: Network, description: 'Listening processes' },
  { key: 'ports', label: 'Ports', icon: Plug, description: 'Common dev ports + free port finder' },
  { key: 'custom', label: 'Launchers', icon: Rocket, description: 'Saved server commands' },
  { key: 'firewall', label: 'Firewall', icon: ShieldAlert, description: 'Block / unblock ports' },
  { key: 'hosts', label: 'Hosts', icon: Globe, description: 'Edit hosts file' },
  { key: 'logs', label: 'Logs', icon: ScrollText, description: 'Per-launcher output' },
  { key: 'diagnostics' as ViewKey, label: 'Diagnostics', icon: Stethoscope, description: 'Run health checks' },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, description: 'Preferences' },
];

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onNavigate: (next: ViewKey) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [commonPorts, setCommonPorts] = useState<CommonPort[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const servers = useStore(s => s.servers);
  const customs = useStore(s => s.customServers);

  useEffect(() => {
    api.listCommonPorts().then(r => {
      if (r.ok && r.data) setCommonPorts(r.data);
    });
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const out: CommandItem[] = [];

    for (const p of PAGES) {
      out.push({
        id: `page:${p.key}`,
        kind: 'page',
        icon: p.icon,
        title: p.label,
        subtitle: p.description,
        match: `${p.label} ${p.description} page goto navigate`,
        perform: () => onNavigate(p.key),
      });
    }

    for (const s of servers) {
      const Icon = Network;
      out.push({
        id: `server:${s.pid}:${s.port}`,
        kind: 'server',
        icon: Icon,
        title: `${s.name} on port ${s.port}`,
        subtitle: `${s.address}:${s.port} · pid ${s.pid}${s.command ? ' · ' + s.command.slice(0, 80) : ''}`,
        hint: 'Stop',
        match: `${s.name} ${s.port} ${s.address} ${s.pid} ${s.command ?? ''} server`,
        perform: async () => {
          await callOk(api.killServer(s.pid), `Stopped ${s.name}`);
        },
      });
      if (s.url && isLikelyHttp(s.port)) {
        out.push({
          id: `server-open:${s.pid}:${s.port}`,
          kind: 'server',
          icon: Globe,
          title: `Open ${s.url}`,
          subtitle: `${s.name}`,
          hint: 'Open in browser',
          match: `${s.url} ${s.name} ${s.port} open browser`,
          perform: async () => {
            await api.openServer(s.url!);
          },
        });
      }
    }

    for (const c of customs) {
      out.push({
        id: `launcher:${c.id}`,
        kind: 'launcher',
        icon: Rocket,
        title: `Launcher: ${c.name}`,
        subtitle: `${c.status} · ${c.command}`,
        hint: c.status === 'running' ? 'Stop' : 'Start',
        match: `${c.name} ${c.command} launcher ${c.status}`,
        perform: async () => {
          if (c.status === 'running') {
            await callOk(api.stopCustom(c.id), `Stopped ${c.name}`);
          } else {
            await callOk(api.startCustom(c.id), `Started ${c.name}`);
          }
          return;
        },
      });
    }

    for (const p of commonPorts) {
      out.push({
        id: `port:${p.port}`,
        kind: 'port',
        icon: Plug,
        title: `Port ${p.port} — ${p.label}`,
        subtitle: p.description,
        hint: 'Check status',
        match: `${p.port} ${p.label} ${p.description} port`,
        perform: () => {
          onNavigate('ports');
        },
      });
    }

    return out;
  }, [servers, customs, commonPorts, onNavigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 80);
    const tokens = q.split(/\s+/).filter(Boolean);
    return items
      .filter(it => {
        const hay = it.match.toLowerCase();
        return tokens.every(t => hay.includes(t));
      })
      .slice(0, 80);
  }, [items, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIdx];
        if (item) {
          item.perform();
          onOpenChange(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIdx, onOpenChange]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cp-backdrop"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs"
            onClick={() => onOpenChange(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          />
          <motion.div
            key="cp-panel"
            className="fixed left-1/2 top-[14vh] z-50 w-[640px] max-w-[92vw] -translate-x-1/2 rounded-xl border border-border bg-bg-elev shadow-glow"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Search className="h-4 w-4 text-fg-subtle shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search servers, ports, launchers, hosts, pages…"
                className="w-full bg-transparent text-sm placeholder:text-fg-subtle focus:outline-none"
              />
              <span className="rounded border border-border bg-bg-panel px-1.5 py-0.5 text-[10px] font-mono text-fg-subtle">
                Esc
              </span>
            </div>
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-fg-muted">
                  No matches.
                </div>
              ) : (
                filtered.map((it, idx) => {
                  const Icon = it.icon;
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={it.id}
                      data-idx={idx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => {
                        it.perform();
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition',
                        active ? 'bg-bg-panel' : 'hover:bg-bg-panel/60',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                          active ? 'bg-accent/15 text-accent' : 'bg-bg-base text-fg-muted',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{it.title}</div>
                        {it.subtitle && (
                          <div className="truncate text-[11px] text-fg-subtle font-mono">
                            {it.subtitle}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-bg-base px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fg-subtle">
                          {it.kind}
                        </span>
                        {it.hint && (
                          <span className="text-[10px] text-fg-subtle">{it.hint}</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
              <div className="flex items-center gap-3">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">⏎</kbd> run</span>
                <span><kbd className="font-mono">Esc</kbd> close</span>
              </div>
              <span className="font-mono">{filtered.length} / {items.length}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
