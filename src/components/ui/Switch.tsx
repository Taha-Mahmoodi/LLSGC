import * as RSwitch from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}) {
  return (
    <label className={cn('flex items-center gap-3 cursor-pointer', className)}>
      <RSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          'peer h-5 w-9 rounded-full border border-border bg-bg-panel relative transition',
          'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
        )}
      >
        <RSwitch.Thumb
          className="block h-4 w-4 rounded-full bg-fg shadow translate-x-0.5 transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-fg"
        />
      </RSwitch.Root>
      {(label || description) && (
        <span className="flex flex-col leading-tight">
          {label && <span className="text-sm font-medium">{label}</span>}
          {description && (
            <span className="text-xs text-fg-muted">{description}</span>
          )}
        </span>
      )}
    </label>
  );
}
