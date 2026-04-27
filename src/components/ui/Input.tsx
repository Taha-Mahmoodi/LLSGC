import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, prefix, suffix, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-1.5">
        {label && (
          <span className="text-xs font-medium text-fg-muted">{label}</span>
        )}
        <span
          className={cn(
            'flex items-center gap-2 rounded-md bg-bg-panel border border-border px-3 transition focus-within:border-accent',
            className,
          )}
        >
          {prefix && (
            <span className="text-fg-subtle text-sm">{prefix}</span>
          )}
          <input
            ref={ref}
            className="w-full bg-transparent py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
            {...props}
          />
          {suffix && (
            <span className="text-fg-subtle text-xs">{suffix}</span>
          )}
        </span>
        {hint && <span className="text-[11px] text-fg-subtle">{hint}</span>}
      </label>
    );
  },
);
Input.displayName = 'Input';
