// src/components/UnlockModal.jsx
import React, { useState, useRef, useEffect } from 'react';

function UnlockModal({ onUnlock, onClose }) {
  const [password, setPassword]               = useState('');
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [lockedUntil, setLockedUntil]         = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef(null);
  const inputRef    = useRef(null);

  // ── Auto-focus on open ────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lockedUntil) return;

    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setCooldownSeconds(0);
        setLockedUntil(null);
        setError('');
        clearInterval(cooldownRef.current);
        inputRef.current?.focus();
      } else {
        setCooldownSeconds(remaining);
      }
    };

    tick();
    cooldownRef.current = setInterval(tick, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [lockedUntil]);

  const isRateLimited = !!lockedUntil && cooldownSeconds > 0;

  const formatCooldown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0
      ? `${m}:${String(s).padStart(2, '0')}`
      : `${s}s`;
  };

  const handleUnlock = async () => {
    if (isRateLimited) return;
    if (!password.trim()) {
      setError('Please enter the ward password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onUnlock(password);
      if (!success) {
        setError('Incorrect password. Please try again.');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      if (err?.status === 429 || err?.message?.includes('429')) {
        const until = Date.now() + 15 * 60 * 1000;
        setLockedUntil(until);
        setPassword('');
        setError('');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isRateLimited) handleUnlock();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container max-w-sm">

        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🔒</div>
          <h5 className="text-lg font-bold text-gray-800 dark:text-slate-100">
            Ward Members Only
          </h5>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Enter the ward password to view member names and contact details.
          </p>
        </div>

        {/* Rate limit banner */}
        {isRateLimited ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                          text-red-700 dark:text-red-400 px-4 py-4 rounded-lg text-sm text-center mb-4">
            <p className="text-2xl mb-2">🚫</p>
            <p className="font-bold mb-1">Too Many Attempts</p>
            <p className="mb-2">Please wait before trying again.</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatCooldown(cooldownSeconds)}
            </p>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="password"
              value={password}
              placeholder="Ward password"
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              className="input w-full mb-2"
              autoComplete="off"
              disabled={loading}
            />
            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm mb-2 flex items-center gap-1">
                ❌ {error}
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleUnlock}
            disabled={loading || isRateLimited}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Checking...' : '🔓 Unlock'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>

        {/* Session note */}
        <p className="text-xs text-center text-gray-400 dark:text-slate-500 mt-4">
          🕐 Access expires after 90 minutes per session
        </p>

      </div>
    </div>
  );
}

export default UnlockModal;
