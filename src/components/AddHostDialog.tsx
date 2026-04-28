import { useEffect, useState } from 'react';
import type { HostEntry } from '@shared/types';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { api, callOk } from '../lib/api';

interface FormState {
  ip: string;
  hostnames: string;
  comment: string;
  enabled: boolean;
}

const EMPTY: FormState = {
  ip: '127.0.0.1',
  hostnames: '',
  comment: '',
  enabled: true,
};

export function AddHostDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editing?: HostEntry | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              ip: editing.ip,
              hostnames: editing.hostnames.join(' '),
              comment: editing.comment ?? '',
              enabled: editing.enabled,
            }
          : EMPTY,
      );
    }
  }, [open, editing]);

  const update = (patch: Partial<FormState>) =>
    setForm(s => ({ ...s, ...patch }));

  const onSave = async () => {
    if (!form.ip.trim() || !form.hostnames.trim()) return;
    const hostnames = form.hostnames
      .split(/[\s,]+/)
      .map(h => h.trim())
      .filter(Boolean);
    setSubmitting(true);
    const r = await callOk(
      api.saveHost({
        id: editing?.id,
        ip: form.ip.trim(),
        hostnames,
        comment: form.comment.trim() || undefined,
        enabled: form.enabled,
      }),
      editing ? 'Host entry updated' : 'Host entry added',
      'Failed to save host',
    );
    setSubmitting(false);
    if (r) {
      onSaved?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit host entry' : 'Add host entry'}
      description="Maps a hostname to an IP in your hosts file. Modifying requires Administrator privileges."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.ip.trim() || !form.hostnames.trim() || submitting}
            onClick={onSave}
          >
            {submitting ? 'Saving…' : editing ? 'Save' : 'Add entry'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="IP address"
          placeholder="127.0.0.1"
          value={form.ip}
          onChange={e => update({ ip: e.target.value })}
        />
        <div className="col-span-2">
          <Input
            label="Hostnames"
            placeholder="myapp.local api.local"
            value={form.hostnames}
            onChange={e => update({ hostnames: e.target.value })}
            hint="Space- or comma-separated. e.g. myapp.local api.myapp.local"
          />
        </div>
        <div className="col-span-2">
          <Input
            label="Comment (optional)"
            placeholder="Local dev override"
            value={form.comment}
            onChange={e => update({ comment: e.target.value })}
          />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-md border border-border bg-bg-panel/40 px-3 py-2">
          <Switch
            checked={form.enabled}
            onCheckedChange={v => update({ enabled: v })}
            label="Enabled"
            description="Disabled entries stay in the file but are commented out."
          />
        </div>
      </div>
    </Dialog>
  );
}
