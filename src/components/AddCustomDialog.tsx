import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import type { CustomServer } from '../../shared/types';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { api, callOk } from '../lib/api';

interface FormState {
  name: string;
  command: string;
  args: string;
  cwd: string;
  port: string;
  url: string;
  envText: string;
  autoStart: boolean;
  color: string;
}

const COLOR_PALETTE = [
  '#7da6ff',
  '#62d4a3',
  '#f1b95a',
  '#ec7d7d',
  '#b388ff',
  '#5fd1ce',
];

const EMPTY: FormState = {
  name: '',
  command: '',
  args: '',
  cwd: '',
  port: '',
  url: '',
  envText: '',
  autoStart: false,
  color: COLOR_PALETTE[0],
};

export function AddCustomDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editing?: CustomServer | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          command: editing.command,
          args: (editing.args ?? []).join(' '),
          cwd: editing.cwd ?? '',
          port: editing.port ? String(editing.port) : '',
          url: editing.url ?? '',
          envText: Object.entries(editing.env ?? {})
            .map(([k, v]) => `${k}=${v}`)
            .join('\n'),
          autoStart: editing.autoStart,
          color: editing.color ?? COLOR_PALETTE[0],
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, editing]);

  const update = (patch: Partial<FormState>) =>
    setForm(s => ({ ...s, ...patch }));

  const onSave = async () => {
    if (!form.name.trim() || !form.command.trim()) return;
    setSubmitting(true);
    const env: Record<string, string> = {};
    for (const line of form.envText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    const args = form.args
      .trim()
      .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
      ?.map(s => s.replace(/^['"]|['"]$/g, '')) ?? [];

    const result = await callOk(
      api.saveCustom({
        id: editing?.id,
        name: form.name.trim(),
        command: form.command.trim(),
        args,
        cwd: form.cwd.trim(),
        env,
        port: form.port ? parseInt(form.port, 10) : undefined,
        url: form.url.trim() || undefined,
        autoStart: form.autoStart,
        color: form.color,
      }),
      editing ? 'Launcher updated' : 'Launcher saved',
      'Save failed',
    );
    setSubmitting(false);
    if (result) onOpenChange(false);
  };

  const onPickDir = async () => {
    const r = await api.pickDirectory();
    if (r.ok && r.data) update({ cwd: r.data });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit launcher' : 'New launcher'}
      description="Save a server command so you can start, stop and restart it with one click."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.name.trim() || !form.command.trim() || submitting}
            onClick={onSave}
          >
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create launcher'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Name"
          placeholder="API server"
          value={form.name}
          onChange={e => update({ name: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Color</span>
          <div className="flex gap-1.5 rounded-md border border-border bg-bg-panel px-2 py-1.5">
            {COLOR_PALETTE.map(c => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                aria-label={c}
                className="h-6 w-6 rounded-full border border-border-strong transition hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: form.color === c ? `2px solid ${c}` : undefined,
                  outlineOffset: 1,
                }}
              />
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <Input
            label="Command"
            placeholder="npm run dev   (or)   node ./server.js"
            value={form.command}
            onChange={e => update({ command: e.target.value })}
            hint="Single command. Add space-separated arguments below if you want them parsed separately."
          />
        </div>
        <div className="col-span-2">
          <Input
            label="Arguments (optional)"
            placeholder='--port 3000 "--name=My App"'
            value={form.args}
            onChange={e => update({ args: e.target.value })}
            hint="When provided, the command runs without a shell — supports quoted arguments."
          />
        </div>
        <div className="col-span-2">
          <Input
            label="Working directory"
            placeholder="C:\path\to\project"
            value={form.cwd}
            onChange={e => update({ cwd: e.target.value })}
            suffix={
              <button
                onClick={onPickDir}
                className="row-action h-7 w-7"
                aria-label="Browse"
                type="button"
              >
                <Folder className="h-3.5 w-3.5" />
              </button>
            }
          />
        </div>
        <Input
          label="Port (optional)"
          placeholder="3000"
          value={form.port}
          onChange={e => update({ port: e.target.value.replace(/[^0-9]/g, '') })}
        />
        <Input
          label="URL (optional)"
          placeholder="http://localhost:3000"
          value={form.url}
          onChange={e => update({ url: e.target.value })}
        />
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">
            Environment variables
          </span>
          <textarea
            className="input-base min-h-[88px] font-mono text-[12px]"
            placeholder={'KEY=value\nNODE_ENV=development'}
            value={form.envText}
            onChange={e => update({ envText: e.target.value })}
          />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-md border border-border bg-bg-panel/40 px-3 py-2">
          <Switch
            checked={form.autoStart}
            onCheckedChange={v => update({ autoStart: v })}
            label="Auto-start with LLSGC"
            description="Run this launcher automatically when the app opens."
          />
        </div>
      </div>
    </Dialog>
  );
}
