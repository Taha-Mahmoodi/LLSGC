import { useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { api, callOk } from '../lib/api';

export function BlockPortDialog({
  open,
  onOpenChange,
  onBlocked,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onBlocked?: () => void;
}) {
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState<'TCP' | 'UDP' | 'Any'>('TCP');
  const [direction, setDirection] = useState<'in' | 'out' | 'both'>('in');
  const [submitting, setSubmitting] = useState(false);

  const onBlock = async () => {
    const portNum = parseInt(port, 10);
    if (!portNum || portNum < 1 || portNum > 65535) return;
    setSubmitting(true);
    const result = await callOk(
      api.blockPort({ port: portNum, protocol, direction }),
      `Port ${portNum} blocked`,
      'Failed to block port',
    );
    setSubmitting(false);
    if (result) {
      onBlocked?.();
      onOpenChange(false);
      setPort('');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Block a port"
      description="Adds a Windows Firewall rule to drop traffic. Requires administrator privileges."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!port || submitting}
            onClick={onBlock}
          >
            {submitting ? 'Blocking…' : 'Block port'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Port"
          placeholder="3000"
          value={port}
          onChange={e => setPort(e.target.value.replace(/[^0-9]/g, ''))}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Protocol</span>
          <Select
            value={protocol}
            onValueChange={v => setProtocol(v as any)}
            options={[
              { value: 'TCP', label: 'TCP' },
              { value: 'UDP', label: 'UDP' },
              { value: 'Any', label: 'Any' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">Direction</span>
          <Select
            value={direction}
            onValueChange={v => setDirection(v as any)}
            options={[
              { value: 'in', label: 'Inbound' },
              { value: 'out', label: 'Outbound' },
              { value: 'both', label: 'Both' },
            ]}
          />
        </div>
      </div>
      <p className="mt-3 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
        Tip: Run LLSGC as Administrator if you see an "elevation required" error.
      </p>
    </Dialog>
  );
}
