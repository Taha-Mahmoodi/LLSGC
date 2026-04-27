import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (next: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger
        className={cn(
          'flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-bg-panel px-3 text-sm transition hover:border-border-strong focus:outline-none focus:border-accent min-w-[8rem]',
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 overflow-hidden rounded-md border border-border bg-bg-elev shadow-glow animate-fade-in min-w-[var(--radix-select-trigger-width)]"
        >
          <RSelect.Viewport className="p-1">
            {options.map(opt => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-bg-panel data-[state=checked]:text-accent"
              >
                <RSelect.ItemIndicator>
                  <Check className="h-3.5 w-3.5" />
                </RSelect.ItemIndicator>
                <span className="ml-5">
                  <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                </span>
                {opt.description && (
                  <span className="ml-auto text-xs text-fg-subtle">
                    {opt.description}
                  </span>
                )}
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
