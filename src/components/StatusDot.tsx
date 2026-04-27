import { cn } from '../lib/utils';

export function StatusDot({
  state,
  className,
}: {
  state: 'running' | 'stopped' | 'crashed' | 'starting';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        state === 'running' && 'bg-ok animate-pulse-dot',
        state === 'stopped' && 'bg-fg-subtle',
        state === 'crashed' && 'bg-err',
        state === 'starting' && 'bg-warn animate-pulse-dot',
        className,
      )}
    />
  );
}
