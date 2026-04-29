import { useCallback, useEffect, useState } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, type ViewKey } from './components/layout/Sidebar';
import { ToastViewport } from './components/ui/Toast';
import { TooltipProvider } from './components/ui/Tooltip';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import { Dashboard } from './pages/Dashboard';
import { Servers } from './pages/Servers';
import { Ports } from './pages/Ports';
import { Custom } from './pages/Custom';
import { Firewall } from './pages/Firewall';
import { Hosts } from './pages/Hosts';
import { Logs } from './pages/Logs';
import { Diagnostics } from './pages/Diagnostics';
import { Settings as SettingsPage } from './pages/Settings';
import { api } from './lib/api';
import { useStore } from './lib/store';
import { cn } from './lib/utils';
import type { UpdateState } from '../shared/types';

export default function App() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [visited, setVisited] = useState<Set<ViewKey>>(
    () => new Set<ViewKey>(['dashboard']),
  );

  const [paletteOpen, setPaletteOpen] = useState(false);
  const setSystemStats = useStore(s => s.setSystemStats);
  const setServers = useStore(s => s.setServers);
  const setCustomServers = useStore(s => s.setCustomServers);
  const appendLog = useStore(s => s.appendLog);
  const setSettings = useStore(s => s.setSettings);
  const pushToast = useStore(s => s.pushToast);

  const navigate = useCallback((next: ViewKey) => {
    setView(next);
    setVisited(prev => (prev.has(next) ? prev : new Set([...prev, next])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settings, stats, servers, customs] = await Promise.all([
        api.getSettings(),
        api.getSystemStats(),
        api.listServers(),
        api.listCustom(),
      ]);
      if (cancelled) return;
      if (settings.ok && settings.data) setSettings(settings.data);
      if (stats.ok && stats.data) setSystemStats(stats.data);
      if (servers.ok && servers.data) setServers(servers.data);
      if (customs.ok && customs.data) setCustomServers(customs.data);
    })();

    const offSystem = api.onSystemTick(s => setSystemStats(s));
    const offServers = api.onServersTick(s => setServers(s));
    const offCustom = api.onCustomStatus(list => setCustomServers(list));
    const offLog = api.onCustomLog(line => {
      if (line && typeof (line as any).customId === 'string') {
        appendLog(line);
      }
    });

    const offUpdate = api.onUpdateState((state: UpdateState) => {
      if (state.kind === 'available') {
        pushToast({
          title: `Update available: v${state.info.version}`,
          description: 'Click Settings to download. Or run "Diagnostics → Open settings" later.',
          tone: 'info',
        });
      } else if (state.kind === 'downloaded') {
        pushToast({
          title: `Update v${state.info.version} ready`,
          description: 'Restart the app from Settings to apply the update.',
          tone: 'ok',
        });
      } else if (state.kind === 'error') {
        // Silent — auto-update errors happen on flaky networks etc, don't spam.
        console.warn('[updater]', state.message);
      }
    });

    return () => {
      cancelled = true;
      offSystem();
      offServers();
      offCustom();
      offLog();
      offUpdate();
    };
  }, [setSystemStats, setServers, setCustomServers, appendLog, setSettings, pushToast]);

  // Global Ctrl+K (Cmd+K on macOS) to open the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === '/' && !isInput && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  return (
    <TooltipProvider>
    <div className="flex h-screen w-screen flex-col text-fg">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={view} onChange={navigate} />
        <main className="relative flex-1 overflow-hidden">
          <CachedPage active={view === 'dashboard'} mounted={visited.has('dashboard')}>
            <ErrorBoundary scope="dashboard">
              <Dashboard onJump={navigate} />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'servers'} mounted={visited.has('servers')}>
            <ErrorBoundary scope="servers">
              <Servers />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'ports'} mounted={visited.has('ports')}>
            <ErrorBoundary scope="ports">
              <Ports />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'custom'} mounted={visited.has('custom')}>
            <ErrorBoundary scope="custom">
              <Custom />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'firewall'} mounted={visited.has('firewall')}>
            <ErrorBoundary scope="firewall">
              <Firewall />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'hosts'} mounted={visited.has('hosts')}>
            <ErrorBoundary scope="hosts">
              <Hosts />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'logs'} mounted={visited.has('logs')}>
            <ErrorBoundary scope="logs">
              <Logs />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'diagnostics'} mounted={visited.has('diagnostics')}>
            <ErrorBoundary scope="diagnostics">
              <Diagnostics onJump={navigate} />
            </ErrorBoundary>
          </CachedPage>
          <CachedPage active={view === 'settings'} mounted={visited.has('settings')}>
            <ErrorBoundary scope="settings">
              <SettingsPage />
            </ErrorBoundary>
          </CachedPage>
        </main>
      </div>
      <ToastViewport />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={navigate}
      />
    </div>
    </TooltipProvider>
  );
}

function CachedPage({
  active,
  mounted,
  children,
}: {
  active: boolean;
  mounted: boolean;
  children: React.ReactNode;
}) {
  if (!mounted) return null;
  return (
    <div
      className={cn(
        'absolute inset-0',
        active ? 'block' : 'hidden',
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}
