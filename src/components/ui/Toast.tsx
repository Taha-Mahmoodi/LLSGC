import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, Info, AlertTriangle } from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';

export function ToastViewport() {
  const toasts = useStore(s => s.toasts);
  const dismiss = useStore(s => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={cn(
              'pointer-events-auto rounded-lg border bg-bg-elev shadow-glow px-3 py-2.5',
              t.tone === 'ok' && 'border-ok/30',
              t.tone === 'err' && 'border-err/30',
              t.tone === 'info' && 'border-border',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full',
                  t.tone === 'ok' && 'bg-ok/15 text-ok',
                  t.tone === 'err' && 'bg-err/15 text-err',
                  t.tone === 'info' && 'bg-accent/15 text-accent',
                )}
              >
                {t.tone === 'ok' && <Check className="h-3 w-3" />}
                {t.tone === 'err' && <AlertTriangle className="h-3 w-3" />}
                {t.tone === 'info' && <Info className="h-3 w-3" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium leading-tight">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs text-fg-muted leading-snug">
                    {t.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="row-action -mr-1 h-6 w-6 text-fg-subtle hover:text-fg"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
