import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary capturou um erro não tratado:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      const isProd = import.meta.env.PROD;

      return (
        <div className="min-h-[360px] flex items-center justify-center p-6 bg-[var(--color-background)]">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xl text-center">
            {/* Ícone estilizado */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-5">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-[var(--color-text)] mb-2 font-display">
              {this.props.fallbackTitle ?? "Ops, algo inesperado aconteceu"}
            </h2>
            <p className="text-sm text-[var(--color-muted)] mb-6 leading-relaxed">
              {this.props.fallbackDescription ?? "Ocorreu uma falha ao exibir este conteúdo. Você pode tentar recarregar ou voltar para a tela inicial."}
            </p>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                Tentar novamente
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-all"
              >
                Recarregar tela
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-all"
              >
                Início
              </button>
            </div>

            {/* Detalhes técnicos retráteis (útil para suporte) */}
            <div className="mt-6 pt-5 border-t border-[var(--color-border)] text-left">
              <button
                type="button"
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] flex items-center justify-between w-full"
              >
                <span>{this.state.showDetails ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${this.state.showDetails ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[11px] font-mono overflow-x-auto text-[var(--color-text)] max-h-48 overflow-y-auto">
                  <p className="font-bold text-red-500 mb-1">{this.state.error?.name}: {this.state.error?.message}</p>
                  {!isProd && this.state.errorInfo?.componentStack && (
                    <pre className="text-[10px] text-[var(--color-muted)] whitespace-pre-wrap mt-2">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
