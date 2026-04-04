// src/pages/ChangePassword.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordStrength from '../components/PasswordStrength';

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();  // ← add logout
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [saving, setSaving]                     = useState(false);
  const [error, setError]                       = useState('');
  const [success, setSuccess]                   = useState(false);

  // Show/hide toggles for each field
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    
    // ← ADD: trim both passwords before any validation
    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedNew.length < 8) {
      return setError('New password must be at least 8 characters.');
    }
    if (trimmedNew !== trimmedConfirm) {
      return setError('New passwords do not match.');
    }
    if (trimmedCurrent === trimmedNew) {
      return setError('New password must be different from your current password.');
    }

    setSaving(true);
    try {
      await changePassword(trimmedCurrent, trimmedNew);
      setSuccess(true);

      // ── Fix: Clear local auth state and redirect to login after a short
      //         delay so the user can read the success message ────────────────
      setTimeout(async () => {
        await logout();                    // ← clears AuthContext user state
        navigate('/login', {
          replace: true,                   // ← no back-button to /change-password
          state: {
            message: '🔑 Password changed successfully. Please log in with your new password.',
          },
        });
      }, 2500);                            // ← 2.5s so user sees the success message

    } catch (err) {
      setError(err.message ?? 'Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container max-w-lg mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold text-lds-blue dark:text-slate-100 mb-1">
          🔑 Change Password
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Logged in as {user?.name} · {user?.email}
        </p>

        {success ? (
          // ── Success State ──────────────────────────────────────────────────
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h4 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">
              Password Changed!
            </h4>
            <p className="text-gray-600 dark:text-slate-300 mb-2">
              Your password has been updated successfully.
            </p>
            {/* ── Fix: Tell user what's about to happen ─────────────────── */}
            <p className="text-sm text-gray-400 dark:text-slate-500 animate-pulse">
              Redirecting you to login...
            </p>
          </div>

        ) : (
          // ── Form ───────────────────────────────────────────────────────────
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input w-full pr-10"
                  placeholder="Enter current password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                >
                  {showCurrent ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input w-full pr-10"
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                >
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Strength indicator */}
              <PasswordStrength password={newPassword} />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input w-full pr-10"
                  placeholder="Re-enter new password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Match indicator */}
              {confirmPassword.length > 0 && (
                <p className={`text-sm mt-1 ${
                  confirmPassword === newPassword
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-500 dark:text-red-400'
                }`}>
                  {confirmPassword === newPassword ? '✅ Passwords match' : '❌ Passwords do not match'}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? '⏳ Saving...' : '🔑 Change Password'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}