// src/components/LockedField.jsx
import React from 'react';

/**
 * Shows value when unlocked, lock placeholder when locked.
 * Clicking the lock icon triggers onRequestUnlock.
 */
function LockedField({
  value,
  isUnlocked,
  onRequestUnlock,
  placeholder = 'Members only',
  className = '',
  renderValue = null,
}) {
  if (isUnlocked) {
    return (
      <span className={`text-gray-700 dark:text-slate-300 ${className}`}>
        {renderValue ? (
          <span>{renderValue(value)}</span>
        ) : (
          <span>{value}</span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onRequestUnlock}
      className={`inline-flex items-center gap-1.5 italic
        text-amber-700 dark:text-amber-400
        bg-amber-50 dark:bg-amber-900/20
        border border-amber-300 dark:border-amber-700
        px-2 py-0.5 rounded-md text-xs
        hover:bg-amber-100 dark:hover:bg-amber-900/40
        hover:border-amber-400 dark:hover:border-amber-500
        active:scale-95 transition-all cursor-pointer
        ${className}`}
    >
      🔒 {placeholder}
    </button>
  );
}

export default LockedField;