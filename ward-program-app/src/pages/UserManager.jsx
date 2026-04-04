// src/pages/UserManager.jsx
// Full-page user account management. Restricted to bishopric role only.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { useError } from '../context/ErrorContext';
import { UserEditorModal } from '../components/UserEditorModal';

// ── Role + status visual config ───────────────────────────────────────────────
const ROLE_CONFIG = {
  bishopric: { label: 'Bishopric', color: 'bg-blue-100  dark:bg-blue-900/30  text-blue-800  dark:text-blue-300',  icon: '🔵' },
  editor:    { label: 'Editor',    color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300', icon: '🟢' },
};

const STATUS_CONFIG = {
  active:   { label: 'Active',   color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300', icon: '✅' },
  inactive: { label: 'Inactive', color: 'bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-300',   icon: '🚫' },
};

export default function UserManager() {
  const navigate = useNavigate();
  const { users, deactivateUser, reactivateUser, deleteUser, loadUsers } = useUsers();
  const { user: currentUser }      = useAuth();
  const { showSuccess, showError } = useError();
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editingUser, setEditingUser]     = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Bishopric-only guard ──────────────────────────────────────────────────
  if (currentUser?.role !== 'bishopric') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h3 className="text-xl font-bold mb-2 dark:text-slate-100">Access Denied</h3>
        <p className="text-gray-500 dark:text-slate-400">
          User management is restricted to Bishopric members only.
        </p>
      </div>
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleStatus = async (u) => {
    if (u.id === currentUser?.id) { showError('You cannot deactivate your own account.'); return; }
    try {
      if (u.status === 'active') {
        await deactivateUser(u.id);
        showSuccess(`${u.name}'s account has been deactivated.`);
      } else {
        await reactivateUser(u.id);
        showSuccess(`${u.name}'s account has been reactivated.`);
      }
    } catch (err) {
      showError(err.message ?? 'Failed to update user status.');
    }
  };

  const handleDeleteClick = (u) => {
    if (u.id === currentUser?.id) { showError('You cannot delete your own account.'); return; }
    setDeleteConfirm(u);
  };

  const confirmDelete = async () => {
    try {
      await deleteUser(deleteConfirm.id);
      showSuccess(`${deleteConfirm.name}'s account has been permanently deleted.`);
      setDeleteConfirm(null);
    } catch (err) {
      showError(err.message ?? 'Failed to delete user.');
      setDeleteConfirm(null);
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalUsers     = users.length;
  const activeUsers    = users.filter((u) => u.status === 'active').length;
  const bishopricCount = users.filter((u) => u.role === 'bishopric').length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-sm text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold dark:text-slate-100 mb-2">Delete User Account?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              You are about to permanently delete:
            </p>

            {/* User identity block */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 mb-4 space-y-2">
              <p className="font-bold text-lg dark:text-slate-100">
                {deleteConfirm.name}
              </p>
              {(() => {
                const roleCfg = ROLE_CONFIG[deleteConfirm.role] ?? ROLE_CONFIG.editor;
                return (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold
                    px-2.5 py-0.5 rounded-full ${roleCfg.color}`}>
                    {roleCfg.icon} {roleCfg.label}
                  </span>
                );
              })()}
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {deleteConfirm.email}
                {deleteConfirm.calling ? ` · ${deleteConfirm.calling}` : ''}
              </p>
            </div>

            <p className="text-sm text-amber-600 dark:text-amber-400 mb-5">
              ⚠️ This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={confirmDelete} className="btn-danger flex-1">
                🗑️ Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      <UserEditorModal
        isOpen={showAddModal || !!editingUser}
        onClose={() => { setShowAddModal(false); setEditingUser(null); }}
        editUser={editingUser}
      />

      {/* ── PAGE HEADER ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-lds-blue dark:text-slate-100">👥 User Management</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage ward application accounts, roles, and access.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/admin')} className="btn-secondary">
            ← Back to Dashboard
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            ➕ Add User
          </button>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card-stat border-gray-400">
          <div className="text-3xl font-bold text-gray-700 dark:text-slate-100">{totalUsers}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-1">Total Users</div>
        </div>
        <div className="card-stat border-green-500">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{activeUsers}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-1">Active</div>
        </div>
        <div className="card-stat border-blue-400">
          <div className="text-3xl font-bold text-blue-500 dark:text-blue-400">{bishopricCount}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-1">Bishopric</div>
        </div>
      </div>

      {/* ── USER TABLE ── */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">User</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Calling / Position</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roleCfg   = ROLE_CONFIG[u.role]     ?? ROLE_CONFIG.editor;
              const statusCfg = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.active;
              const isSelf    = u.id === currentUser?.id;
              return (
                <tr
                  key={u.id}
                  className={`border-b border-gray-100 dark:border-slate-700 last:border-0 transition ${
                    isSelf
                      ? 'bg-blue-50 dark:bg-slate-700/50'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800 dark:text-slate-100">
                      {u.name}
                      {isSelf && (
                        <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{u.email}</p>
                    {u.phone && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">{u.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                    {u.calling || <span className="text-gray-400 dark:text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleCfg.color}`}>
                      {roleCfg.icon} {roleCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusCfg.color}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setEditingUser(u)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot modify your own account' : 'Edit user'}
                        className="btn-secondary btn-small disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot modify your own account' : (u.status === 'active' ? 'Deactivate account' : 'Reactivate account')}
                        className="btn-warning btn-small disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {u.status === 'active' ? '🚫 Deactivate' : '✅ Reactivate'}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(u)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                        className="btn-danger btn-small disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-gray-500 dark:text-slate-400">
              No users found. Add one to get started.
            </p>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button onClick={() => navigate('/admin')} className="btn-secondary">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
