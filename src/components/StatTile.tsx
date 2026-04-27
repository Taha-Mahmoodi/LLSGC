import { ReactNode } from 'react';
import { Sparkline } from './Sparkline';
import { cn } from '../lib/utils';

export function StatTile({
  label,
  value,
  hint,
  icon,
  data,
  color,
  trend,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  data?: number[];
  color?: string;
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('stat-tile flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          {icon}
          {label}
        </div>
        {trend}
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint && <div className="text-xs text-fg-muted">{hint}</div>}
      {data && data.length > 1 && (
        <div className="-mb-1 mt-auto">
          <Sparkline data={data} width={300} height={42} color={color} max={100} />
        </div>
      )}
    </div>
  );
}
