// src/components/UserEditorModal.jsx
// Reusable modal for both adding a new user and editing an existing one.
// Add mode  → editUser prop is null
// Edit mode → editUser prop is the full user object
import React, { useState, useEffect } from 'react';
import { useUsers }           from '../context/UserContext';
import { useError }           from '../context/ErrorContext';
import { InlineError }        from './InlineError';
import { formatPhoneNumber }  from '../utils/formatters';
import PasswordStrength from './PasswordStrength';

const EMPTY_FORM = {
  name:     '',
  email:    '',
  password: '',
  phone:    '',
  calling:  '',
  role:     'editor',
  status:   'active',
};

export function UserEditorModal({ isOpen, onClose, editUser = null }) {
  const { addUser, updateUser } = useUsers();
  const { showSuccess }         = useError();
  const [form, setForm]         = useState(EMPTY_FORM);
  const [errors, setErrors]     = useState({});
  const isEditMode              = !!editUser;
  const [showPassword, setShowPassword]             = useState(false);
  const [confirmPassword, setConfirmPassword]       = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted]                   = useState(false);

  // ── Populate / reset form whenever the modal opens ────────────────────────
  useEffect(() => {
    if (editUser) {
      setForm({
        name:     editUser.name     ?? '',
        email:    editUser.email    ?? '',
        password: '',
        phone:    editUser.phone    ?? '',
        calling:  editUser.calling  ?? '',
        role:     editUser.role     ?? 'editor',
        status:   editUser.status   ?? 'active',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitted(false);
  }, [editUser, isOpen]);

  if (!isOpen) return null;

  // ── Field helpers ─────────────────────────────────────────────────────────
  const set = (field, value) => {
    setForm((prev)   => ({ ...prev,   [field]: value }));
    setErrors((prev) => ({ ...prev,   [field]: ''    }));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name.trim())  errs.name  = 'Full name is required.';
    if (!form.email.trim()) errs.email = 'Email address is required.';
    else if (!form.email.includes('@')) errs.email = 'Enter a valid email address.';
    if (!isEditMode && !form.password) {
      errs.password = 'Password is required for new users.';
    } else if (!isEditMode && form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    } else if (isEditMode && form.password && form.password.length < 8) {
      errs.password = 'New password must be at least 8 characters.';
    }
    if (form.password && confirmPassword !== form.password) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    if (!['bishopric', 'editor'].includes(form.role)) errs.role = 'Please select a valid role.';
    return errs;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setErrors({});
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    try {
      if (isEditMode) {
        const updates = { ...form };
        if (!updates.password) delete updates.password;
        await updateUser(editUser.id, updates);
        showSuccess(`${form.name}'s account has been updated.`);
      } else {
        await addUser(form);
        showSuccess(`${form.name} has been added as a new ${form.role}.`);
      }
      onClose();
      setConfirmPassword('');
    } catch (err) {
      setErrors({ submit: err.message ?? 'Failed to save user. Please try again.' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="modal-backdrop">
      <div className="modal-container max-w-lg p-0">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">
            {isEditMode ? '✏️ Edit User' : '➕ Add New User'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-2xl leading-none transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4">

            {/* Full Name */}
            <div className="col-span-2">
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="input w-full"
                placeholder="e.g. John Smith"
              />
              <InlineError message={errors.name} />
            </div>

            {/* Email */}
            <div className="col-span-2">
              <label className="label">Email Address <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="input w-full"
                placeholder="e.g. john@ward.org"
              />
              <InlineError message={errors.email} />
            </div>

            {/* Password */}
            <div className="col-span-2">
              <label className="label">
                Password {!isEditMode && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="input w-full pr-10"
                  placeholder={isEditMode ? 'Leave blank to keep current password' : 'Enter password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                             hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <InlineError message={errors.password} />
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm Password */}
            {form.password.length > 0 && (
              <div className="col-span-2">
                <label className="label">
                  Confirm Password {!isEditMode && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    }}
                    className="input w-full pr-10"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                               hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {(confirmPassword.length > 0 || submitted) && form.password.length > 0 && (
                  <p className={`text-xs mt-1 ${
                    confirmPassword === form.password
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}>
                    {confirmPassword === form.password ? '✅ Passwords match' : '❌ Passwords do not match'}
                  </p>
                )}
              </div>
            )}

            {/* Phone */}
            <div className="col-span-1">
              <label className="label">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set('phone', formatPhoneNumber(e.target.value))}
                className="input w-full"
                placeholder="(555) 555-5555"
                maxLength={14}
              />
            </div>

            {/* Calling / Position */}
            <div className="col-span-1">
              <label className="label">Calling / Position</label>
              <input
                type="text"
                value={form.calling}
                onChange={(e) => set('calling', e.target.value)}
                className="input w-full"
                placeholder="e.g. Bishop, Secretary"
              />
            </div>

            {/* Role */}
            <div className="col-span-1">
              <label className="label">Role <span className="text-red-500">*</span></label>
              <select
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                className="input w-full"
              >
                <option value="bishopric">🔵 Bishopric</option>
                <option value="editor">🟢 Editor</option>
              </select>
              <InlineError message={errors.role} />
            </div>

            {/* Status — edit mode only */}
            {isEditMode && (
              <div className="col-span-1">
                <label className="label">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className="input w-full"
                >
                  <option value="active">✅ Active</option>
                  <option value="inactive">🚫 Inactive</option>
                </select>
              </div>
            )}

          </div>

          {/* Validation error banner */}
          {submitted && Object.keys(errors).length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                            text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm mt-4">
              ⚠️ {errors.submit
                ? errors.submit
                : 'Please fix the errors above before saving.'}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {isEditMode ? '💾 Update User' : '➕ Save User'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
