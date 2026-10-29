import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an unhandled error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-4 my-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-serif font-bold text-[#173C32]">
                {this.props.fallbackTitle || "An unexpected display issue occurred in this section"}
              </h3>
              <p className="text-xs text-[#6B7C74] mt-1">
                {this.props.fallbackMessage ||
                  "The application encountered an error while rendering this component. The rest of the dashboard remains operational."}
              </p>

              {this.state.error && (
                <div className="mt-3 p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-left">
                  <p className="text-[11px] font-mono text-rose-700 font-semibold break-all">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3.5 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74] hover:bg-[#EDF7EF] transition-all"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
