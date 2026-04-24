import React, { ReactNode, ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error("Error caught by boundary:", error, errorInfo);

    this.setState({
      errorInfo,
    });

    // Send to error tracking service (e.g., Sentry)
    if (typeof window !== "undefined" && window.__ERROR_LOG__) {
      window.__ERROR_LOG__.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
              <div className="flex justify-center mb-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                Algo deu errado
              </h1>
              <p className="text-gray-600 text-center mb-4">
                Desculpe, encontramos um problema inesperado. Por favor, tente
                novamente.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mb-6 p-3 bg-gray-100 rounded text-sm text-left overflow-auto max-h-40">
                  <summary className="font-semibold cursor-pointer mb-2 text-gray-700">
                    Detalhes do Erro (desenvolvimento)
                  </summary>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                    {"\n\n"}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <button
                onClick={this.resetError}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>

              <button
                onClick={() => window.location.href = "/"}
                className="w-full mt-2 text-gray-600 hover:text-gray-900 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Voltar para Início
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Hook para usar erro em componentes funcionais
export function useErrorHandler(error: Error | null) {
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);
}

// Wrapper para ErrorBoundary com suporte assíncrono
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;

  return WrappedComponent;
};
