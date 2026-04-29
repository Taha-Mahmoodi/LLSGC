import { useId, useMemo } from 'react';
import { cn } from '../lib/utils';

/**
 * Responsive sparkline: SVG renders at width="100%" (fills its parent)
 * while the path is computed in the original coordinate space defined
 * by `width`. preserveAspectRatio="none" stretches the path to fit.
 *
 * Pass `responsive={false}` to render at a fixed pixel width — useful
 * for tight rows where you want the sparkline to keep its native size.
 */
export function Sparkline({
  data,
  height = 36,
  width = 120,
  color = 'rgb(var(--accent))',
  fill = true,
  className,
  max,
  responsive = true,
}: {
  data: number[];
  height?: number;
  width?: number;
  color?: string;
  fill?: boolean;
  className?: string;
  max?: number;
  responsive?: boolean;
}) {
  const gradientId = useId();

  const path = useMemo(() => {
    if (data.length < 2) return null;
    const peakRaw = max ?? Math.max(...data, 1);
    const peak = peakRaw <= 0 ? 1 : peakRaw;
    const stepX = width / Math.max(1, data.length - 1);
    const points = data.map((v, i) => {
      const clamped = Math.max(0, Math.min(peak, v));
      const x = i * stepX;
      const y = height - (clamped / peak) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const line = `M ${points.join(' L ')}`;
    const area = `${line} L ${width.toFixed(2)},${height.toFixed(2)} L 0,${height.toFixed(2)} Z`;
    return { line, area };
  }, [data, width, height, max]);

  return (
    <svg
      width={responsive ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('block max-w-full', className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {path && fill && <path d={path.area} fill={`url(#${gradientId})`} />}
      {path && (
        <path
          d={path.line}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
