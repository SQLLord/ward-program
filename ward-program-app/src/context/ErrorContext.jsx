// src/context/ErrorContext.jsx
// Global error management context for the entire application.
// Provides showError, showWarning, showSuccess, showInfo, showToast (back-compat),
// dismissError, and clearAll to any component in the tree.

import React, { createContext, useContext, useState, useCallback } from 'react';

const ErrorContext = createContext(null);

/**
 * ErrorProvider
 * Wrap your app (or App.jsx) with this so every component can call useError().
 */
export function ErrorProvider({ children }) {
  const [errors, setErrors] = useState([]);

  // ── Core add helper ───────────────────────────────────────────────────────
  const addError = useCallback((type, message, detail = '', autoDismiss = false, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry = { id, type, message, detail, autoDismiss, duration };

    setErrors(prev => [...prev, entry]);

    if (autoDismiss) {
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.id !== id));
      }, duration);
    }

    return id;
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  /** Show a persistent red error (requires manual dismiss) */
  
  const showError = useCallback((message, detail = '', duration = 8000) =>
    addError('error', message, detail, true, duration),  // ← auto-dismisses after 8s
  [addError]);


  /** Show an auto-dismissing yellow warning */
  const showWarning = useCallback((message, detail = '', duration = 4000) =>
    addError('warning', message, detail, true, duration), [addError]);

  /** Show an auto-dismissing green success notification */
  const showSuccess = useCallback((message, detail = '', duration = 3000) =>
    addError('success', message, detail, true, duration), [addError]);

  /** Show an auto-dismissing blue info notification */
  const showInfo = useCallback((message, detail = '', duration = 3000) =>
    addError('info', message, detail, true, duration), [addError]);

  /**
   * showToast — backward-compatible wrapper.
   * Replaces the old showToast(message, type) pattern used throughout the app.
   * type: 'success' | 'error' | 'warning' | 'info'
   */
  const showToast = useCallback((message, type = 'success') => {
    switch (type) {
      case 'error':   return showError(message);
      case 'warning': return showWarning(message);
      case 'info':    return showInfo(message);
      default:        return showSuccess(message);
    }
  }, [showError, showWarning, showInfo, showSuccess]);

  /** Dismiss a single notification by id */
  const dismissError = useCallback((id) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  /** Clear all active notifications */
  const clearAll = useCallback(() => setErrors([]), []);

  const value = {
    errors,
    showError,
    showWarning,
    showSuccess,
    showInfo,
    showToast,
    dismissError,
    clearAll,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}

/**
 * useError
 * Custom hook to access the error context from any component.
 * Throws a clear message if used outside of ErrorProvider.
 */
export function useError() {
  const ctx = useContext(ErrorContext);
  if (!ctx) {
    throw new Error(
      'useError() must be used inside an <ErrorProvider>. ' +
      'Make sure ErrorProvider wraps your app in main.jsx or App.jsx.'
    );
  }
  return ctx;
}
