// src/components/PasswordStrength.jsx
import React from 'react';

// ── Scoring logic ─────────────────────────────────────────────────────────────
export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };

  const checks = {
    length:    password.length >= 8,
    longEnough: password.length >= 12,
    hasUpper:  /[A-Z]/.test(password),
    hasLower:  /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };

  const score =
    (checks.length    ? 1 : 0) +
    (checks.longEnough ? 1 : 0) +
    (checks.hasUpper  ? 1 : 0) +
    (checks.hasLower  ? 1 : 0) +
    (checks.hasNumber ? 1 : 0) +
    (checks.hasSymbol ? 1 : 0);

  if (score <= 1) return { score, label: 'Very Weak',  color: 'bg-red-500',    text: 'text-red-500 dark:text-red-400',    bars: 1 };
  if (score === 2) return { score, label: 'Weak',       color: 'bg-orange-500', text: 'text-orange-500 dark:text-orange-400', bars: 2 };
  if (score === 3) return { score, label: 'Fair',       color: 'bg-amber-500',  text: 'text-amber-500 dark:text-amber-400',  bars: 3 };
  if (score === 4) return { score, label: 'Good',       color: 'bg-blue-500',   text: 'text-blue-500 dark:text-blue-400',    bars: 4 };
  if (score === 5) return { score, label: 'Strong',     color: 'bg-green-500',  text: 'text-green-500 dark:text-green-400',  bars: 5 };
  return             { score, label: 'Very Strong', color: 'bg-green-600',  text: 'text-green-600 dark:text-green-400',  bars: 6 };
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PasswordStrength({ password }) {
  if (!password) return null;

  const { label, color, text, bars } = getPasswordStrength(password);
  const totalBars = 6;

  const checks = [
    { label: 'At least 8 characters',           met: password.length >= 8 },
    { label: '12+ characters (recommended)',     met: password.length >= 12 },
    { label: 'Uppercase letter (A-Z)',           met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a-z)',           met: /[a-z]/.test(password) },
    { label: 'Number (0-9)',                     met: /[0-9]/.test(password) },
    { label: 'Symbol (!@#$...)',                 met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 space-y-2">
      {/* ── Strength bar ── */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {Array.from({ length: totalBars }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < bars ? color : 'bg-gray-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold min-w-[70px] text-right ${text}`}>
          {label}
        </span>
      </div>

      {/* ── Criteria checklist ── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {checks.map((c, i) => (
          <p key={i} className={`text-xs flex items-center gap-1 ${
            c.met
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-400 dark:text-slate-500'
          }`}>
            {c.met ? '✅' : '○'} {c.label}
          </p>
        ))}
      </div>
    </div>
  );
}