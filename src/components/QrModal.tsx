import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Smartphone } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { api, callOk } from '../lib/api';

export function QrModal({
  open,
  url,
  onOpenChange,
}: {
  open: boolean;
  url: string | null;
  onOpenChange: (next: boolean) => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !url) {
      setSvg(null);
      return;
    }
    let cancelled = false;
    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      width: 280,
      errorCorrectionLevel: 'M',
      color: { dark: '#eef0f5', light: '#0a0b0f' },
    })
      .then(s => {
        if (!cancelled) setSvg(s);
      })
      .catch(err => {
        console.error('[qr]', err);
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Scan to open on phone"
      description="Point a phone or tablet camera at the QR code below. The device must be on the same network."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {url && (
            <Button
              variant="secondary"
              onClick={() => callOk(api.copyText(url), 'URL copied')}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy URL
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2">
        <div
          className="flex h-[280px] w-[280px] items-center justify-center rounded-lg border border-border bg-bg-base p-2"
          aria-label={url ?? ''}
        >
          {svg ? (
            // eslint-disable-next-line react/no-danger
            <div dangerouslySetInnerHTML={{ __html: svg }} className="h-full w-full" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-fg-subtle">
              <Smartphone className="h-6 w-6" />
              <span className="text-xs">Generating…</span>
            </div>
          )}
        </div>
        {url && (
          <div className="rounded-md border border-border bg-bg-panel px-3 py-2 font-mono text-xs text-fg-muted max-w-full break-all text-center">
            {url}
          </div>
        )}
        <p className="text-[11px] text-fg-subtle text-center max-w-sm">
          Tip: this only works for URLs your phone can actually reach. For
          servers bound to <code>127.0.0.1</code> the phone has to be tethered
          via USB / ADB-reverse / similar; for <code>0.0.0.0</code>-bound
          servers any LAN URL works.
        </p>
      </div>
    </Dialog>
  );
}
