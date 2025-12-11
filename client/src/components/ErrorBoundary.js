import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mt-5">
          <div className="card">
            <div className="card-body text-center">
              <div className="mb-4">
                <img 
                  src="/prinstine-logo.png" 
                  alt="Prinstine Group" 
                  style={{ maxWidth: '150px', height: 'auto' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <i className="bi bi-exclamation-triangle text-danger" style={{ fontSize: '4rem' }}></i>
              <h2 className="mt-3">Something went wrong</h2>
              <p className="text-muted">
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </p>
              <button
                className="btn btn-primary mt-3"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Refresh Page
              </button>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-start">
                  <summary>Error Details (Development Only)</summary>
                  <pre className="bg-light p-3 mt-2" style={{ fontSize: '0.8rem' }}>
                    {this.state.error.toString()}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

