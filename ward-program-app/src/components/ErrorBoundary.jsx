// src/components/ErrorBoundary.jsx
import React, { Component } from 'react';
import { logger } from '../utils/logger';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) { return { hasError: true, error }; }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    logger.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset() { this.setState({ hasError: false, error: null, errorInfo: null }); 
    window.location.href = '/admin'; 
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isDev = process.env.NODE_ENV === 'development';
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
          <div className="card max-w-lg w-full text-center">
            {/* Icon */}
            <div className="text-6xl mb-4">💥</div>
            {/* Heading */}
            <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">
              Something went wrong
            </h3>
            <p className="text-gray-500 dark:text-slate-400 mb-4">
              An unexpected error occurred. You can try recovering below, or reload the page to start fresh.
            </p>
            {/* Error message */}
            <div>
              {isDev && error?.message
                ? <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 mb-4">{error.message}</p>
                : <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 mb-4">An unexpected error occurred. Please reload the page.</p>
              }

            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReset} className="btn-primary">
                ↺ Try Again
              </button>
              <button onClick={() => window.location.reload()} className="btn-secondary">
                🔄 Reload Page
              </button>
            </div>
            {/* Dev-only component stack */}
            {isDev && errorInfo?.componentStack && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-gray-400 dark:text-slate-500 cursor-pointer">
                  Component stack (development only)
                </summary>
                <pre className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700 rounded p-3 mt-2 overflow-auto">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}