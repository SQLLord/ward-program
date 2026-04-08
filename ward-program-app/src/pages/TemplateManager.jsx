// src/pages/TemplateManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useError } from '../context/ErrorContext';

export default function TemplateManager() {
    const navigate = useNavigate();
    const { showToast } = useError();

    const [templates, setTemplates]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [deletingId, setDeletingId]   = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [renamingId, setRenamingId]   = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [savingRename, setSavingRename] = useState(false);

    // ── Load templates ────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/templates');
            setTemplates(data);
        } catch (err) {
            showToast('❌ Failed to load templates.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Rename ────────────────────────────────────────────────────────────────
    const startRename = (t) => {
        setRenamingId(t.id);
        setRenameValue(t.name);
    };

    const cancelRename = () => {
        setRenamingId(null);
        setRenameValue('');
    };

    const saveRename = async (id) => {
        if (!renameValue.trim()) return showToast('❌ Name cannot be blank.', 'error');
        setSavingRename(true);
        try {
            await api.patch(`/templates/${id}/rename`, { name: renameValue.trim() });
            setTemplates(prev => prev.map(t =>
                t.id === id ? { ...t, name: renameValue.trim() } : t
            ));
            showToast('✅ Template renamed.');
            setRenamingId(null);
            setRenameValue('');
        } catch (err) {
            showToast('❌ Failed to rename template.', 'error');
        } finally {
            setSavingRename(false);
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const confirmDeleteTemplate = async () => {
        const t = confirmDelete;
        setConfirmDelete(null);
        setDeletingId(t.id);
        try {
            await api.delete(`/templates/${t.id}`);
            setTemplates(prev => prev.filter(x => x.id !== t.id));
            showToast('🗑️ Template deleted.');
        } catch (err) {
            showToast('❌ Failed to delete template.', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="page-container">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-lds-blue dark:text-slate-100">
                        📋 Program Templates
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        Saved templates for quickly creating new programs.
                        To update a template's content, save a program with the same name from the builder.
                    </p>
                </div>
                <button onClick={() => navigate('/admin')} className="btn-secondary">
                    ← Back to Dashboard
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                    <div className="text-4xl mb-3">⏳</div>
                    <p>Loading templates...</p>
                </div>
            )}

            {/* Empty state */}
            {!loading && templates.length === 0 && (
                <div className="card text-center py-16">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-xl font-bold mb-2 dark:text-slate-100">No Templates Yet</h3>
                    <p className="text-gray-500 dark:text-slate-400 mb-2">
                        Create a template by clicking <strong>Save as Template</strong> in Step 5 of the program builder.
                    </p>
                    <button
                        onClick={() => navigate('/builder/new')}
                        className="btn-primary mt-4"
                    >
                        ➕ Create a Program
                    </button>
                </div>
            )}

            {/* Template list */}
            {!loading && templates.length > 0 && (
                <div className="space-y-3">
                    {templates.map(t => (
                        <div
                            key={t.id}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100
                                       dark:border-slate-700 shadow-sm p-4"
                        >
                            <div className="flex items-center justify-between gap-4">

                                {/* Name / rename input */}
                                <div className="flex-1 min-w-0">
                                    {renamingId === t.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveRename(t.id);
                                                    if (e.key === 'Escape') cancelRename();
                                                }}
                                                className="input flex-1 text-sm"
                                                maxLength={200}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => saveRename(t.id)}
                                                disabled={savingRename}
                                                className="btn-primary text-xs px-3 py-1.5"
                                            >
                                                {savingRename ? '⏳' : '💾'}
                                            </button>
                                            <button
                                                onClick={cancelRename}
                                                className="btn-secondary text-xs px-3 py-1.5"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="font-bold text-gray-800 dark:text-slate-100 truncate">
                                                📋 {t.name}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                                                Created by {t.createdByName || 'unknown'}
                                                {' · '}
                                                {new Date(t.lastModified).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                })}
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* Actions */}
                                {renamingId !== t.id && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => navigate(`/builder/new?template=${t.id}`)}
                                            className="btn-primary text-xs px-3 py-1.5"
                                        >
                                            ➕ Use Template
                                        </button>
                                        <button
                                            onClick={() => startRename(t)}
                                            className="btn-secondary text-xs px-3 py-1.5"
                                        >
                                            ✏️ Rename
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(t)}
                                            disabled={deletingId === t.id}
                                            className="btn-danger text-xs px-3 py-1.5"
                                        >
                                            {deletingId === t.id ? '⏳' : '🗑️'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirmation modal */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center
                                justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6
                                    max-w-md w-full text-center">
                        <div className="text-5xl mb-3">⚠️</div>
                        <h3 className="text-xl font-bold mb-2 dark:text-slate-100">Delete Template?</h3>
                        <p className="text-gray-500 dark:text-slate-400 mb-1">
                            You are about to delete:
                        </p>
                        <p className="font-semibold dark:text-slate-100 mb-4">
                            {confirmDelete.name}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-5">
                            ⚠️ This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteTemplate}
                                className="btn-danger flex-1"
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
