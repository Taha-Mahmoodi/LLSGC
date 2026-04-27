import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Copy } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  scope?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[LLSGC] error in ${this.props.scope ?? 'render'}`, error, info);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  reset = () => this.setState({ error: null, componentStack: null });

  copy = async () => {
    const { error, componentStack } = this.state;
    if (!error) return;
    const text = [
      `LLSGC error in: ${this.props.scope ?? 'unknown'}`,
      `Message: ${error.message}`,
      '',
      'Stack:',
      error.stack ?? '(no stack)',
      '',
      'Component stack:',
      componentStack ?? '(no component stack)',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        await window.llsgc?.copyText(text);
      } catch {
        /* ignore */
      }
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || 'Unknown error';
    const stack = this.state.error.stack;

    return (
      <div className="flex h-full flex-col overflow-y-auto px-8 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-center gap-3 text-err">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-lg font-semibold">
              Something went wrong on this page
            </h1>
          </div>
          <p className="mt-2 text-sm text-fg-muted">
            This is a bug in LLSGC. The details below will help fix it — copy
            them and open an issue on GitHub.
          </p>

          <div className="mt-4 rounded-lg border border-err/30 bg-err/5 p-4 font-mono text-[12px] leading-relaxed">
            <div className="font-semibold text-err break-all">{message}</div>
            {stack && (
              <pre className="mt-3 whitespace-pre-wrap break-all text-fg-muted max-h-72 overflow-y-auto">
                {stack}
              </pre>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={this.reset}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={this.copy}>
              <Copy className="h-3.5 w-3.5" />
              Copy error
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.llsgc?.openExternal(
                  'https://github.com/Taha-Mahmoodi/LLSGC/issues/new',
                )
              }
            >
              Open an issue
            </Button>
          </div>

          <p className="mt-6 text-xs text-fg-subtle">
            Tip: press <kbd className="rounded bg-bg-elev px-1.5 py-0.5 border border-border font-mono">F12</kbd> to open DevTools.
          </p>
        </div>
      </div>
    );
  }
}
