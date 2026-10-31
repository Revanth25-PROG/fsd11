import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Stockwise Error Boundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('stockwise_cache_products');
      localStorage.removeItem('stockwise_cache_dashboard');
      localStorage.removeItem('stockwise_cache_sales');
      localStorage.removeItem('stockwise_cache_predictions');
      localStorage.removeItem('stockwise_cache_trends');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7faf8', fontFamily: 'sans-serif', padding: 20 }}>
          <div style={{ maxWidth: 480, background: '#fff', border: '1px solid #e2ece5', padding: 28, borderRadius: 16, textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <h2 style={{ color: '#c94e4e', margin: '0 0 10px' }}>Notice: System Recovery</h2>
            <p style={{ color: '#68776f', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
              A cached data mismatch occurred. Click below to clear obsolete cache and restore full live functionality.
            </p>
            <button
              onClick={this.handleReset}
              style={{
                background: '#258454',
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 9,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Reset Cache & Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
