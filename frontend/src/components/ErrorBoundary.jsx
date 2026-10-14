import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#171513', color: '#FFF' }}>
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', padding: '2rem', borderRadius: '8px', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <AlertTriangle size={32} color="#EF4444" />
              <h2 style={{ margin: 0, color: '#EF4444' }}>Error inesperado en la pantalla</h2>
            </div>
            <p style={{ color: '#FCA5A5', marginBottom: '1rem' }}>
              {this.state.error && this.state.error.toString()}
            </p>
            <details style={{ whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px' }}>
              {this.state.errorInfo?.componentStack}
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#EF4444', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}
            >
              <RefreshCw size={18} />
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}
