// src/components/InlineError.jsx
// Lightweight inline error/warning/info message for form field validation.
// Renders nothing if message is empty — safe to always include next to inputs.
//
// Usage:
// <InlineError message={errors.name} />
// <InlineError message="Heads up!" type="warning" />

import React from 'react';

const TYPE_CONFIG = {
  error:   { icon: '❌', color: 'text-red-600   dark:text-red-400'   },
  warning: { icon: '⚠️', color: 'text-yellow-600 dark:text-yellow-400' },
  info:    { icon: 'ℹ️', color: 'text-blue-600  dark:text-blue-400'   },
};

/**
 * InlineError
 * @param {string} message - The error/warning/info text. Renders nothing if empty/null.
 * @param {'error'|'warning'|'info'} type - Visual style. Defaults to 'error'.
 */
export function InlineError({ message, type = 'error' }) {
  if (!message) return null;
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.error;
  return (
    <p className={`text-xs mt-1 flex items-center gap-1 ${config.color}`}>
      <span>{config.icon}</span>
      <span>{message}</span>
    </p>
  );
}