import { Minus, Square, X, Activity } from 'lucide-react';
import { api } from '../../lib/api';

export function TitleBar() {
  return (
    <div className="titlebar-drag relative z-10 flex h-10 items-center justify-between border-b border-border bg-bg-base/80 px-3 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Activity className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <span className="font-semibold tracking-tight">LLSGC</span>
        <span className="text-fg-subtle">·</span>
        <span className="text-fg-muted text-xs">Live Local Servers</span>
      </div>
      <div className="titlebar-no-drag flex items-center">
        <button
          aria-label="Minimize"
          onClick={() => api.minimize()}
          className="flex h-10 w-11 items-center justify-center text-fg-muted transition hover:bg-bg-elev hover:text-fg"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="Maximize"
          onClick={() => api.maximize()}
          className="flex h-10 w-11 items-center justify-center text-fg-muted transition hover:bg-bg-elev hover:text-fg"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          aria-label="Close"
          onClick={() => api.quit()}
          className="flex h-10 w-11 items-center justify-center text-fg-muted transition hover:bg-err hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
