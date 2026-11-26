import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({
      error,
      componentStack: info?.componentStack ?? '',
    });
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('Ouroboros runtime error:', error, info);
    }
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetStorageAndReload = (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('ouroboros_app_state_v1');
        window.localStorage.removeItem('ouroboros_notifications_v1');
      }
    } catch {
      // Ignore storage access errors in restricted modes
    }
    this.handleReload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message =
      this.state.error?.message?.trim() || 'An unexpected runtime error occurred.';
    const stackDetails = [this.state.error?.stack, this.state.componentStack]
      .filter(Boolean)
      .join('\n')
      .trim();

    return (
      <div
        role="alert"
        className="min-h-screen w-full bg-[#09090f] text-[#f4f4f8] flex items-center justify-center p-5"
      >
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12121d] p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-lg shrink-0">
              !
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Application Error
              </h1>
              <p className="text-xs text-slate-400">
                Ouroboros encountered an unexpected issue while rendering.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/25 bg-rose-950/25 px-3.5 py-2.5 text-sm font-medium text-rose-200 break-words">
            {message}
          </div>

          {stackDetails && (
            <details className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-300">
              <summary className="cursor-pointer font-semibold text-slate-200 select-none">
                Technical error details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-slate-400">
                {stackDetails}
              </pre>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2.5 rounded-xl bg-[#7c5cfc] hover:bg-[#6d4cf5] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Reload App
            </button>
            <button
              type="button"
              onClick={this.handleResetStorageAndReload}
              className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
            >
              Reset Local Cache &amp; Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
