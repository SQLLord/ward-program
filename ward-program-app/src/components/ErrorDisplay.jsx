// src/components/ErrorDisplay.jsx
// Fixed-position toast/notification stack rendered at the bottom-right of the screen.
// Drop this once near the top level (e.g. inside App.jsx) and it will display
// all active error, warning, success, and info notifications automatically.
import React from 'react';
import { useError } from '../context/ErrorContext';

// ── Per-type visual config ───────────────────────────────────────────────────
const TYPE_CONFIG = {
  error:   { bg: 'bg-red-600',    icon: '❌', label: 'Error'   },
  warning: { bg: 'bg-yellow-500', icon: '⚠️', label: 'Warning' },
  success: { bg: 'bg-green-600',  icon: '✅', label: 'Success' },
  info:    { bg: 'bg-blue-600',   icon: 'ℹ️', label: 'Info'    },
};

export function ErrorDisplay() {
  const { errors, dismissError } = useError();
  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {errors.map(error => {
        const config = TYPE_CONFIG[error.type] ?? TYPE_CONFIG.info;
        return (
          <div
            key={error.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white pointer-events-auto ${config.bg}`}
          >
            {/* Icon */}
            <span className="text-lg flex-shrink-0">{config.icon}</span>

            {/* Message + optional detail */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug">{error.message}</p>
              {error.detail && (
                <p className="text-xs opacity-80 mt-0.5 leading-snug">{error.detail}</p>
              )}
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => dismissError(error.id)}
              className="flex-shrink-0 text-white opacity-70 hover:opacity-100 transition text-xl leading-none ml-1"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}