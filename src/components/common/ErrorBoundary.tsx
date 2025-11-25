import React from 'react';

type State = { hasError: boolean; error?: Error | null };

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Also log to console for developer
    console.error('ErrorBoundary caught', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#f87171', background: '#111827', height: '100vh', boxSizing: 'border-box' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#fecaca' }}>{this.state.error?.message || 'Unknown error'}</pre>
          <details style={{ color: '#fca5a5' }}>
            <summary>Stack trace</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
          </details>
          <p style={{ color: '#9ca3af' }}>Open the browser console for more details.</p>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
