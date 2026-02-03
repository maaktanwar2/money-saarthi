import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    // You can also log the error to an error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Something went wrong
            </h1>

            {/* Description */}
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. This has been logged and we'll look into it.
            </p>

            {/* Error Details (Dev mode only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-left overflow-auto max-h-40">
                <p className="text-sm text-red-500 font-mono">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-card border border-border text-foreground hover:bg-accent transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
