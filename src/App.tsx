import { useEffect, useState } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, type ViewKey } from './components/layout/Sidebar';
import { ToastViewport } from './components/ui/Toast';
import { Dashboard } from './pages/Dashboard';
import { Servers } from './pages/Servers';
import { Custom } from './pages/Custom';
import { Firewall } from './pages/Firewall';
import { Logs } from './pages/Logs';
import { Settings as SettingsPage } from './pages/Settings';
import { api } from './lib/api';
import { useStore } from './lib/store';

export default function App() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const setSystemStats = useStore(s => s.setSystemStats);
  const setServers = useStore(s => s.setServers);
  const setCustomServers = useStore(s => s.setCustomServers);
  const appendLog = useStore(s => s.appendLog);
  const setSettings = useStore(s => s.setSettings);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await api.getSettings();
      if (settings.ok && settings.data && !cancelled) setSettings(settings.data);
      const stats = await api.getSystemStats();
      if (stats.ok && stats.data && !cancelled) setSystemStats(stats.data);
      const servers = await api.listServers();
      if (servers.ok && servers.data && !cancelled) setServers(servers.data);
      const customs = await api.listCustom();
      if (customs.ok && customs.data && !cancelled) setCustomServers(customs.data);
    })();

    const offSystem = api.onSystemTick(s => setSystemStats(s));
    const offServers = api.onServersTick(s => setServers(s));
    const offCustom = api.onCustomStatus(list => setCustomServers(list));
    const offLog = api.onCustomLog((line: any) => {
      if (line && !Array.isArray(line)) appendLog(line);
    });

    return () => {
      cancelled = true;
      offSystem();
      offServers();
      offCustom();
      offLog();
    };
  }, [setSystemStats, setServers, setCustomServers, appendLog, setSettings]);

  return (
    <div className="flex h-screen w-screen flex-col text-fg">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={view} onChange={setView} />
        <main className="flex-1 overflow-hidden">
          {view === 'dashboard' && <Dashboard onJump={setView} />}
          {view === 'servers' && <Servers />}
          {view === 'custom' && <Custom />}
          {view === 'firewall' && <Firewall />}
          {view === 'logs' && <Logs />}
          {view === 'settings' && <SettingsPage />}
        </main>
      </div>
      <ToastViewport />
    </div>
  );
}
