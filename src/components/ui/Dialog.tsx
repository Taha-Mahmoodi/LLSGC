import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-fade-in" />
        <RDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-bg-elev shadow-glow animate-slide-up',
            size === 'sm' && 'max-w-md',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-2xl',
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div>
              <RDialog.Title className="text-base font-semibold">
                {title}
              </RDialog.Title>
              {description && (
                <RDialog.Description className="mt-0.5 text-xs text-fg-muted">
                  {description}
                </RDialog.Description>
              )}
            </div>
            <RDialog.Close className="row-action -mr-1.5">
              <X className="h-4 w-4" />
            </RDialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              {footer}
            </div>
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
