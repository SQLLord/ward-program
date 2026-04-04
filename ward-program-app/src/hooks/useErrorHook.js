// src/hooks/useErrorHook.js
// Convenience re-exports + additional form-level error hook.
// Import from here instead of the context directly for cleaner import paths.

export { useError } from '../context/ErrorContext';

// ─────────────────────────────────────────────────────────────────────────────
// useFormErrors
// Manages per-field validation error state for any form in the app.
//
// Usage:
//   const { setFieldError, clearFieldError, getError, hasErrors } = useFormErrors();
//   setFieldError('date', 'Date is required');
//   <InlineError message={getError('date')} />
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';

export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState({});

  /** Set an error message for a specific field */
  const setFieldError = useCallback((field, message) => {
    setFieldErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  /** Clear the error for a specific field */
  const clearFieldError = useCallback((field) => {
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Clear all field errors at once */
  const clearAllFieldErrors = useCallback(() => setFieldErrors({}), []);

  /** Returns true if any field currently has an error */
  const hasErrors = Object.keys(fieldErrors).length > 0;

  /** Get the error message for a field, or empty string if none */
  const getError = useCallback((field) => fieldErrors[field] ?? '', [fieldErrors]);

  return {
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllFieldErrors,
    hasErrors,
    getError,
  };
}
