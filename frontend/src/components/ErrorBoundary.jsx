import { Component } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 'var(--radius-md, 10px)',
          padding: '2rem 1.5rem',
          boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08))',
        }}>
          <div style={{ color: 'var(--amber, #f59e0b)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '52px', height: '52px',
              background: 'rgba(245,158,11,0.12)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={26} />
            </div>
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #111)', marginBottom: '0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #555)', lineHeight: 1.5, marginBottom: '1rem' }}>
            This page hit an unexpected error. Reload to try again.
          </p>
          {this.state.error && (
            <pre style={{
              background: 'var(--bg-surface, #f9fafb)',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: '6px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.72rem',
              color: 'var(--red, #ef4444)',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '140px',
              overflowY: 'auto',
              marginBottom: '1.25rem',
            }}>
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{
              background: 'var(--accent, #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '0.55rem 1.4rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <RefreshCw size={15} /> Reload Page
          </button>
        </div>
      </div>
    );
  }
}
