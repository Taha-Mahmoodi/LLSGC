import { useState } from 'react';
import { Github, Info } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Switch } from '../components/ui/Switch';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useStore } from '../lib/store';
import { api } from '../lib/api';

export function Settings() {
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);
  const [refreshInput, setRefreshInput] = useState(
    String(settings.refreshIntervalMs),
  );

  const update = async (patch: Partial<typeof settings>) => {
    const r = await api.updateSettings(patch);
    if (r.ok && r.data) setSettings(r.data);
  };

  const onApplyInterval = async () => {
    let n = parseInt(refreshInput, 10);
    if (!Number.isFinite(n)) n = 2500;
    n = Math.max(800, Math.min(60000, n));
    setRefreshInput(String(n));
    await update({ refreshIntervalMs: n });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Settings"
        description="Theme, refresh rate, and behavioural preferences."
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          <Section title="Appearance">
            <Row
              label="Theme"
              description="Switch between dark and light. System follows OS preference."
            >
              <Select
                value={settings.theme}
                onValueChange={v =>
                  update({ theme: v as typeof settings.theme })
                }
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </Row>
          </Section>

          <Section title="Monitoring">
            <Row
              label="Refresh interval"
              description="How often to poll for ports and resource usage. Lower values feel snappier but use slightly more CPU."
            >
              <div className="flex items-center gap-2">
                <Input
                  className="w-28"
                  value={refreshInput}
                  suffix="ms"
                  onChange={e =>
                    setRefreshInput(e.target.value.replace(/[^0-9]/g, ''))
                  }
                />
                <Button size="sm" variant="secondary" onClick={onApplyInterval}>
                  Apply
                </Button>
              </div>
            </Row>
            <Row
              label="Show system processes"
              description="Include svchost and other Windows services in the server list."
            >
              <Switch
                checked={settings.showSystemPorts}
                onCheckedChange={v => update({ showSystemPorts: v })}
              />
            </Row>
          </Section>

          <Section title="Behaviour">
            <Row
              label="Start minimized"
              description="Open the app hidden on launch. Useful when paired with autostart."
            >
              <Switch
                checked={settings.startMinimized}
                onCheckedChange={v => update({ startMinimized: v })}
              />
            </Row>
            <Row
              label="Notifications"
              description="Show toasts when launchers crash or commands complete."
            >
              <Switch
                checked={settings.enableNotifications}
                onCheckedChange={v => update({ enableNotifications: v })}
              />
            </Row>
          </Section>

          <Section title="About">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-panel/40 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 text-fg-muted" />
              <div className="flex-1 leading-relaxed text-fg-muted">
                <span className="font-medium text-fg">LLSGC</span> — Live Local
                Servers GUI Controller. Open source, MIT licensed.
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  api.openExternal('https://github.com/Taha-Mahmoodi/LLSGC')
                }
              >
                <Github className="h-3.5 w-3.5" />
                Source
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 text-xs uppercase tracking-wider text-fg-subtle">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
