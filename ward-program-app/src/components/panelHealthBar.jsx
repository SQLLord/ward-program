// src/components/PanelHealthBar.jsx
import React from 'react';

const STATUS_CONFIG = {
  ok:       { color: 'bg-green-500',  label: '✅ OK',            textColor: 'text-green-600 dark:text-green-400' },
  warning:  { color: 'bg-amber-400',  label: '⚠️ Getting Full',  textColor: 'text-amber-600 dark:text-amber-400' },
  overflow: { color: 'bg-red-500',    label: '🔴 Overflow',      textColor: 'text-red-600 dark:text-red-400'   },
};

export function PanelHealthBar({ label, health, compact = false }) {
  if (!health) return null;
  const config = STATUS_CONFIG[health.status] ?? STATUS_CONFIG.ok;
  const barPct = Math.min(health.usedPct, 100);

  if (compact) {
    // Inline mini badge used on step tabs / Next button
    return (
      <span className={`text-xs font-semibold ${config.textColor}`}>
        {health.status === 'overflow' ? '🔴' : health.status === 'warning' ? '⚠️' : '✅'}
        {' '}{health.usedPct}%
      </span>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{label}</span>
        <span className={`text-xs font-bold ${config.textColor}`}>
          {config.label} — {health.usedPct}% full
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${config.color}`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* Warnings */}
      {health.warnings?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {health.warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}